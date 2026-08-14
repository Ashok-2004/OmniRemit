using EmployeeService.Data;
using EmployeeService.Models;
using EmployeeService.Interfaces.IRepository;
using Microsoft.EntityFrameworkCore;

namespace EmployeeService.Repositories;

public class EmployeeRepository : IEmployeeRepository
{
    private readonly AppDbContext _context;

    public EmployeeRepository(AppDbContext context)
    {
        _context = context;
    }

    public async Task<List<Employee>> GetAllAsync()
    {
        return await _context.Employees.ToListAsync();
    }

    public async Task<Employee> CreateAsync(Employee employee)
    {
        _context.Employees.Add(employee);
        await _context.SaveChangesAsync();
        return employee;
    }

    public async Task<Employee?> GetByIdAsync(Guid id)
    {
        return await _context.Employees.FindAsync(id);
    }

    public async Task<Employee?> UpdateAsync(Guid id, Employee employee)
    {
        var existing = await _context.Employees.FindAsync(id);
        if (existing == null) return null;

        existing.Name = employee.Name;
        existing.Email = employee.Email;
        existing.Department = employee.Department;
        existing.Salary = employee.Salary;

        await _context.SaveChangesAsync();
        return existing;
    }

    public async Task<bool> DeleteAsync(Guid id)
    {
        var existing = await _context.Employees.FindAsync(id);
        if (existing == null) return false;

        _context.Employees.Remove(existing);
        await _context.SaveChangesAsync();
        return true;
    }
}