using EmployeeService.DTOs.Requests;
using EmployeeService.Models;

namespace EmployeeService.Interfaces.IRepository;

public interface IEmployeeRepository
{
    /// <summary>Returns one page of employees plus real aggregates over the whole filtered set, all computed server-side.</summary>
    Task<(List<Employee> Items, int Total, int DepartmentCount, decimal AverageSalary)> GetPagedAsync(EmployeeQuery query);

    Task<Employee?> GetByIdAsync(Guid id);

    Task<Employee> CreateAsync(Employee employee);

    Task<Employee?> UpdateAsync(Guid id, Employee employee);

    Task<bool> DeleteAsync(Guid id);
}