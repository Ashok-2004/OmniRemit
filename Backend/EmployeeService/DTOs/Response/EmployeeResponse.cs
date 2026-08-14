namespace EmployeeService.DTOs.Responses;

public class EmployeeResponse
{
    public Guid Id { get; set; }

    public string Name { get; set; } = string.Empty;

    public string Email { get; set; } = string.Empty;

    public string Department { get; set; } = string.Empty;

    public decimal Salary { get; set; }

    public Guid RoleId { get; set; }

    public DateTime CreatedAt { get; set; }
}