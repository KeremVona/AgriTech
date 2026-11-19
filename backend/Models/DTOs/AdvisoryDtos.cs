using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace AgriTech.Api.Models.DTOs;

public class ResolveAdvisoryRequest
{
    [Required]
    [MaxLength(120)]
    [JsonPropertyName("class_key")]
    public string ClassKey { get; set; } = string.Empty;

    [Required]
    [MaxLength(80)]
    [JsonPropertyName("crop")]
    public string Crop { get; set; } = string.Empty;

    [Required]
    [MaxLength(120)]
    [JsonPropertyName("condition")]
    public string Condition { get; set; } = string.Empty;

    [MaxLength(120)]
    [JsonPropertyName("scientific_name")]
    public string? ScientificName { get; set; }

    [MaxLength(40)]
    [JsonPropertyName("severity_index")]
    public string? SeverityIndex { get; set; }

    [JsonPropertyName("force_refresh")]
    public bool ForceRefresh { get; set; }
}

public class AdvisoryResponseDto
{
    [JsonPropertyName("class_key")]
    public string ClassKey { get; set; } = string.Empty;

    [JsonPropertyName("crop")]
    public string Crop { get; set; } = string.Empty;

    [JsonPropertyName("condition")]
    public string Condition { get; set; } = string.Empty;

    [JsonPropertyName("scientific_name")]
    public string? ScientificName { get; set; }

    [JsonPropertyName("severity_index")]
    public string SeverityIndex { get; set; } = string.Empty;

    [JsonPropertyName("immediate_action")]
    public string ImmediateAction { get; set; } = string.Empty;

    [JsonPropertyName("recommended_treatments")]
    public IReadOnlyList<string> RecommendedTreatments { get; set; } = Array.Empty<string>();

    [JsonPropertyName("microclimate_risk")]
    public string MicroclimateRisk { get; set; } = string.Empty;

    [JsonPropertyName("source")]
    public string Source { get; set; } = string.Empty;

    [JsonPropertyName("llm_model")]
    public string LlmModel { get; set; } = string.Empty;

    [JsonPropertyName("cached_at")]
    public DateTime CachedAt { get; set; }
}
