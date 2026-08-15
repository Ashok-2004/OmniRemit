using EmployeeService.DTOs.Requests;
using EmployeeService.DTOs.Responses;

namespace EmployeeService.Interfaces.IServices;

public interface IEmployeeService
{
    Task<EmployeeListResult> GetPagedAsync(EmployeeQuery query);

    Task<EmployeeResponse?> GetByIdAsync(Guid id);

    Task<EmployeeResponse> CreateAsync(CreateEmployeeRequest request, Guid? actorUserId, string? actorName);

    Task<EmployeeResponse?> UpdateAsync(Guid id, UpdateEmployeeRequest request, Guid? actorUserId, string? actorName);

    Task<bool> DeleteAsync(Guid id, Guid? actorUserId, string? actorName);
}
