using AgriTech.Api.Models;
using Xunit;

namespace AgriTech.Api.Tests;

public class WeatherCacheTests
{
    [Theory]
    [InlineData(0.00, 0.00)]
    [InlineData(2.50, 0.00)]
    [InlineData(5.00, 0.00)]
    [InlineData(6.00, 0.75)]
    [InlineData(9.00, 3.00)]
    [InlineData(13.00, 6.00)]
    [InlineData(25.40, 15.30)]
    public void CalculateEffectivePrecipitation_ComputesFao56RunoffFormulaCorrectly(
        decimal precipitationMm,
        decimal expectedEffectiveMm)
    {
        // Act
        var result = WeatherCache.CalculateEffectivePrecipitation(precipitationMm);

        // Assert
        Assert.Equal(expectedEffectiveMm, result);
    }

    [Fact]
    public void WeatherCache_Instantiation_HasDefaults()
    {
        // Act
        var weather = new WeatherCache();

        // Assert
        Assert.NotEqual(Guid.Empty, weather.Id);
        Assert.False(weather.IsForecast);
        Assert.True(weather.IngestedAt <= DateTime.UtcNow);
    }
}
