using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using LeadManagement.Api.Infrastructure.Security;
using LeadManagement.Api.Models.Dtos;
using LeadManagement.Api.Services;

namespace LeadManagement.Api.Controllers
{
    [ApiController]
    [Route("api/auditlogs")]
    [Route("api/v1/auditlogs")]
    [Route("api/audit-logs")]
    [Route("api/v1/audit-logs")]
    [Authorize]
    public class AuditLogsController : ControllerBase
    {
        private readonly IAuditLogService _auditLogService;

        public AuditLogsController(IAuditLogService auditLogService)
        {
            _auditLogService = auditLogService;
        }

        [HttpGet]
        [RequiresCapability("AuditLog", "View")]
        public async Task<ActionResult<ApiResponseDto<PagedResultDto<AuditLogDto>>>> GetAuditLogs(
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 10,
            [FromQuery] string? search = null,
            [FromQuery] string? actionType = null,
            [FromQuery] string? entityId = null,
            [FromQuery] string? startDate = null,
            [FromQuery] string? endDate = null)
        {
            var result = await _auditLogService.GetAuditLogsAsync(page, pageSize, search, actionType, entityId, startDate, endDate);
            return Ok(new ApiResponseDto<PagedResultDto<AuditLogDto>>
            {
                Success = true,
                Data = result
            });
        }

        [HttpGet("{id}")]
        [RequiresCapability("AuditLog", "View")]
        public async Task<ActionResult<ApiResponseDto<AuditLogDto>>> GetAuditLogById(string id)
        {
            var log = await _auditLogService.GetAuditLogByIdAsync(id);
            if (log == null)
            {
                return NotFound(new ApiResponseDto<AuditLogDto>
                {
                    Success = false,
                    Message = $"Audit log with ID '{id}' was not found."
                });
            }

            return Ok(new ApiResponseDto<AuditLogDto>
            {
                Success = true,
                Data = log
            });
        }
    }
}
