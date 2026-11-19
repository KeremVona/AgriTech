using AgriTech.Api.Models.DTOs;

namespace AgriTech.Api.Services;

public class GeminiOptions
{
    public const string SectionName = "Gemini";
    public string ApiKey { get; set; } = string.Empty;
    public string Model { get; set; } = "gemini-2.5-flash";
    public string BaseUrl { get; set; } = "https://generativelanguage.googleapis.com/v1beta";
}

public record GeneratedAdvisoryPayload(
    string ImmediateAction,
    IReadOnlyList<string> RecommendedTreatments,
    string MicroclimateRisk,
    string ModelName);

public class LlmAdvisoryUnavailableException : Exception
{
    public LlmAdvisoryUnavailableException(string message, Exception? innerException = null)
        : base(message, innerException)
    {
    }
}

public interface IGeminiAdvisoryClient
{
    Task<GeneratedAdvisoryPayload> GenerateAdvisoryAsync(
        ResolveAdvisoryRequest request,
        CancellationToken cancellationToken = default);
}
