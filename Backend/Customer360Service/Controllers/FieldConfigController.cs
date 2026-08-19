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

            var updated = await _service.ReplaceAsync(parsed, fields);
            return Ok(new { status = 200, data = updated });
        }

        private static bool TryParseProfileType(string raw, out ProfileType profileType)
        {
            return Enum.TryParse(raw, ignoreCase: true, out profileType);
        }
    }
}
