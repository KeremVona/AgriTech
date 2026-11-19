using System.Text.Json;
using AgriTech.Api.Data;
using AgriTech.Api.Models;
using AgriTech.Api.Models.DTOs;
using AgriTech.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace AgriTech.Api.Controllers;

/// <summary>
/// Cache-first agronomic advisory endpoint backed by PostgreSQL (`disease_advisories`)
/// and Google Gemini on cache miss.
///
/// Endpoints:
///   POST   /api/v1/advisories/resolve      - Return cached DB advisory or generate via Gemini and cache
///   GET    /api/v1/advisories/{**classKey} - Inspect cached advisory for a canonical class key
///   DELETE /api/v1/advisories/{**classKey} - Invalidate a cached advisory entry
/// </summary>
[ApiController]
[Route("api/v1/advisories")]
[Produces("application/json")]
public class AdvisoriesController : ControllerBase
{
    private readonly AgriTechDbContext _db;
    private readonly IGeminiAdvisoryClient _geminiClient;
    private readonly ILogger<AdvisoriesController> _logger;

    public AdvisoriesController(
        AgriTechDbContext db,
        IGeminiAdvisoryClient geminiClient,
        ILogger<AdvisoriesController> logger)
    {
        _db = db;
        _geminiClient = geminiClient;
        _logger = logger;
    }

