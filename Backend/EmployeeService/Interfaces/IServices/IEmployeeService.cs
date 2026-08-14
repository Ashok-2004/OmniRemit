using EmployeeService.DTOs.Requests;
using EmployeeService.DTOs.Responses;

namespace EmployeeService.Interfaces.IServices;

public interface IEmployeeService
{
    Task<List<EmployeeResponse>> GetAllAsync();

    Task<EmployeeResponse?> GetByIdAsync(Guid id);

    Task<EmployeeResponse> CreateAsync(CreateEmployeeRequest request);

    Task<EmployeeResponse?> UpdateAsync(Guid id, UpdateEmployeeRequest request);

    Task<bool> DeleteAsync(Guid id);
}