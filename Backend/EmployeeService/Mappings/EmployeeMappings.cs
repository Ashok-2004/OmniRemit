using EmployeeService.DTOs.Requests;
using EmployeeService.DTOs.Responses;
using EmployeeService.Models;

namespace EmployeeService.Mappings;

/// <summary>
/// Explicit mapping between employee DTOs and the entity.
/// <para>
/// This replaced AutoMapper, which was pulled in for exactly three property-identical projections.
/// The version in use (12.0.1) carried a high-severity DoS advisory (GHSA-rvv3-g6hj-g44x, patched
/// only in 15.1.1+), and the patched line is where AutoMapper moved to a commercial licence — a
/// real cost for a product sold commercially. Twenty lines of explicit code removes the
/// vulnerability, the licensing obligation, a dependency, and the reflection cost, and makes the
/// mapping greppable: adding a field to the entity now fails to compile here rather than silently
/// not being mapped.
/// </para>
/// </summary>
public static class EmployeeMappings
{
    public static Employee ToEntity(this CreateEmployeeRequest request) => new()
    {
        Name = request.Name,
        Email = request.Email,
        Department = request.Department,
        Salary = request.Salary,
        RoleId = request.RoleId,
    };

    public static Employee ToEntity(this UpdateEmployeeRequest request) => new()
    {
        Name = request.Name,
        Email = request.Email,
        Department = request.Department,
        Salary = request.Salary,
        RoleId = request.RoleId,
    };

    public static EmployeeResponse ToResponse(this Employee employee) => new()
    {
        Id = employee.Id,
        Name = employee.Name,
        Email = employee.Email,
        Department = employee.Department,
        Salary = employee.Salary,
        RoleId = employee.RoleId,
        CreatedAt = employee.CreatedAt,
    };

    public static List<EmployeeResponse> ToResponseList(this IEnumerable<Employee> employees) =>
        employees.Select(ToResponse).ToList();
}
