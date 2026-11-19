using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using AgriTech.Api.Models.DTOs;
using Microsoft.Extensions.Options;

namespace AgriTech.Api.Services;

public class GeminiAdvisoryClient : IGeminiAdvisoryClient
{
    private readonly HttpClient _httpClient;
    private readonly GeminiOptions _options;
    private readonly ILogger<GeminiAdvisoryClient> _logger;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public GeminiAdvisoryClient(
        HttpClient httpClient,
        IOptions<GeminiOptions> options,
        ILogger<GeminiAdvisoryClient> logger)
    {
        _httpClient = httpClient;
        _options = options.Value;
        _logger = logger;
    }

    public async Task<GeneratedAdvisoryPayload> GenerateAdvisoryAsync(
        ResolveAdvisoryRequest request,
        CancellationToken cancellationToken = default)
    {
        var apiKey = !string.IsNullOrWhiteSpace(_options.ApiKey)
            ? _options.ApiKey.Trim()
            : (Environment.GetEnvironmentVariable("GEMINI_API_KEY")?.Trim() ?? string.Empty);

        if (string.IsNullOrWhiteSpace(apiKey))
        {
            throw new LlmAdvisoryUnavailableException("Gemini API key is not configured (Gemini:ApiKey or GEMINI_API_KEY).");
        }

        var model = string.IsNullOrWhiteSpace(_options.Model) ? "gemini-2.5-flash" : _options.Model.Trim();
        var baseUrl = string.IsNullOrWhiteSpace(_options.BaseUrl)
            ? "https://generativelanguage.googleapis.com/v1beta"
            : _options.BaseUrl.TrimEnd('/');

        var endpoint = $"{baseUrl}/models/{Uri.EscapeDataString(model)}:generateContent";
        var isHealthy = request.Condition.Contains("healthy", StringComparison.OrdinalIgnoreCase)
            || request.ClassKey.EndsWith("/healthy", StringComparison.OrdinalIgnoreCase);

        var prompt = BuildPrompt(request, isHealthy);
        var payload = new
        {
            contents = new[]
            {
                new
                {
                    parts = new[] { new { text = prompt } }
                }
            },
            generationConfig = new
            {
                temperature = 0.2,
                responseMimeType = "application/json",
                responseSchema = new
                {
                    type = "OBJECT",
                    properties = new
                    {
                        immediate_action = new { type = "STRING" },
                        recommended_treatments = new
                        {
                            type = "ARRAY",
                            items = new { type = "STRING" }
                        },
                        microclimate_risk = new { type = "STRING" }
                    },
                    required = new[] { "immediate_action", "recommended_treatments", "microclimate_risk" }
                }
            }
        };

        using var httpRequest = new HttpRequestMessage(HttpMethod.Post, endpoint)
        {
            Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json")
        };
        httpRequest.Headers.Add("x-goog-api-key", apiKey);

        HttpResponseMessage response;
        try
        {
            response = await _httpClient.SendAsync(httpRequest, cancellationToken);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            _logger.LogWarning(ex, "Gemini API request failed for class_key '{ClassKey}'.", request.ClassKey);
            throw new LlmAdvisoryUnavailableException($"Gemini API request failed: {ex.Message}", ex);
        }

        if (!response.IsSuccessStatusCode)
        {
            var errBody = await response.Content.ReadAsStringAsync(cancellationToken);
            _logger.LogWarning("Gemini API returned HTTP {StatusCode} for '{ClassKey}': {Body}",
                (int)response.StatusCode, request.ClassKey, errBody);
            throw new LlmAdvisoryUnavailableException(
                $"Gemini API returned HTTP {(int)response.StatusCode}.");
        }

        GeminiGenerateContentResponse? envelope;
        try
        {
            envelope = await response.Content.ReadFromJsonAsync<GeminiGenerateContentResponse>(JsonOptions, cancellationToken);
        }
        catch (Exception ex) when (ex is JsonException or NotSupportedException)
        {
            throw new LlmAdvisoryUnavailableException("Gemini API returned an invalid response envelope.", ex);
        }

        var rawText = envelope?.Candidates?.FirstOrDefault()?.Content?.Parts?.FirstOrDefault()?.Text;
        if (string.IsNullOrWhiteSpace(rawText))
        {
            throw new LlmAdvisoryUnavailableException("Gemini API returned an empty candidate payload.");
        }

        GeminiStructuredAdvisory? parsed;
        try
        {
            parsed = JsonSerializer.Deserialize<GeminiStructuredAdvisory>(StripMarkdownFence(rawText), JsonOptions);
        }
        catch (JsonException ex)
        {
            _logger.LogWarning(ex, "Gemini candidate text was not valid JSON for '{ClassKey}': {Text}",
                request.ClassKey, rawText);
            throw new LlmAdvisoryUnavailableException("Gemini candidate payload was not valid structured JSON.", ex);
        }

        if (parsed is null ||
            string.IsNullOrWhiteSpace(parsed.ImmediateAction) ||
            string.IsNullOrWhiteSpace(parsed.MicroclimateRisk))
        {
            throw new LlmAdvisoryUnavailableException("Gemini response omitted required advisory fields.");
        }

        var treatments = (parsed.RecommendedTreatments ?? Array.Empty<string>())
            .Where(t => !string.IsNullOrWhiteSpace(t))
            .Select(t => t.Trim())
            .ToArray();

        return new GeneratedAdvisoryPayload(
            parsed.ImmediateAction.Trim(),
            treatments,
            parsed.MicroclimateRisk.Trim(),
            model);
    }

