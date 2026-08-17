using EmployeeService.Common;
using EmployeeService.Data;
using EmployeeService.Infrastructure.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace EmployeeService.Controllers;

/// <summary>
/// Departments as a distinct sub-module, so access to the org structure can be granted separately
/// from access to individual employee records.
/// <para>
/// Its "Department" module and "View" capability appear in the host's Role editor automatically —
/// the discovery endpoint reflects over the attribute below. Nothing was registered by hand on the
/// host side to make that happen.
/// </para>
/// </summary>
[ApiController]
[Route("api/departments")]
[Authorize]
public class DepartmentsController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    [RequiresCapability("Department", "View")]
    public async Task<IActionResult> GetDepartments(CancellationToken ct)
    {
        // Departments are derived from real employee records rather than a separate table — the
        // headcount is a genuine COUNT, not a placeholder.
        var departments = await db.Employees
            .AsNoTracking()
            .Where(e => e.Department != string.Empty)
            .GroupBy(e => e.Department)
            .Select(g => new { name = g.Key, headcount = g.Count() })
            .OrderBy(d => d.name)
            .ToListAsync(ct);

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Departments fetched successfully",
            Data = departments,
        });
    }
}
