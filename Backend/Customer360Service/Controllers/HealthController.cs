using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers
{
    [ApiController]
    public class HealthController : ControllerBase
    {
        // GET /health
        // Lightweight liveness endpoint for load balancers and monitoring systems.
        // Does NOT perform CRM connectivity checks (avoids generating traffic).
        // Does NOT expose secrets, configuration, or customer data.
        [HttpGet("health")]
        public IActionResult GetHealth()
        {
            return Ok(new { status = "healthy" });
        }
    }
}
