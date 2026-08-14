using EmployeeService.Common;
using EmployeeService.DTOs.Requests;
using EmployeeService.Interfaces.IServices;
using Microsoft.AspNetCore.Mvc;

namespace EmployeeService.Controllers;

[ApiController]
[Route("api/employees")]
public class EmployeesController : ControllerBase
{
    private readonly IEmployeeService _service;
    private readonly IConfiguration _configuration;

    public EmployeesController(IEmployeeService service, IConfiguration configuration)
    {
        _service = service;
        _configuration = configuration;
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
    public async Task<IActionResult> CreateEmployee(
        CreateEmployeeRequest request)
    {
        if (!await HasPermissionAsync("create_employee"))
            return StatusCode(403, new ApiResponse<object> { Success = false, Message = "Forbidden: Missing create_employee permission" });

        var employee = await _service.CreateAsync(request);

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Employee created successfully",
            Data = employee
        });
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateEmployee(
        Guid id, UpdateEmployeeRequest request)
    {
        if (!await HasPermissionAsync("edit_employee"))
            return StatusCode(403, new ApiResponse<object> { Success = false, Message = "Forbidden: Missing edit_employee permission" });

        var employee = await _service.UpdateAsync(id, request);
        if (employee == null) return NotFound(new ApiResponse<object> { Success = false, Message = "Employee not found" });

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Employee updated successfully",
            Data = employee
        });
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteEmployee(Guid id)
    {
        if (!await HasPermissionAsync("delete_employee"))
            return StatusCode(403, new ApiResponse<object> { Success = false, Message = "Forbidden: Missing delete_employee permission" });

        var success = await _service.DeleteAsync(id);
        if (!success) return NotFound(new ApiResponse<object> { Success = false, Message = "Employee not found" });

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Employee deleted successfully"
        });
    }

    private async Task<bool> HasPermissionAsync(string requiredAction)
    {
        var authHeader = Request.Headers["Authorization"].FirstOrDefault();
        if (string.IsNullOrEmpty(authHeader)) return false;

        var authApiUrl = _configuration["AuthApiUrl"] ?? "http://localhost:5005";

        using var client = new HttpClient();
        client.DefaultRequestHeaders.Add("Authorization", authHeader);

        var meRes = await client.GetAsync($"{authApiUrl}/api/auth/me");
        if (!meRes.IsSuccessStatusCode) return false;

        var meContent = await meRes.Content.ReadAsStringAsync();
        var user = System.Text.Json.JsonDocument.Parse(meContent).RootElement;
        if (!user.TryGetProperty("id", out var idProp)) return false;
        var userId = idProp.GetString();

        var permRes = await client.GetAsync($"{authApiUrl}/api/access/userpermissions/{userId}");
        if (!permRes.IsSuccessStatusCode) return false;

        var permContent = await permRes.Content.ReadAsStringAsync();
        var perms = System.Text.Json.JsonDocument.Parse(permContent).RootElement;

        foreach (var p in perms.EnumerateArray())
        {
            var modName = p.GetProperty("moduleName").GetString()?.ToLower();
            var action = p.GetProperty("action").GetString()?.ToLower();

            if ((modName == "employeemodule" || modName == "*") &&
                (action == requiredAction.ToLower() || action == "*"))
            {
                return true;
            }
        }
        return false;
    }
}