using AgriTech.Api.Messaging;
using AgriTech.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace AgriTech.Api.Controllers;

/// <summary>
/// Typed OpenAPI contract describing the standardized Phase 3 MQTT topic taxonomy and valve action codes.
/// </summary>
public sealed record MqttTopicsContractDto(
    string TelemetryTemplate,
    string TelemetryWildcard,
    string ActuatorValveTemplate,
    string ActuatorValveWildcard,
    IReadOnlyList<string> ValveActions);

/// <summary>
/// Diagnostic endpoints exposing Eclipse Mosquitto MQTT broker connectivity, persistent wildcard
/// subscription state (agri/telemetry/#), and standardized messaging topic contracts (BACK-304).
/// Note: Protect with Admin/Operator authorization policy once authentication middleware is enabled in production.
/// </summary>
[ApiController]
[Route("api/v1/[controller]")]
[Produces("application/json")]
public class MqttController : ControllerBase
{
    private readonly IMqttClientService _mqttClientService;
    private readonly IHostEnvironment _environment;

    public MqttController(IMqttClientService mqttClientService, IHostEnvironment environment)
    {
        _mqttClientService = mqttClientService ?? throw new ArgumentNullException(nameof(mqttClientService));
        _environment = environment ?? throw new ArgumentNullException(nameof(environment));
    }

    /// <summary>
    /// Returns live connectivity, persistent session, and telemetry subscription status for the MQTT client.
    /// Internal broker topology (Host/Port) is redacted outside Development environments.
    /// </summary>
    [HttpGet("status")]
    [ProducesResponseType(typeof(MqttConnectionStatusDto), StatusCodes.Status200OK)]
    public ActionResult<MqttConnectionStatusDto> GetStatus()
    {
        var status = _mqttClientService.GetStatus();
        if (_environment.IsDevelopment())
        {
            return Ok(status);
        }

        return Ok(new MqttConnectionStatusDto
        {
            Enabled = status.Enabled,
            IsConnected = status.IsConnected,
            Host = "[redacted]",
            Port = 0,
            ClientId = status.ClientId,
            SubscribedTopic = status.SubscribedTopic,
            IsPersistentSession = status.IsPersistentSession,
            IsSubscribedToTelemetry = status.IsSubscribedToTelemetry,
            LastConnectedAtUtc = status.LastConnectedAtUtc,
            LastDisconnectedAtUtc = status.LastDisconnectedAtUtc,
            ReconnectAttempts = status.ReconnectAttempts,
            MessagesReceivedCount = status.MessagesReceivedCount,
            MessagesPublishedCount = status.MessagesPublishedCount,
            LastError = status.LastError
        });
    }

    /// <summary>
    /// Returns the standardized Phase 3 MQTT topic taxonomy and valve action contract constants.
    /// </summary>
    [HttpGet("topics")]
    [ProducesResponseType(typeof(MqttTopicsContractDto), StatusCodes.Status200OK)]
    public ActionResult<MqttTopicsContractDto> GetTopics()
    {
        return Ok(new MqttTopicsContractDto(
            TelemetryTemplate: "agri/telemetry/{parcelId}",
            TelemetryWildcard: MqttTopics.TelemetryWildcard,
            ActuatorValveTemplate: "agri/actuator/{parcelId}/valve",
            ActuatorValveWildcard: MqttTopics.ActuatorValveWildcard,
            ValveActions: new[]
            {
                ValveActionConstants.TriggerOpen,
                ValveActionConstants.TriggerClose
            }));
    }
}
