using System.Net;
using System.Text;
using AgriTech.Api.Models.DTOs;
using AgriTech.Api.Services;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Xunit;

namespace AgriTech.Api.Tests;

public class GeminiAdvisoryClientTests
{
    private sealed class StubHttpMessageHandler : HttpMessageHandler
    {
        private readonly Func<HttpRequestMessage, HttpResponseMessage> _responder;
        public HttpRequestMessage? LastRequest { get; private set; }
        public string? LastBody { get; private set; }
        public int CallCount { get; private set; }

        public StubHttpMessageHandler(Func<HttpRequestMessage, HttpResponseMessage> responder)
        {
            _responder = responder;
        }

        protected override async Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken)
        {
            CallCount++;
            LastRequest = request;
            if (request.Content is not null)
            {
                LastBody = await request.Content.ReadAsStringAsync(cancellationToken);
            }
            return _responder(request);
        }
    }

    private static ResolveAdvisoryRequest SampleRequest() => new()
    {
        ClassKey = "tomato/late_blight",
        Crop = "Tomato",
        Condition = "Late Blight",
        ScientificName = "Phytophthora infestans",
        SeverityIndex = "High"
    };

    [Fact]
    public async Task GenerateAdvisoryAsync_ParsesValidStructuredGeminiJson()
    {
        var geminiResponseJson = """
        {
          "candidates": [
            {
              "content": {
                "parts": [
                  {
                    "text": "{\"immediate_action\":\"Remove infected lower foliage immediately and halt overhead watering.\",\"recommended_treatments\":[\"Copper Hydroxide 77% WP — 2.0 kg/ha preventative spray\",\"Mancozeb 80% WP prior to rain events\",\"Cymoxanil curative spray within 48h\"],\"microclimate_risk\":\"High risk when relative humidity exceeds 90% and ambient temperature stays between 15C and 22C.\"}"
                  }
                ]
              }
            }
          ]
        }
        """;

        var handler = new StubHttpMessageHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(geminiResponseJson, Encoding.UTF8, "application/json")
        });
        var httpClient = new HttpClient(handler);
        var options = Options.Create(new GeminiOptions
        {
            ApiKey = "test-gemini-key",
            Model = "gemini-2.5-flash"
        });
        var client = new GeminiAdvisoryClient(httpClient, options, NullLogger<GeminiAdvisoryClient>.Instance);

        var result = await client.GenerateAdvisoryAsync(SampleRequest());

        Assert.Equal(1, handler.CallCount);
        Assert.NotNull(handler.LastRequest);
        Assert.Contains("models/gemini-2.5-flash:generateContent", handler.LastRequest!.RequestUri!.ToString());
        Assert.True(handler.LastRequest.Headers.TryGetValues("x-goog-api-key", out var apiKeyValues));
        Assert.Contains("test-gemini-key", apiKeyValues);
        Assert.DoesNotContain("test-gemini-key", handler.LastRequest.RequestUri.ToString());
        Assert.Equal("Remove infected lower foliage immediately and halt overhead watering.", result.ImmediateAction);
        Assert.Equal(3, result.RecommendedTreatments.Count);
        Assert.Contains("Copper Hydroxide", result.RecommendedTreatments[0]);
        Assert.Contains("90%", result.MicroclimateRisk);
        Assert.Equal("gemini-2.5-flash", result.ModelName);
    }

    [Fact]
    public async Task GenerateAdvisoryAsync_ThrowsWhenApiKeyMissing()
    {
        var handler = new StubHttpMessageHandler(_ => new HttpResponseMessage(HttpStatusCode.OK));
        var httpClient = new HttpClient(handler);
        var options = Options.Create(new GeminiOptions { ApiKey = "", Model = "gemini-2.5-flash" });
        var client = new GeminiAdvisoryClient(httpClient, options, NullLogger<GeminiAdvisoryClient>.Instance);

        await Assert.ThrowsAsync<LlmAdvisoryUnavailableException>(() =>
            client.GenerateAdvisoryAsync(SampleRequest()));

        Assert.Equal(0, handler.CallCount);
    }

    [Theory]
    [InlineData(HttpStatusCode.TooManyRequests, "{\"error\":\"rate limit\"}")]
    [InlineData(HttpStatusCode.OK, "{\"candidates\":[{\"content\":{\"parts\":[{\"text\":\"not-json\"}]}}]}")]
    public async Task GenerateAdvisoryAsync_ThrowsOnHttpErrorOrMalformedJson(HttpStatusCode status, string body)
    {
        var handler = new StubHttpMessageHandler(_ => new HttpResponseMessage(status)
        {
            Content = new StringContent(body, Encoding.UTF8, "application/json")
        });
        var httpClient = new HttpClient(handler);
        var options = Options.Create(new GeminiOptions { ApiKey = "test-key", Model = "gemini-2.5-flash" });
        var client = new GeminiAdvisoryClient(httpClient, options, NullLogger<GeminiAdvisoryClient>.Instance);

        await Assert.ThrowsAsync<LlmAdvisoryUnavailableException>(() =>
            client.GenerateAdvisoryAsync(SampleRequest()));
    }
}
