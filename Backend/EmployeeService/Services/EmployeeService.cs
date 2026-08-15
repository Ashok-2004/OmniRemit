using EmployeeService.DTOs.Requests;
using EmployeeService.DTOs.Responses;
using EmployeeService.Infrastructure;
using EmployeeService.Mappings;
using EmployeeService.Interfaces.IRepository;
using EmployeeService.Interfaces.IServices;

namespace EmployeeService.Services;

public class EmployeeService : IEmployeeService
{
    private readonly IEmployeeRepository _repository;
    private readonly AuthServiceClient _auditLog;

    public EmployeeService(
        IEmployeeRepository repository,
        AuthServiceClient auditLog)
    {
        _repository = repository;
        _auditLog = auditLog;
    }

    public async Task<EmployeeListResult> GetPagedAsync(EmployeeQuery query)
    {
        var (employees, total, departmentCount, averageSalary) = await _repository.GetPagedAsync(query);

        return new EmployeeListResult(
            employees.ToResponseList(),
            total,
            query.Page,
            query.PageSize,
            departmentCount,
            averageSalary);
    }

    public async Task<EmployeeResponse> CreateAsync(CreateEmployeeRequest request, Guid? actorUserId, string? actorName)
    {
        var created = await _repository.CreateAsync(request.ToEntity());

        await _auditLog.PushAuditLogAsync(
            "employee.created", "Employee", created.Id.ToString(),
            $"Created employee '{created.Name}' ({created.Email}).", actorUserId, actorName);

        return created.ToResponse();
    }

    public async Task<EmployeeResponse?> GetByIdAsync(Guid id)
    {
        var employee = await _repository.GetByIdAsync(id);
        return employee?.ToResponse();
    }

    public async Task<EmployeeResponse?> UpdateAsync(Guid id, UpdateEmployeeRequest request, Guid? actorUserId, string? actorName)
    {
        var updated = await _repository.UpdateAsync(id, request.ToEntity());
        if (updated == null) return null;

        await _auditLog.PushAuditLogAsync(
            "employee.updated", "Employee", updated.Id.ToString(),
            $"Updated employee '{updated.Name}' ({updated.Email}).", actorUserId, actorName);

        return updated.ToResponse();
    }

    public async Task<bool> DeleteAsync(Guid id, Guid? actorUserId, string? actorName)
    {
        var existing = await _repository.GetByIdAsync(id);
        if (existing == null) return false;

        var deleted = await _repository.DeleteAsync(id);
        if (!deleted) return false;

        await _auditLog.PushAuditLogAsync(
            "employee.deleted", "Employee", id.ToString(),
            $"Removed employee '{existing.Name}' ({existing.Email}).", actorUserId, actorName);

        return true;
    }
}
