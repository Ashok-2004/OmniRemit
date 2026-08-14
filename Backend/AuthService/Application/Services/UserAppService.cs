using AuthService.Application.DTOs;
using AuthService.Application.Exceptions;
using AuthService.Domain.Entities;
using AuthService.Domain.Enums;
using AuthService.Infrastructure;
using AuthService.Infrastructure.Security;
using Microsoft.EntityFrameworkCore;

namespace AuthService.Application.Services;

public class UserAppService(AuthDbContext db, PasswordHasher passwordHasher)
{
    public async Task<PagedResult<UserListItemDto>> ListAsync(
        int page, int pageSize, string? search, bool? isActive, Guid? roleId, CancellationToken ct = default)
    {
        var query = db.Users.Include(u => u.Role).AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLowerInvariant();
            query = query.Where(u =>
                u.Name.ToLower().Contains(term) ||
                u.Email.ToLower().Contains(term) ||
                (u.PhoneNumber != null && u.PhoneNumber.Contains(term)));
        }

        if (isActive is not null)
        {
            var status = isActive.Value ? UserStatus.Active : UserStatus.Inactive;
            query = query.Where(u => u.Status == status);
        }

        if (roleId is not null)
        {
            query = query.Where(u => u.RoleId == roleId);
        }

        var total = await query.CountAsync(ct);
        var items = await query
            .OrderBy(u => u.Name)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(u => ToListItemDto(u))
            .ToListAsync(ct);

