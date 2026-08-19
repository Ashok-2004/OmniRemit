using AuthService.Application.DTOs;
using AuthService.Application.Exceptions;
using AuthService.Domain.Entities;
using AuthService.Domain.Enums;
using AuthService.Infrastructure;
using AuthService.Infrastructure.Security;
using Microsoft.EntityFrameworkCore;

namespace AuthService.Application.Services;

public class UserAppService(AuthDbContext db, PasswordHasher passwordHasher, AuditLogAppService auditLog, IHttpContextAccessor httpContextAccessor)
{
    private const string ServiceName = "AuthService";

    // AuthService writes User audit rows in-process, so the current HttpContext IS the real
    // end-user's own request — no service-to-service hop in between, unlike ModuleRegistry/
    // EmployeeService/LeadService, which have to capture and forward these explicitly.
    private string? SourceIp => httpContextAccessor.HttpContext?.Connection.RemoteIpAddress?.ToString();
    private string? UserAgent => httpContextAccessor.HttpContext?.Request.Headers.UserAgent.ToString();
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
            .OrderBy(u => u.Status)
            .ThenBy(u => u.Name)
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

        if (!Enum.TryParse<Domain.Enums.AuthProvider>(request.AuthProvider, out var authProvider))
        {
            throw new ValidationAppException($"Unknown authentication provider '{request.AuthProvider}'.");
        }

        var now = DateTimeOffset.UtcNow;
        var isLocal = authProvider == Domain.Enums.AuthProvider.Local;

        var user = new User
        {
            Id = Guid.NewGuid(),
            Name = request.Name.Trim(),
            Email = email,
            PhoneNumber = request.PhoneNumber?.Trim(),
            AuthProvider = authProvider,
            Status = request.IsActive ? UserStatus.Active : UserStatus.Inactive,
            RoleId = request.RoleId,
            // Google accounts have no local password to force a change on — MustChangePassword only
            // applies to the Local flow's system-generated temporary password.
            MustChangePassword = isLocal,
            CreatedAt = now,
            UpdatedAt = now,
            CreatedBy = actingUserId,
            UpdatedBy = actingUserId,
        };

        // Local: generate + hash a real one-time temp password, returned once to the caller.
        // Google: PasswordHash stays null — this account can never sign in with a local password,
        // see AuthAppService.LoginAsync's null-guard.
        string? tempPassword = null;
        if (isLocal)
        {
            tempPassword = TemporaryPasswordGenerator.Generate();
            user.PasswordHash = passwordHasher.Hash(user, tempPassword);
        }

        db.Users.Add(user);
        await db.SaveChangesAsync(ct);

        var saved = await FindWithRoleAsync(user.Id, ct) ?? throw NotFound(user.Id);

        var actorName = await ResolveActorNameAsync(actingUserId, ct);
        await auditLog.WriteAsync(ServiceName, actingUserId, actorName, "user.created", "User", user.Id.ToString(), $"Created {user.Email}", SourceIp, userAgent: UserAgent, entityLabel: user.Name, ct: ct);

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

        /*
         * Account status is part of the update.
         *
         * UpdateUserRequest previously had no IsActive field at all, so the "Account is Active" toggle
         * in the edit form had nothing to save into — it moved, the form saved, and the status silently
         * did not change. Status is now edited in one place (the user form) rather than from a list row,
         * so this is the only path that sets it apart from the dedicated status endpoint.
         *
         * A status change is recorded as its own audit action. "user.updated" does not convey that
         * someone's ability to sign in was revoked, and that is exactly the event an auditor looks for.
         */
        var previousStatus = user.Status;
        var requestedStatus = request.IsActive ? UserStatus.Active : UserStatus.Inactive;
        var statusChanged = previousStatus != requestedStatus;
        user.Status = requestedStatus;

        user.UpdatedAt = DateTimeOffset.UtcNow;
        user.UpdatedBy = actingUserId;

        await db.SaveChangesAsync(ct);

        var actorName = await ResolveActorNameAsync(actingUserId, ct);
        await auditLog.WriteAsync(ServiceName, actingUserId, actorName, "user.updated", "User", user.Id.ToString(), $"Updated {user.Email}", SourceIp, userAgent: UserAgent, entityLabel: user.Name, ct: ct);

        if (statusChanged)
        {
            await auditLog.WriteAsync(
                ServiceName, actingUserId, actorName,
                request.IsActive ? "user.activated" : "user.deactivated",
                "User", user.Id.ToString(),
                $"{user.Email} was {(request.IsActive ? "activated" : "deactivated")}.", SourceIp, userAgent: UserAgent, entityLabel: user.Name, ct: ct);
        }

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

