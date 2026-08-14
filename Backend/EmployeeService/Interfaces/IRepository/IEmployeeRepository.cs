using EmployeeService.Models;

namespace EmployeeService.Interfaces.IRepository;

public interface IEmployeeRepository
{
    Task<List<Employee>> GetAllAsync();

    Task<Employee?> GetByIdAsync(Guid id);

    Task<Employee> CreateAsync(Employee employee);

    Task<Employee?> UpdateAsync(Guid id, Employee employee);

    Task<bool> DeleteAsync(Guid id);
}