    private static string BuildPrompt(ResolveAdvisoryRequest request, bool isHealthy)
    {
        var scientific = string.IsNullOrWhiteSpace(request.ScientificName)
            ? "N/A"
            : request.ScientificName;
        var severity = string.IsNullOrWhiteSpace(request.SeverityIndex)
            ? "Medium"
            : request.SeverityIndex;

        var treatmentInstruction = isHealthy
            ? "Provide an empty list [] or at most 1-2 brief routine preventative monitoring practices (no curative chemical fungicides)."
            : "Provide 3 to 4 concise, actionable treatment bullets including active ingredient/product class, general dosage/timing guidance, and cultural/sanitation control.";

        return $"""
            You are an expert agricultural pathologist advising a field grower.
            Diagnosed foliar condition:
            - Crop: {request.Crop}
            - Condition: {request.Condition}
            - Scientific name: {scientific}
            - Severity index: {severity}
            - Canonical class key: {request.ClassKey}

            Return strictly valid JSON matching the schema with:
            1. "immediate_action": 2-3 concise sentences telling the grower what to do immediately in the field today (scouting, isolation, irrigation hygiene).
            2. "recommended_treatments": {treatmentInstruction}
            3. "microclimate_risk": 2 concise sentences describing exact temperature (°C), relative humidity (%), and leaf-wetness/rainfall conditions that drive this condition.
            """;
    }

    private static string StripMarkdownFence(string raw)
    {
        var trimmed = raw.Trim();
        if (!trimmed.StartsWith("```", StringComparison.Ordinal))
        {
            return trimmed;
        }
        var firstNewline = trimmed.IndexOf('\n');
        var lastFence = trimmed.LastIndexOf("```", StringComparison.Ordinal);
        if (firstNewline >= 0 && lastFence > firstNewline)
        {
            return trimmed[(firstNewline + 1)..lastFence].Trim();
        }
        return trimmed;
    }

    private sealed class GeminiGenerateContentResponse
    {
        public List<GeminiCandidate>? Candidates { get; set; }
    }

    private sealed class GeminiCandidate
    {
        public GeminiContent? Content { get; set; }
    }

    private sealed class GeminiContent
    {
        public List<GeminiPart>? Parts { get; set; }
    }

    private sealed class GeminiPart
    {
        public string? Text { get; set; }
    }

    private sealed class GeminiStructuredAdvisory
    {
        [JsonPropertyName("immediate_action")]
        public string? ImmediateAction { get; set; }

        [JsonPropertyName("recommended_treatments")]
        public string[]? RecommendedTreatments { get; set; }

        [JsonPropertyName("microclimate_risk")]
        public string? MicroclimateRisk { get; set; }
    }
}