    [HttpGet("{**classKey}")]
    [ProducesResponseType(typeof(AdvisoryResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<AdvisoryResponseDto>> GetAdvisory(
        string classKey,
        CancellationToken cancellationToken)
    {
        var normalizedKey = NormalizeClassKey(classKey);
        if (string.IsNullOrEmpty(normalizedKey))
            return BadRequest(new { message = "class_key is required." });

        var existing = await _db.DiseaseAdvisories
            .AsNoTracking()
            .FirstOrDefaultAsync(d => d.ClassKey == normalizedKey, cancellationToken);

        if (existing is null)
            return NotFound(new { message = $"No cached advisory found for '{normalizedKey}'." });

        return Ok(ToDto(existing, "database_cache"));
    }

    [HttpPost("resolve")]
    [ProducesResponseType(typeof(AdvisoryResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status503ServiceUnavailable)]
    public async Task<ActionResult<AdvisoryResponseDto>> ResolveAdvisory(
        [FromBody] ResolveAdvisoryRequest request,
        CancellationToken cancellationToken)
    {
        var normalizedKey = NormalizeClassKey(request.ClassKey);
        if (string.IsNullOrEmpty(normalizedKey))
        {
            return BadRequest(new ProblemDetails
            {
                Status = StatusCodes.Status400BadRequest,
                Title = "Invalid class_key",
                Detail = "class_key cannot be empty."
            });
        }

        if (!request.ForceRefresh)
        {
            var cached = await _db.DiseaseAdvisories
                .AsNoTracking()
                .FirstOrDefaultAsync(d => d.ClassKey == normalizedKey, cancellationToken);

            if (cached is not null)
            {
                _logger.LogInformation("Advisory cache HIT for '{ClassKey}'.", normalizedKey);
                return Ok(ToDto(cached, "database_cache"));
            }
        }

        _logger.LogInformation("Advisory cache MISS for '{ClassKey}'. Calling Gemini LLM...", normalizedKey);
        var normalizedRequest = new ResolveAdvisoryRequest
        {
            ClassKey = normalizedKey,
            Crop = request.Crop.Trim(),
            Condition = request.Condition.Trim(),
            ScientificName = request.ScientificName?.Trim(),
            SeverityIndex = request.SeverityIndex?.Trim(),
            ForceRefresh = request.ForceRefresh
        };

        GeneratedAdvisoryPayload generated;
        try
        {
            generated = await _geminiClient.GenerateAdvisoryAsync(normalizedRequest, cancellationToken);
        }
        catch (LlmAdvisoryUnavailableException ex)
        {
            _logger.LogWarning(ex, "Gemini advisory generation unavailable for '{ClassKey}'.", normalizedKey);
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new ProblemDetails
            {
                Status = StatusCodes.Status503ServiceUnavailable,
                Title = "LLM advisory generation unavailable",
                Detail = ex.Message
            });
        }

        var now = DateTime.UtcNow;
        var treatmentsJson = JsonSerializer.Serialize(generated.RecommendedTreatments);

        var existingTracked = request.ForceRefresh
            ? await _db.DiseaseAdvisories.FirstOrDefaultAsync(d => d.ClassKey == normalizedKey, cancellationToken)
            : null;

        DiseaseAdvisory persisted;
        if (existingTracked is not null)
        {
            existingTracked.Crop = normalizedRequest.Crop;
            existingTracked.Condition = normalizedRequest.Condition;
            existingTracked.ScientificName = normalizedRequest.ScientificName;
            existingTracked.Severity = normalizedRequest.SeverityIndex ?? "Medium";
            existingTracked.ImmediateAction = generated.ImmediateAction;
            existingTracked.RecommendedTreatmentsJson = treatmentsJson;
            existingTracked.MicroclimateRisk = generated.MicroclimateRisk;
            existingTracked.LlmModel = generated.ModelName;
            existingTracked.UpdatedAt = now;
            persisted = existingTracked;
        }
        else
        {
            persisted = new DiseaseAdvisory
            {
                ClassKey = normalizedKey,
                Crop = normalizedRequest.Crop,
                Condition = normalizedRequest.Condition,
                ScientificName = normalizedRequest.ScientificName,
                Severity = normalizedRequest.SeverityIndex ?? "Medium",
                ImmediateAction = generated.ImmediateAction,
                RecommendedTreatmentsJson = treatmentsJson,
                MicroclimateRisk = generated.MicroclimateRisk,
                LlmModel = generated.ModelName,
                CreatedAt = now,
                UpdatedAt = now
            };
            _db.DiseaseAdvisories.Add(persisted);
        }

        try
        {
            await _db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException ex) when (IsUniqueConstraintViolation(ex))
        {
            // Another concurrent request populated this class_key first; return the persisted row.
            _db.Entry(persisted).State = EntityState.Detached;
            var winner = await _db.DiseaseAdvisories
                .AsNoTracking()
                .FirstOrDefaultAsync(d => d.ClassKey == normalizedKey, cancellationToken);
            if (winner is not null)
            {
                _logger.LogInformation("Concurrent insert resolved from DB cache for '{ClassKey}'.", normalizedKey);
                return Ok(ToDto(winner, "database_cache"));
            }
            throw;
        }

        _logger.LogInformation("Persisted LLM advisory in DB for '{ClassKey}' using model '{Model}'.",
            normalizedKey, generated.ModelName);

        return Ok(ToDto(persisted, "llm_generated"));
    }

    [HttpDelete("{**classKey}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteAdvisory(
        string classKey,
        CancellationToken cancellationToken)
    {
        var normalizedKey = NormalizeClassKey(classKey);
        if (string.IsNullOrEmpty(normalizedKey))
            return BadRequest(new { message = "class_key is required." });

        var existing = await _db.DiseaseAdvisories
            .FirstOrDefaultAsync(d => d.ClassKey == normalizedKey, cancellationToken);

        if (existing is null)
            return NotFound(new { message = $"No cached advisory found for '{normalizedKey}'." });

        _db.DiseaseAdvisories.Remove(existing);
        await _db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    private static string NormalizeClassKey(string? raw) =>
        (raw ?? string.Empty).Trim().ToLowerInvariant();

    private static bool IsUniqueConstraintViolation(DbUpdateException ex) =>
        ex.InnerException is PostgresException pg && pg.SqlState == PostgresErrorCodes.UniqueViolation;

    private static AdvisoryResponseDto ToDto(DiseaseAdvisory entity, string source)
    {
        IReadOnlyList<string> treatments;
        try
        {
            treatments = JsonSerializer.Deserialize<string[]>(entity.RecommendedTreatmentsJson)
                ?? Array.Empty<string>();
        }
        catch (JsonException)
        {
            treatments = Array.Empty<string>();
        }

        return new AdvisoryResponseDto
        {
            ClassKey = entity.ClassKey,
            Crop = entity.Crop,
            Condition = entity.Condition,
            ScientificName = entity.ScientificName,
            SeverityIndex = entity.Severity,
            ImmediateAction = entity.ImmediateAction,
            RecommendedTreatments = treatments,
            MicroclimateRisk = entity.MicroclimateRisk,
            Source = source,
            LlmModel = entity.LlmModel,
            CachedAt = entity.UpdatedAt
        };
    }
}
