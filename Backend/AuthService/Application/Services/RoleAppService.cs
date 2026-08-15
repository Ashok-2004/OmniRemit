using AuthService.Application.DTOs;
using AuthService.Application.Exceptions;
using AuthService.Domain.Entities;
using AuthService.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace AuthService.Application.Services;

public class RoleAppService(AuthDbContext db, AuditLogAppService auditLog)
{
    private const string ServiceName = "AuthService";
    public async Task<PagedResult<RoleListItemDto>> ListAsync(int page, int pageSize, string? search, CancellationToken ct = default)
    {
        var query = db.Roles.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLowerInvariant();
            query = query.Where(r => r.Name.ToLower().Contains(term));
        }

        var total = await query.CountAsync(ct);
        var items = await query
            .OrderBy(r => r.Name)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(r => new RoleListItemDto(
                r.Id, r.Name, r.Description, r.IsSystemRole, r.IsAdministrator,
                r.Users.Count(u => !u.IsDeleted),
                r.RolePermissions.Count,
                r.CreatedAt))
            .ToListAsync(ct);

        return new PagedResult<RoleListItemDto>(items, total, page, pageSize);
    }

    public async Task<RoleDetailDto> GetAsync(Guid id, CancellationToken ct = default)
    {
        var role = await db.Roles.AsNoTracking().FirstOrDefaultAsync(r => r.Id == id, ct) ?? throw NotFound(id);
        var permissions = await LoadPermissionsAsync(id, ct);
        return ToDetailDto(role, permissions);
    }

    public async Task<RoleDetailDto> CreateAsync(UpsertRoleRequest request, Guid? actingUserId, CancellationToken ct = default)
    {
        var name = request.Name.Trim();
        if (await db.Roles.AnyAsync(r => r.Name == name, ct))
        {
            throw new ConflictAppException($"A role named '{name}' already exists.");
        }

        var now = DateTimeOffset.UtcNow;
        var role = new Role
        {
            Id = Guid.NewGuid(),
            Name = name,
            Description = request.Description?.Trim(),
            IsSystemRole = false,
            IsAdministrator = request.IsAdministrator,
            CreatedAt = now,
            UpdatedAt = now,
        };
        db.Roles.Add(role);

        await ApplyPermissionsAsync(role.Id, request.Permissions, ct);
        await db.SaveChangesAsync(ct);

        await WriteAuditAsync(actingUserId, "role.created", role.Id, $"Created role '{role.Name}'", ct);

        var permissions = await LoadPermissionsAsync(role.Id, ct);
        return ToDetailDto(role, permissions);
    }

    public async Task<RoleDetailDto> UpdateAsync(Guid id, UpsertRoleRequest request, Guid? actingUserId, CancellationToken ct = default)
    {
        var role = await db.Roles.FirstOrDefaultAsync(r => r.Id == id, ct) ?? throw NotFound(id);

        var name = request.Name.Trim();
        if (name != role.Name && await db.Roles.AnyAsync(r => r.Name == name && r.Id != id, ct))
        {
            throw new ConflictAppException($"A role named '{name}' already exists.");
        }

        role.Name = name;
        role.Description = request.Description?.Trim();
        role.IsAdministrator = request.IsAdministrator;
        role.UpdatedAt = DateTimeOffset.UtcNow;

        var existingGrants = await db.RolePermissions.Where(rp => rp.RoleId == id).ToListAsync(ct);
        db.RolePermissions.RemoveRange(existingGrants);
        await ApplyPermissionsAsync(id, request.Permissions, ct);

        await db.SaveChangesAsync(ct);

        await WriteAuditAsync(actingUserId, "role.updated", role.Id, $"Updated role '{role.Name}' — permissions modified", ct);

        var permissions = await LoadPermissionsAsync(id, ct);
        return ToDetailDto(role, permissions);
    }

    public async Task DeleteAsync(Guid id, Guid? actingUserId, CancellationToken ct = default)
    {
        var role = await db.Roles.FirstOrDefaultAsync(r => r.Id == id, ct) ?? throw NotFound(id);

        if (role.IsSystemRole)
        {
            throw new ConflictAppException("Built-in roles cannot be deleted.");
        }

        var hasUsers = await db.Users.AnyAsync(u => u.RoleId == id, ct);
        if (hasUsers)
        {
            throw new ConflictAppException("This role is still assigned to one or more users and cannot be deleted.");
        }

        var grants = await db.RolePermissions.Where(rp => rp.RoleId == id).ToListAsync(ct);
        db.RolePermissions.RemoveRange(grants);
        db.Roles.Remove(role);
        await db.SaveChangesAsync(ct);

        await WriteAuditAsync(actingUserId, "role.deleted", id, $"Deleted role '{role.Name}'", ct);
    }

    private async Task WriteAuditAsync(Guid? actingUserId, string action, Guid roleId, string details, CancellationToken ct)
    {
        var actorName = actingUserId is null
            ? null
            : await db.Users.AsNoTracking().Where(u => u.Id == actingUserId).Select(u => u.Name).FirstOrDefaultAsync(ct);
        await auditLog.WriteAsync(ServiceName, actingUserId, actorName, action, "Role", roleId.ToString(), details, ct: ct);
    }

    public async Task<IReadOnlyList<RoleUserDto>> GetUsersAsync(Guid id, CancellationToken ct = default)
    {
        if (!await db.Roles.AnyAsync(r => r.Id == id, ct))
        {
            throw NotFound(id);
        }

        return await db.Users
            .Where(u => u.RoleId == id)
            .OrderBy(u => u.Name)
            .Select(u => new RoleUserDto(u.Id, u.Name, u.Email))
            .ToListAsync(ct);
    }

    private async Task ApplyPermissionsAsync(Guid roleId, IReadOnlyList<RolePermissionGrantDto> grants, CancellationToken ct)
    {
        if (grants.Count == 0)
        {
            return;
        }

        var featureKeys = grants.Select(g => g.FeatureKey).Distinct().ToList();
        var features = await db.PermissionFeatures
            .Include(f => f.Capabilities)
            .Where(f => featureKeys.Contains(f.Key) && f.IsActive)
            .ToDictionaryAsync(f => f.Key, ct);

        foreach (var grant in grants.DistinctBy(g => (g.FeatureKey, g.Capability)))
        {
            if (!features.TryGetValue(grant.FeatureKey, out var feature))
            {
                throw new NotFoundAppException($"Permission feature '{grant.FeatureKey}' was not found or is no longer active.");
            }

            if (!feature.Capabilities.Any(c => c.Key == grant.Capability))
            {
                throw new ValidationAppException($"'{feature.Key}' does not declare a '{grant.Capability}' capability.");
            }

            db.RolePermissions.Add(new RolePermission
            {
                Id = Guid.NewGuid(),
                RoleId = roleId,
                FeatureId = feature.Id,
                Capability = grant.Capability,
            });
        }
    }

    private async Task<IReadOnlyList<RolePermissionGrantDto>> LoadPermissionsAsync(Guid roleId, CancellationToken ct) =>
        await db.RolePermissions
            .Include(rp => rp.Feature)
            .Where(rp => rp.RoleId == roleId)
            .Select(rp => new RolePermissionGrantDto(rp.Feature!.Key, rp.Capability))
            .ToListAsync(ct);

    private static RoleDetailDto ToDetailDto(Role r, IReadOnlyList<RolePermissionGrantDto> permissions) => new(
        r.Id, r.Name, r.Description, r.IsSystemRole, r.IsAdministrator, permissions, r.CreatedAt, r.UpdatedAt);

    private static NotFoundAppException NotFound(Guid id) => new($"Role '{id}' was not found.");
}