        return new PagedResult<UserListItemDto>(items, total, page, pageSize);
    }

    public async Task<UserDetailDto> GetAsync(Guid id, CancellationToken ct = default)
    {
        var user = await FindWithRoleAsync(id, ct) ?? throw NotFound(id);
        var overrides = await LoadOverridesAsync(id, ct);
        return ToDetailDto(user, overrides);
    }

    public async Task<CreateUserResponse> CreateAsync(CreateUserRequest request, Guid? actingUserId, CancellationToken ct = default)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        if (await db.Users.AnyAsync(u => u.Email == email, ct))
        {
            throw new ConflictAppException($"A user with email '{email}' already exists.");
        }

        if (request.RoleId is not null && !await db.Roles.AnyAsync(r => r.Id == request.RoleId, ct))
        {
            throw new NotFoundAppException($"Role '{request.RoleId}' was not found.");
        }

        var now = DateTimeOffset.UtcNow;
        var tempPassword = TemporaryPasswordGenerator.Generate();

        var user = new User
        {
            Id = Guid.NewGuid(),
            Name = request.Name.Trim(),
            Email = email,
            PhoneNumber = request.PhoneNumber?.Trim(),
            PasswordHash = string.Empty,
            Status = request.IsActive ? UserStatus.Active : UserStatus.Inactive,
            RoleId = request.RoleId,
            MustChangePassword = true,
            CreatedAt = now,
            UpdatedAt = now,
            CreatedBy = actingUserId,
            UpdatedBy = actingUserId,
        };
        user.PasswordHash = passwordHasher.Hash(user, tempPassword);

        db.Users.Add(user);
        await db.SaveChangesAsync(ct);

        var saved = await FindWithRoleAsync(user.Id, ct) ?? throw NotFound(user.Id);
        return new CreateUserResponse(ToDetailDto(saved, []), tempPassword);
    }

    public async Task<UserDetailDto> UpdateAsync(Guid id, UpdateUserRequest request, Guid? actingUserId, CancellationToken ct = default)
    {
        var user = await FindWithRoleAsync(id, ct) ?? throw NotFound(id);

        var email = request.Email.Trim().ToLowerInvariant();
        if (email != user.Email && await db.Users.AnyAsync(u => u.Email == email && u.Id != id, ct))
        {
            throw new ConflictAppException($"A user with email '{email}' already exists.");
        }

        if (request.RoleId is not null && !await db.Roles.AnyAsync(r => r.Id == request.RoleId, ct))
        {
            throw new NotFoundAppException($"Role '{request.RoleId}' was not found.");
        }

        user.Name = request.Name.Trim();
        user.Email = email;
        user.PhoneNumber = request.PhoneNumber?.Trim();
        user.RoleId = request.RoleId;
        user.UpdatedAt = DateTimeOffset.UtcNow;
        user.UpdatedBy = actingUserId;

        await db.SaveChangesAsync(ct);

        var overrides = await LoadOverridesAsync(id, ct);
        return ToDetailDto(user, overrides);
    }

    public async Task<UserDetailDto> UpdateStatusAsync(Guid id, bool isActive, Guid? actingUserId, CancellationToken ct = default)
    {
        var user = await FindWithRoleAsync(id, ct) ?? throw NotFound(id);
        user.Status = isActive ? UserStatus.Active : UserStatus.Inactive;
        user.UpdatedAt = DateTimeOffset.UtcNow;
        user.UpdatedBy = actingUserId;
        await db.SaveChangesAsync(ct);

        var overrides = await LoadOverridesAsync(id, ct);
        return ToDetailDto(user, overrides);
    }

    public async Task DeleteAsync(Guid id, Guid? actingUserId, CancellationToken ct = default)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == id, ct) ?? throw NotFound(id);
        user.IsDeleted = true;
        user.Status = UserStatus.Inactive;
        user.UpdatedAt = DateTimeOffset.UtcNow;
        user.UpdatedBy = actingUserId;
        await db.SaveChangesAsync(ct);
    }

    public async Task<IReadOnlyList<PermissionOverrideDto>> GetPermissionOverridesAsync(Guid userId, CancellationToken ct = default)
    {
        if (!await db.Users.AnyAsync(u => u.Id == userId, ct))
        {
            throw NotFound(userId);
        }

        return await LoadOverridesAsync(userId, ct);
    }

    public async Task<IReadOnlyList<PermissionOverrideDto>> ReplacePermissionOverridesAsync(
        Guid userId, IReadOnlyList<PermissionOverrideDto> overrides, Guid? actingUserId, CancellationToken ct = default)
    {
        if (!await db.Users.AnyAsync(u => u.Id == userId, ct))
        {
            throw NotFound(userId);
        }

        var existing = await db.UserPermissionOverrides.Where(o => o.UserId == userId).ToListAsync(ct);
        db.UserPermissionOverrides.RemoveRange(existing);

        var featureKeys = overrides.Select(o => o.FeatureKey).Distinct().ToList();
        var features = await db.PermissionFeatures
            .Where(f => featureKeys.Contains(f.Key))
            .ToDictionaryAsync(f => f.Key, ct);

        var now = DateTimeOffset.UtcNow;
        foreach (var o in overrides)
        {
            if (!features.TryGetValue(o.FeatureKey, out var feature))
            {
                throw new NotFoundAppException($"Permission feature '{o.FeatureKey}' was not found.");
            }

            if (!Enum.TryParse<CapabilityType>(o.Capability, out var capability))
            {
                throw new ValidationAppException($"Unknown capability '{o.Capability}'.");
            }

            if (!Enum.TryParse<PermissionEffect>(o.Effect, out var effect))
            {
                throw new ValidationAppException($"Unknown effect '{o.Effect}'.");
            }

            db.UserPermissionOverrides.Add(new UserPermissionOverride
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                FeatureId = feature.Id,
                Capability = capability,
                Effect = effect,
                CreatedAt = now,
                CreatedBy = actingUserId,
            });
        }

        await db.SaveChangesAsync(ct);
        return await LoadOverridesAsync(userId, ct);
    }

    private Task<User?> FindWithRoleAsync(Guid id, CancellationToken ct) =>
        db.Users.Include(u => u.Role).FirstOrDefaultAsync(u => u.Id == id, ct);

    private async Task<IReadOnlyList<PermissionOverrideDto>> LoadOverridesAsync(Guid userId, CancellationToken ct) =>
        await db.UserPermissionOverrides
            .Include(o => o.Feature)
            .Where(o => o.UserId == userId)
            .Select(o => new PermissionOverrideDto(o.Feature!.Key, o.Capability.ToString(), o.Effect.ToString()))
            .ToListAsync(ct);

    private static UserListItemDto ToListItemDto(User u) => new(
        u.Id, u.Name, u.Email, u.PhoneNumber, u.RoleId, u.Role?.Name,
        u.Role != null && u.Role.IsAdministrator, u.Status == UserStatus.Active, u.LastLoginAt);

    private static UserDetailDto ToDetailDto(User u, IReadOnlyList<PermissionOverrideDto> overrides) => new(
        u.Id, u.Name, u.Email, u.PhoneNumber, u.RoleId, u.Role?.Name,
        u.Role != null && u.Role.IsAdministrator, u.Status == UserStatus.Active, u.MustChangePassword,
        u.LastLoginAt, u.CreatedAt, u.UpdatedAt, overrides);

    private static NotFoundAppException NotFound(Guid id) => new($"User '{id}' was not found.");
}
