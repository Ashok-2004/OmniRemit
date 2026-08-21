using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using backend.Data;
using backend.Infrastructure.Security;
using backend.Models;

namespace backend.Controllers
{
    /// <summary>
    /// Admin CRUD over the field-visibility/masking config the Customer 360 detail pages render
    /// from. "View" lets any capable user fetch the config to render a profile page; "Manage" is the
    /// separate write capability the new Field Settings admin screen requires — reusing the same
    /// [RequiresCapability] pattern every other controller in this service already uses, which
    /// PermissionsController automatically surfaces to the host's Role editor by reflection, no
    /// manual registration needed.
    /// </summary>
    [Authorize]
    [ApiController]
    [Route("v1/field-config")]
    public class FieldConfigController : ControllerBase
    {
        private readonly FieldConfigService _service;

        public FieldConfigController(FieldConfigService service)
        {
            _service = service;
        }

        // GET /v1/field-config/individual
        // GET /v1/field-config/corporate
        [HttpGet("{profileType}")]
        [RequiresCapability("fieldsettings", "View")]
        public async Task<IActionResult> Get(string profileType)
        {
            if (!TryParseProfileType(profileType, out var parsed))
            {
                return BadRequest(new { status = 400, message = "profileType must be 'individual' or 'corporate'." });
            }

            var fields = await _service.GetByProfileTypeAsync(parsed);
            return Ok(new { status = 200, data = fields });
        }

        // PUT /v1/field-config/individual
        // PUT /v1/field-config/corporate
        [HttpPut("{profileType}")]
        [RequiresCapability("fieldsettings", "Manage")]
        public async Task<IActionResult> Replace(string profileType, [FromBody] List<FieldConfig> fields)
        {
            if (!TryParseProfileType(profileType, out var parsed))
            {
                return BadRequest(new { status = 400, message = "profileType must be 'individual' or 'corporate'." });
            }

            if (fields == null || fields.Count == 0)
            {
                return BadRequest(new { status = 400, message = "At least one field is required." });
            }

            var outcome = await _service.ReplaceAsync(parsed, fields, CurrentUserId(), CurrentUserName(), bypassApproval: IsSuperAdmin());
            if (outcome.Pending is not null)
            {
                // Gated: nothing was changed. 202 Accepted — the request is understood and queued, not applied.
                return StatusCode(202, new { status = 202, data = outcome.Pending });
            }

            return Ok(new { status = 200, data = outcome.Applied });
        }

        private static bool TryParseProfileType(string raw, out ProfileType profileType)
        {
            return Enum.TryParse(raw, ignoreCase: true, out profileType);
        }

        private Guid? CurrentUserId()
        {
            var sub = User.FindFirst(JwtClaimTypes.Subject)?.Value;
            return Guid.TryParse(sub, out var id) ? id : null;
        }

        private string? CurrentUserName() => User.FindFirst(JwtClaimTypes.Name)?.Value;

        /// <summary>
        /// Super Admin bypass predicate for the Maker-Checker gate. Deliberately the strict
        /// single-claim check — the exact claim AuthService issues — not this service's wider
        /// [RequiresCapability] admin test, so the population that skips assignment is identical
        /// across every service that has one of these helpers.
        /// </summary>
        private bool IsSuperAdmin() => User.FindFirst(JwtClaimTypes.Administrator)?.Value == "true";
    }
}
