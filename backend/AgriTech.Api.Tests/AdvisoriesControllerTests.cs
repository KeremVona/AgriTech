using AgriTech.Api.Controllers;
using AgriTech.Api.Data;
using AgriTech.Api.Models;
using AgriTech.Api.Models.DTOs;
using AgriTech.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace AgriTech.Api.Tests;

public class AdvisoriesControllerTests
{
    private sealed class FakeGeminiClient : IGeminiAdvisoryClient
    {
        private readonly Func<ResolveAdvisoryRequest, GeneratedAdvisoryPayload> _handler;
        public int CallCount { get; private set; }

        public FakeGeminiClient(Func<ResolveAdvisoryRequest, GeneratedAdvisoryPayload> handler)
        {
            _handler = handler;
        }

        public Task<GeneratedAdvisoryPayload> GenerateAdvisoryAsync(
            ResolveAdvisoryRequest request,
            CancellationToken cancellationToken = default)
        {
            CallCount++;
            return Task.FromResult(_handler(request));
        }
    }

    private static AgriTechDbContext CreateInMemoryContext()
    {
        var options = new DbContextOptionsBuilder<AgriTechDbContext>()
            .UseInMemoryDatabase($"advisories-test-{Guid.NewGuid()}")
            .Options;
        return new AgriTechDbContext(options);
    }

