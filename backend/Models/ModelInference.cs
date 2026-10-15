namespace AgriTech.Api.Models;

public class ModelInference
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid PredictedDiseaseId { get; set; }
    public string ModelVersion { get; set; } = string.Empty;
    public decimal ConfidenceScore { get; set; }
    public string ClassProbabilities { get; set; } = "{}";
    public int InferenceTimeMs { get; set; }
    public DateTime MadeAt { get; set; } = DateTime.UtcNow;

    public ICollection<CropScan> CropScans { get; set; } = new List<CropScan>();
}
