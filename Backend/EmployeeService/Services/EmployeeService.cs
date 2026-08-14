using AutoMapper;
using EmployeeService.DTOs.Requests;
using EmployeeService.DTOs.Responses;
using EmployeeService.Models;
using EmployeeService.Interfaces.IRepository;
using EmployeeService.Interfaces.IServices;

namespace EmployeeService.Services;

public class EmployeeService : IEmployeeService
{
    private readonly IEmployeeRepository _repository;

    private readonly IMapper _mapper;

    public EmployeeService(
        IEmployeeRepository repository,
        IMapper mapper)
    {
        _repository = repository;
        _mapper = mapper;
    }

    public async Task<List<EmployeeResponse>> GetAllAsync()
    {
        var employees = await _repository.GetAllAsync();

        return _mapper.Map<List<EmployeeResponse>>(employees);
    }

    public async Task<EmployeeResponse> CreateAsync(
        CreateEmployeeRequest request)
    {
        var employee = _mapper.Map<Employee>(request);
        var created = await _repository.CreateAsync(employee);
        return _mapper.Map<EmployeeResponse>(created);
    }

    public async Task<EmployeeResponse?> GetByIdAsync(Guid id)
    {
        var employee = await _repository.GetByIdAsync(id);
        if (employee == null) return null;
        return _mapper.Map<EmployeeResponse>(employee);
    }

    public async Task<EmployeeResponse?> UpdateAsync(Guid id, UpdateEmployeeRequest request)
    {
        var employee = _mapper.Map<Employee>(request);
        var updated = await _repository.UpdateAsync(id, employee);
        if (updated == null) return null;
        return _mapper.Map<EmployeeResponse>(updated);
    }

    public async Task<bool> DeleteAsync(Guid id)
    {
        return await _repository.DeleteAsync(id);
    }
}