        var actorName = await ResolveActorNameAsync(actingUserId, ct);
        await auditLog.WriteAsync(ServiceName, actingUserId, actorName, isActive ? "user.activated" : "user.deactivated", "User", user.Id.ToString(), $"{(isActive ? "Activated" : "Deactivated")} {user.Email}", SourceIp, userAgent: UserAgent, entityLabel: user.Name, ct: ct);

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

        var actorName = await ResolveActorNameAsync(actingUserId, ct);
        await auditLog.WriteAsync(ServiceName, actingUserId, actorName, "user.deleted", "User", user.Id.ToString(), $"Deleted {user.Email}", SourceIp, userAgent: UserAgent, entityLabel: user.Name, ct: ct);
    }

    private async Task<string?> ResolveActorNameAsync(Guid? actingUserId, CancellationToken ct)
    {
        if (actingUserId is null) return null;
        return await db.Users.AsNoTracking().Where(u => u.Id == actingUserId).Select(u => u.Name).FirstOrDefaultAsync(ct);
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

        /*
         * Validate and resolve EVERYTHING before removing anything.
         *
         * The previous version removed all existing overrides first, then validated each incoming one
         * inside the same loop that added it. So a request containing a single invalid grant — which is
         * exactly what the UI was sending with `remote.employee:View` — threw partway through, after
         * the removals were already tracked. The exception rolled the transaction back, but the
         * ordering was only accidentally safe; a rejected save must never be able to leave a user with
         * fewer permissions than they started with.
         *
         * It also removed and re-inserted rows that had not changed. UserPermissionOverrides has a
         * unique index on (UserId, FeatureId, Capability) and EF does not guarantee DELETEs are
         * batched before INSERTs, so re-saving a user while keeping an override they already had could
         * hit a unique violation. Diffing avoids both problems.
         */
        var featureKeys = overrides.Select(o => o.FeatureKey).Distinct().ToList();
        var features = await db.PermissionFeatures
            .Include(f => f.Capabilities)
            .Where(f => featureKeys.Contains(f.Key))
            .ToDictionaryAsync(f => f.Key, ct);

        var resolved = new List<(Guid FeatureId, string Capability, PermissionEffect Effect)>();
        foreach (var o in overrides.DistinctBy(o => (o.FeatureKey, o.Capability)))
        {
            if (!features.TryGetValue(o.FeatureKey, out var feature))
            {
                throw new NotFoundAppException($"Permission feature '{o.FeatureKey}' was not found.");
            }

            if (!feature.Capabilities.Any(c => c.Key == o.Capability))
            {
                throw new ValidationAppException($"'{feature.Key}' does not declare a '{o.Capability}' capability.");
            }

            if (!Enum.TryParse<PermissionEffect>(o.Effect, out var effect))
            {
                throw new ValidationAppException($"Unknown effect '{o.Effect}'.");
            }

            resolved.Add((feature.Id, o.Capability, effect));
        }

        var now = DateTimeOffset.UtcNow;
        var requested = resolved.ToDictionary(r => (r.FeatureId, r.Capability), r => r.Effect);

        foreach (var row in existing)
        {
            if (requested.TryGetValue((row.FeatureId, row.Capability), out var effect))
            {
                // Kept. Update the effect in place if it flipped between Grant and Revoke, rather than
                // deleting and re-adding the same unique key.
                if (row.Effect != effect)
                {
                    row.Effect = effect;
                }
            }
            else
            {
                db.UserPermissionOverrides.Remove(row);
            }
        }

        var kept = existing.Select(r => (r.FeatureId, r.Capability)).ToHashSet();
        foreach (var (featureId, capability, effect) in resolved)
        {
            if (kept.Contains((featureId, capability)))
            {
                continue;
            }

            db.UserPermissionOverrides.Add(new UserPermissionOverride
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                FeatureId = featureId,
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
            .AsNoTracking()
            .Include(o => o.Feature)
            .Where(o => o.UserId == userId)
            .Select(o => new PermissionOverrideDto(o.Feature!.Key, o.Capability, o.Effect.ToString()))
            .ToListAsync(ct);

    private static UserListItemDto ToListItemDto(User u) => new(
        u.Id, u.Name, u.Email, u.PhoneNumber, u.RoleId, u.Role?.Name,
        u.Role != null && u.Role.IsAdministrator, u.Status == UserStatus.Active, u.LastLoginAt, u.AuthProvider.ToString());

    private static UserDetailDto ToDetailDto(User u, IReadOnlyList<PermissionOverrideDto> overrides) => new(
        u.Id, u.Name, u.Email, u.PhoneNumber, u.RoleId, u.Role?.Name,
        u.Role != null && u.Role.IsAdministrator, u.Status == UserStatus.Active, u.MustChangePassword,
        u.LastLoginAt, u.CreatedAt, u.UpdatedAt, overrides, u.AuthProvider.ToString());

    private static NotFoundAppException NotFound(Guid id) => new($"User '{id}' was not found.");
}
