using AutoMapper;
using EmployeeService.DTOs.Requests;
using EmployeeService.DTOs.Responses;
using EmployeeService.Infrastructure;
using EmployeeService.Models;
using EmployeeService.Interfaces.IRepository;
using EmployeeService.Interfaces.IServices;

namespace EmployeeService.Services;

public class EmployeeService : IEmployeeService
{
    private readonly IEmployeeRepository _repository;
    private readonly IMapper _mapper;
    private readonly AuthServiceClient _auditLog;

    public EmployeeService(
        IEmployeeRepository repository,
        IMapper mapper,
        AuthServiceClient auditLog)
    {
        _repository = repository;
        _mapper = mapper;
        _auditLog = auditLog;
    }

    public async Task<List<EmployeeResponse>> GetAllAsync()
    {
        var employees = await _repository.GetAllAsync();

        return _mapper.Map<List<EmployeeResponse>>(employees);
    }

    public async Task<EmployeeResponse> CreateAsync(CreateEmployeeRequest request, Guid? actorUserId, string? actorName)
    {
        var employee = _mapper.Map<Employee>(request);
        var created = await _repository.CreateAsync(employee);

        await _auditLog.PushAuditLogAsync(
            "employee.created", "Employee", created.Id.ToString(),
            $"Created employee '{created.Name}' ({created.Email}).", actorUserId, actorName);

        return _mapper.Map<EmployeeResponse>(created);
    }

    public async Task<EmployeeResponse?> GetByIdAsync(Guid id)
    {
        var employee = await _repository.GetByIdAsync(id);
        if (employee == null) return null;
        return _mapper.Map<EmployeeResponse>(employee);
    }

    public async Task<EmployeeResponse?> UpdateAsync(Guid id, UpdateEmployeeRequest request, Guid? actorUserId, string? actorName)
    {
        var employee = _mapper.Map<Employee>(request);
        var updated = await _repository.UpdateAsync(id, employee);
        if (updated == null) return null;

        await _auditLog.PushAuditLogAsync(
            "employee.updated", "Employee", updated.Id.ToString(),
            $"Updated employee '{updated.Name}' ({updated.Email}).", actorUserId, actorName);

        return _mapper.Map<EmployeeResponse>(updated);
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
