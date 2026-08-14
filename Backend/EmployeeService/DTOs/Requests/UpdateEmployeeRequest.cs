namespace EmployeeService.DTOs.Requests;

public class UpdateEmployeeRequest
{
    public string Name { get; set; } = string.Empty;

    public string Email { get; set; } = string.Empty;

    public string Department { get; set; } = string.Empty;

    public decimal Salary { get; set; }

    public Guid RoleId { get; set; }
}