    [Fact]
    public async Task ResolveAdvisory_CacheHit_ReturnsDatabaseRecordWithoutCallingLlm()
    {
        await using var db = CreateInMemoryContext();
        db.DiseaseAdvisories.Add(new DiseaseAdvisory
        {
            ClassKey = "tomato/late_blight",
            Crop = "Tomato",
            Condition = "Late Blight",
            ScientificName = "Phytophthora infestans",
            Severity = "High",
            ImmediateAction = "Cached immediate action.",
            RecommendedTreatmentsJson = "[\"Cached Copper Spray\"]",
            MicroclimateRisk = "Cached humidity >90%.",
            LlmModel = "gemini-2.5-flash"
        });
        await db.SaveChangesAsync();

        var fakeLlm = new FakeGeminiClient(_ => throw new InvalidOperationException("LLM should not be called on cache hit"));
        var controller = new AdvisoriesController(db, fakeLlm, NullLogger<AdvisoriesController>.Instance);

        var actionResult = await controller.ResolveAdvisory(new ResolveAdvisoryRequest
        {
            ClassKey = "tomato/late_blight",
            Crop = "Tomato",
            Condition = "Late Blight"
        }, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(actionResult.Result);
        var dto = Assert.IsType<AdvisoryResponseDto>(ok.Value);
        Assert.Equal(0, fakeLlm.CallCount);
        Assert.Equal("database_cache", dto.Source);
        Assert.Equal("Cached immediate action.", dto.ImmediateAction);
        Assert.Equal(new[] { "Cached Copper Spray" }, dto.RecommendedTreatments);
        Assert.Equal("Cached humidity >90%.", dto.MicroclimateRisk);
    }

    [Fact]
    public async Task ResolveAdvisory_CacheMiss_CallsLlmPersistsAndSubsequentCallUsesCache()
    {
        await using var db = CreateInMemoryContext();
        var fakeLlm = new FakeGeminiClient(req => new GeneratedAdvisoryPayload(
            $"Isolate {req.Crop} plants immediately.",
            new[] { "Apply Copper Hydroxide 77% WP", "Apply Mancozeb 80% WP" },
            "High risk above 90% RH at 15-22C.",
            "gemini-2.5-flash"));

        var controller = new AdvisoriesController(db, fakeLlm, NullLogger<AdvisoriesController>.Instance);

        var firstResult = await controller.ResolveAdvisory(new ResolveAdvisoryRequest
        {
            ClassKey = "tomato/late_blight",
            Crop = "Tomato",
            Condition = "Late Blight",
            ScientificName = "Phytophthora infestans",
            SeverityIndex = "High"
        }, CancellationToken.None);

        var firstOk = Assert.IsType<OkObjectResult>(firstResult.Result);
        var firstDto = Assert.IsType<AdvisoryResponseDto>(firstOk.Value);
        Assert.Equal("llm_generated", firstDto.Source);
        Assert.Equal(1, fakeLlm.CallCount);
        Assert.Equal(1, await db.DiseaseAdvisories.CountAsync());

        var secondResult = await controller.ResolveAdvisory(new ResolveAdvisoryRequest
        {
            ClassKey = "tomato/late_blight",
            Crop = "Tomato",
            Condition = "Late Blight"
        }, CancellationToken.None);

        var secondOk = Assert.IsType<OkObjectResult>(secondResult.Result);
        var secondDto = Assert.IsType<AdvisoryResponseDto>(secondOk.Value);
        Assert.Equal("database_cache", secondDto.Source);
        Assert.Equal(1, fakeLlm.CallCount);
        Assert.Equal("Isolate Tomato plants immediately.", secondDto.ImmediateAction);
    }

    [Fact]
    public async Task ResolveAdvisory_NormalizesClassKeyCasingAndWhitespace()
    {
        await using var db = CreateInMemoryContext();
        db.DiseaseAdvisories.Add(new DiseaseAdvisory
        {
            ClassKey = "potato/early_blight",
            Crop = "Potato",
            Condition = "Early Blight",
            Severity = "Medium",
            ImmediateAction = "Prune lower leaves.",
            RecommendedTreatmentsJson = "[\"Chlorothalonil\"]",
            MicroclimateRisk = "Warm 24-29C.",
            LlmModel = "gemini-2.5-flash"
        });
        await db.SaveChangesAsync();

        var fakeLlm = new FakeGeminiClient(_ => throw new InvalidOperationException("Should hit normalized cache key"));
        var controller = new AdvisoriesController(db, fakeLlm, NullLogger<AdvisoriesController>.Instance);

        var result = await controller.ResolveAdvisory(new ResolveAdvisoryRequest
        {
            ClassKey = "  Potato/Early_Blight  ",
            Crop = "Potato",
            Condition = "Early Blight"
        }, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var dto = Assert.IsType<AdvisoryResponseDto>(ok.Value);
        Assert.Equal("potato/early_blight", dto.ClassKey);
        Assert.Equal("database_cache", dto.Source);
        Assert.Equal(0, fakeLlm.CallCount);
    }

    [Fact]
    public async Task ResolveAdvisory_WhenLlmUnavailableOnMiss_Returns503AndDoesNotPersist()
    {
        await using var db = CreateInMemoryContext();
        var fakeLlm = new FakeGeminiClient(_ => throw new LlmAdvisoryUnavailableException("API key missing"));
        var controller = new AdvisoriesController(db, fakeLlm, NullLogger<AdvisoriesController>.Instance);

        var result = await controller.ResolveAdvisory(new ResolveAdvisoryRequest
        {
            ClassKey = "tomato/late_blight",
            Crop = "Tomato",
            Condition = "Late Blight"
        }, CancellationToken.None);

        var obj = Assert.IsType<ObjectResult>(result.Result);
        Assert.Equal(503, obj.StatusCode);
        Assert.Equal(0, await db.DiseaseAdvisories.CountAsync());
    }

    [Fact]
    public async Task ResolveAdvisory_InvalidClassKey_Returns400()
    {
        await using var db = CreateInMemoryContext();
        var fakeLlm = new FakeGeminiClient(_ => throw new InvalidOperationException("Should reject invalid key"));
        var controller = new AdvisoriesController(db, fakeLlm, NullLogger<AdvisoriesController>.Instance);

        var result = await controller.ResolveAdvisory(new ResolveAdvisoryRequest
        {
            ClassKey = "invalid-key-without-slash",
            Crop = "Tomato",
            Condition = "Late Blight"
        }, CancellationToken.None);

        var bad = Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.Equal(400, bad.StatusCode);
        Assert.Equal(0, fakeLlm.CallCount);
    }

    [Fact]
    public async Task ResolveAdvisory_ForceRefresh_UpdatesExistingRow()
    {
        await using var db = CreateInMemoryContext();
        db.DiseaseAdvisories.Add(new DiseaseAdvisory
        {
            ClassKey = "tomato/late_blight",
            Crop = "Tomato",
            Condition = "Late Blight",
            Severity = "High",
            ImmediateAction = "Old action.",
            RecommendedTreatmentsJson = "[\"Old spray\"]",
            MicroclimateRisk = "Old risk.",
            LlmModel = "gemini-2.5-flash"
        });
        await db.SaveChangesAsync();

        var fakeLlm = new FakeGeminiClient(_ => new GeneratedAdvisoryPayload(
            "Refreshed action.",
            new[] { "Refreshed spray" },
            "Refreshed risk.",
            "gemini-2.5-flash"));
        var controller = new AdvisoriesController(db, fakeLlm, NullLogger<AdvisoriesController>.Instance);

        var result = await controller.ResolveAdvisory(new ResolveAdvisoryRequest
        {
            ClassKey = "tomato/late_blight",
            Crop = "Tomato",
            Condition = "Late Blight",
            SeverityIndex = "   ",
            ForceRefresh = true
        }, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var dto = Assert.IsType<AdvisoryResponseDto>(ok.Value);
        Assert.Equal(1, fakeLlm.CallCount);
        Assert.Equal("llm_generated", dto.Source);
        Assert.Equal("Refreshed action.", dto.ImmediateAction);
        Assert.Equal("Medium", dto.SeverityIndex);
        Assert.Equal(1, await db.DiseaseAdvisories.CountAsync());
    }

    [Fact]
    public async Task GetAndDeleteAdvisory_HandleHitMissAndInvalidKey()
    {
        await using var db = CreateInMemoryContext();
        db.DiseaseAdvisories.Add(new DiseaseAdvisory
        {
            ClassKey = "corn/common_rust",
            Crop = "Corn",
            Condition = "Common Rust",
            Severity = "Low",
            ImmediateAction = "Monitor pustules.",
            RecommendedTreatmentsJson = "[\"Triazole foliar spray\"]",
            MicroclimateRisk = "Cool 16-23C with heavy dew.",
            LlmModel = "gemini-2.5-flash"
        });
        await db.SaveChangesAsync();

        var fakeLlm = new FakeGeminiClient(_ => throw new InvalidOperationException("Unused"));
        var controller = new AdvisoriesController(db, fakeLlm, NullLogger<AdvisoriesController>.Instance);

        var getHit = await controller.GetAdvisory("Corn/Common_Rust", CancellationToken.None);
        var ok = Assert.IsType<OkObjectResult>(getHit.Result);
        var dto = Assert.IsType<AdvisoryResponseDto>(ok.Value);
        Assert.Equal("corn/common_rust", dto.ClassKey);

        var getMiss = await controller.GetAdvisory("apple/scab", CancellationToken.None);
        Assert.IsType<NotFoundObjectResult>(getMiss.Result);

        var getBad = await controller.GetAdvisory("bad key!", CancellationToken.None);
        Assert.IsType<BadRequestObjectResult>(getBad.Result);

        var delOk = await controller.DeleteAdvisory("corn/common_rust", CancellationToken.None);
        Assert.IsType<NoContentResult>(delOk);
        Assert.Equal(0, await db.DiseaseAdvisories.CountAsync());

        var delMiss = await controller.DeleteAdvisory("corn/common_rust", CancellationToken.None);
        Assert.IsType<NotFoundObjectResult>(delMiss);
    }
}
