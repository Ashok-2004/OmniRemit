using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers
{
    [ApiController]
    public class HealthController(IConfiguration configuration) : ControllerBase
    {
        // GET /health
        // Lightweight liveness endpoint for load balancers and monitoring systems.
        // Does NOT perform CRM connectivity checks (avoids generating traffic against the real CRM
        // API on every probe) or expose secrets, configuration values, or customer data.
        //
        // It DOES verify the service can actually do its job: this service has no database, so its
        // only real dependency is being configured at all. Previously this endpoint returned a fixed
        // {"status":"healthy"} regardless of configuration — a load balancer would route traffic to an
        // instance that could never successfully answer a single request. This is not a network check
        // (still no CRM call), just a check that the required settings are present.
        [HttpGet("health")]
        public IActionResult GetHealth()
        {
            var missing = new List<string>();

            if (string.IsNullOrWhiteSpace(configuration["CrmApi:BaseUrl"])) missing.Add("CrmApi:BaseUrl");
            if (string.IsNullOrWhiteSpace(configuration["CrmApi:ClientId"])) missing.Add("CrmApi:ClientId");
            if (string.IsNullOrWhiteSpace(configuration["CrmApi:ClientSecret"])) missing.Add("CrmApi:ClientSecret");
            if (string.IsNullOrWhiteSpace(configuration["Jwt:SigningKeyPublic"])) missing.Add("Jwt:SigningKeyPublic");

            if (missing.Count > 0)
            {
                return StatusCode(503, new { status = "unhealthy", missingConfiguration = missing });
            }

            return Ok(new { status = "healthy" });
        }
    }
}
