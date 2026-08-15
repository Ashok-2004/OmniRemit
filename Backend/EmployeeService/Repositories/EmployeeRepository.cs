using EmployeeService.Data;
using EmployeeService.DTOs.Requests;
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

    public async Task<(List<Employee> Items, int Total, int DepartmentCount, decimal AverageSalary)> GetPagedAsync(EmployeeQuery query)
    {
        // AsNoTracking: this is a read path, so the change tracker's snapshots are pure overhead.
        var employees = _context.Employees.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var term = query.Search.Trim().ToLower();
            employees = employees.Where(e =>
                e.Name.ToLower().Contains(term) ||
                e.Email.ToLower().Contains(term) ||
                e.Department.ToLower().Contains(term));
        }

        // Count before paging, on the filtered set, so the client can render a correct page count.
        var total = await employees.CountAsync();

        // Real aggregates over the whole filtered set, not just the page being returned. Computed as
        // server-side aggregates so no rows are materialised to produce them.
        var departmentCount = await employees.Select(e => e.Department).Distinct().CountAsync();
        var averageSalary = total == 0 ? 0m : await employees.AverageAsync(e => e.Salary);

        // Sort by an allow-listed column only — never interpolate a caller-supplied column name into
        // the query. Ties are broken by Id so paging is stable: without a unique tiebreaker, two rows
        // with equal sort keys can swap between pages and a row is silently skipped or duplicated.
        employees = (query.SortBy?.ToLowerInvariant(), query.SortDesc) switch
        {
            ("email", false) => employees.OrderBy(e => e.Email).ThenBy(e => e.Id),
            ("email", true) => employees.OrderByDescending(e => e.Email).ThenBy(e => e.Id),
            ("department", false) => employees.OrderBy(e => e.Department).ThenBy(e => e.Id),
            ("department", true) => employees.OrderByDescending(e => e.Department).ThenBy(e => e.Id),
            ("salary", false) => employees.OrderBy(e => e.Salary).ThenBy(e => e.Id),
            ("salary", true) => employees.OrderByDescending(e => e.Salary).ThenBy(e => e.Id),
            (_, true) => employees.OrderByDescending(e => e.Name).ThenBy(e => e.Id),
            _ => employees.OrderBy(e => e.Name).ThenBy(e => e.Id),
        };

        var items = await employees
            .Skip((query.Page - 1) * query.PageSize)
            .Take(query.PageSize)
            .ToListAsync();

        return (items, total, departmentCount, averageSalary);
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
        // RoleId was silently dropped here: UpdateEmployeeRequest carries it and callers could set
        // it, but the update never copied it across, so the change appeared to succeed and did
        // nothing.
        existing.RoleId = employee.RoleId;

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