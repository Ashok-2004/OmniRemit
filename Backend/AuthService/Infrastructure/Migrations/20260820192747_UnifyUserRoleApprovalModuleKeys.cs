using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AuthService.Infrastructure.Migrations
{
    /// <summary>
    /// Data-only backfill, no schema change. ApprovalModuleKeys.Users/Roles used to be the bespoke
    /// strings "Users"/"Roles"; they now ARE AuthDbSeeder.HostFeatureKeys.SettingsUsers/SettingsRoles
    /// ("host.settings.users"/"host.settings.roles"), so any CheckerAssignment/ApprovalRequest row
    /// written before this migration under the old strings needs its Module column rewritten to match,
    /// or it silently stops being gated (CheckerAssignment) / stops matching the live catalog
    /// (ApprovalRequest) the moment this deploys.
    /// </summary>
    public partial class UnifyUserRoleApprovalModuleKeys : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // CheckerAssignments has a unique index on (Module, CheckerUserId). Before this migration,
            // "Users"/"Roles" (the bespoke keys) and "host.settings.users"/"host.settings.roles" (the
            // SAME PermissionFeature already independently listed in the old catalog-driven part of the
            // module list) could each be assigned to the SAME checker as if they were two unrelated
            // modules — exactly the confusion this whole migration exists to resolve. A blind rename
            // would violate that unique index whenever both already exist for one checker, so duplicates
            // are dropped first (keeping the row already on the new key) before the rename runs.
            migrationBuilder.Sql(@"
                DELETE FROM ""CheckerAssignments"" old_row
                USING ""CheckerAssignments"" new_row
                WHERE old_row.""Module"" = 'Users' AND new_row.""Module"" = 'host.settings.users'
                  AND old_row.""CheckerUserId"" = new_row.""CheckerUserId"";");
            migrationBuilder.Sql(@"
                DELETE FROM ""CheckerAssignments"" old_row
                USING ""CheckerAssignments"" new_row
                WHERE old_row.""Module"" = 'Roles' AND new_row.""Module"" = 'host.settings.roles'
                  AND old_row.""CheckerUserId"" = new_row.""CheckerUserId"";");

            migrationBuilder.Sql("UPDATE \"CheckerAssignments\" SET \"Module\" = 'host.settings.users' WHERE \"Module\" = 'Users';");
            migrationBuilder.Sql("UPDATE \"CheckerAssignments\" SET \"Module\" = 'host.settings.roles' WHERE \"Module\" = 'Roles';");

            // ApprovalRequests has no such uniqueness constraint (many requests can share a module), so
            // this half is a plain rename — every historical request under the old key stays visible
            // and correctly attributed under the new one.
            migrationBuilder.Sql("UPDATE \"ApprovalRequests\" SET \"Module\" = 'host.settings.users' WHERE \"Module\" = 'Users';");
            migrationBuilder.Sql("UPDATE \"ApprovalRequests\" SET \"Module\" = 'host.settings.roles' WHERE \"Module\" = 'Roles';");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("UPDATE \"CheckerAssignments\" SET \"Module\" = 'Users' WHERE \"Module\" = 'host.settings.users';");
            migrationBuilder.Sql("UPDATE \"CheckerAssignments\" SET \"Module\" = 'Roles' WHERE \"Module\" = 'host.settings.roles';");
            migrationBuilder.Sql("UPDATE \"ApprovalRequests\" SET \"Module\" = 'Users' WHERE \"Module\" = 'host.settings.users';");
            migrationBuilder.Sql("UPDATE \"ApprovalRequests\" SET \"Module\" = 'Roles' WHERE \"Module\" = 'host.settings.roles';");
        }
    }
}
