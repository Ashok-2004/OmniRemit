using EmployeeService.Common;
using EmployeeService.DTOs.Requests;
using EmployeeService.Infrastructure.Security;
using EmployeeService.Interfaces.IServices;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EmployeeService.Controllers;

/// <summary>
/// Local, zero-network-call authorization — [Authorize] validates the RS256 JWT the same way
/// ModuleRegistry does, and [RequiresCapability] reads the `perms` claim already embedded in that
/// token at login. No per-request round trip to AuthService, which is what used to couple this
/// service's uptime and latency to AuthService's.
/// </summary>
[ApiController]
[Route("api/employees")]
[Authorize]
public class EmployeesController : ControllerBase
{
    private readonly IEmployeeService _service;

    public EmployeesController(IEmployeeService service)
    {
        _service = service;
    }

    [HttpGet]
    public async Task<IActionResult> GetEmployees()
    {
        var employees = await _service.GetAllAsync();

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Employees fetched successfully",
            Data = employees
        });
    }

    [HttpPost]
    [RequiresCapability("Create")]
    public async Task<IActionResult> CreateEmployee(CreateEmployeeRequest request)
    {
        var employee = await _service.CreateAsync(request, CurrentUserId(), CurrentUserName());

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Employee created successfully",
            Data = employee
        });
    }

    [HttpPut("{id}")]
    [RequiresCapability("Edit")]
    public async Task<IActionResult> UpdateEmployee(Guid id, UpdateEmployeeRequest request)
    {
        var employee = await _service.UpdateAsync(id, request, CurrentUserId(), CurrentUserName());
        if (employee == null) return NotFound(new ApiResponse<object> { Success = false, Message = "Employee not found" });

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Employee updated successfully",
            Data = employee
        });
    }

    [HttpDelete("{id}")]
    [RequiresCapability("Delete")]
    public async Task<IActionResult> DeleteEmployee(Guid id)
    {
        var success = await _service.DeleteAsync(id, CurrentUserId(), CurrentUserName());
        if (!success) return NotFound(new ApiResponse<object> { Success = false, Message = "Employee not found" });

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Employee deleted successfully"
        });
    }

    private Guid? CurrentUserId()
    {
        var sub = User.FindFirst(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub)?.Value;
        return Guid.TryParse(sub, out var id) ? id : null;
    }

    private string? CurrentUserName() =>
        User.FindFirst(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Name)?.Value;
}
