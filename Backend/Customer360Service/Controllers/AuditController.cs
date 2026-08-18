using System;
using System.Collections.Generic;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using backend.Data;
using backend.Infrastructure.Security;
using backend.Models;

namespace backend.Controllers
{
    [Authorize]
    [ApiController]
    [Route("v1")]
    [RequiresCapability("audit", "View")]
    public class AuditController : ControllerBase
    {
        private readonly AuditRepository _auditRepository;

        public AuditController(AuditRepository auditRepository)
        {
            _auditRepository = auditRepository;
        }

        // POST /v1/audit
        [HttpPost("audit")]
        [HttpPost("auditlog")]
        public IActionResult CreateAuditLog([FromBody] AuditLogInput input)
        {
            var staffUser = GetAuthenticatedUser();

            var auditLog = new AuditLog
            {
                User = staffUser,
                Action = input.Action ?? "VIEW",
                Description = input.Description ?? string.Empty,
                Status = input.Status ?? "Success",
                CustomerName = input.Customer,
                CustomerType = input.CustomerType,
                CustomerId = input.CustomerId,
                Field = input.Field,
                Timestamp = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")
            };

            _auditRepository.Add(auditLog);

            return Ok(new
            {
                status = 200,
                message = "Audit log recorded successfully."
            });
        }

        // GET /v1/audit
        [HttpGet("audit")]
        [HttpGet("auditlog")]
        public IActionResult GetAuditLogs(
            [FromQuery] string? search,
            [FromQuery] string? action,
            [FromQuery] int pageNumber = 1,
            [FromQuery] int pageSize = 10)
        {
            int totalCount;
            var logs = _auditRepository.Get(search, action, pageNumber, pageSize, out totalCount);
            int totalPages = (int)Math.Ceiling((double)totalCount / pageSize);
            if (totalPages < 1) totalPages = 1;

            return Ok(new
            {
                status = 200,
                data = logs,
                pageNumber = pageNumber,
                pageSize = pageSize,
                totalCount = totalCount,
                totalPages = totalPages
            });
        }

        private string GetAuthenticatedUser()
        {
            // 1. Check custom header (useful for client/standalone integrations or testing)
            if (Request.Headers.TryGetValue("X-Staff-User", out var staffUser) && !string.IsNullOrEmpty(staffUser))
            {
                return staffUser.ToString();
            }

            // 2. Check JWT name claim
            if (User.Identity != null && User.Identity.IsAuthenticated)
            {
                var nameClaim = User.FindFirst(ClaimTypes.Name)?.Value;
                if (!string.IsNullOrEmpty(nameClaim) && nameClaim != "omniconnect-app")
                {
                    return nameClaim;
                }

                // Fallbacks to typical sub / email / unique_name claims
                var subClaim = User.FindFirst("sub")?.Value;
                if (!string.IsNullOrEmpty(subClaim)) return subClaim;

                var emailClaim = User.FindFirst(ClaimTypes.Email)?.Value;
                if (!string.IsNullOrEmpty(emailClaim)) return emailClaim;
            }

            // 3. Fallback
            return "Admin User";
        }
    }

    public class AuditLogInput
    {
        public string? Action { get; set; }
        public string? Customer { get; set; }
        public string? CustomerType { get; set; }
        public string? Field { get; set; }
        public string? Status { get; set; }
        public string? Description { get; set; }
        public string? CustomerId { get; set; }
    }
}
