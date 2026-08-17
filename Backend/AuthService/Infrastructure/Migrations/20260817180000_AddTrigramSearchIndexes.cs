using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using AuthService.Infrastructure;

#nullable disable

namespace AuthService.Infrastructure.Migrations
{
    /// <summary>
    /// GIN trigram indexes for the user and role search predicates.
    ///
    /// EF translates `u.Name.ToLower().Contains(term)` to `lower(u."Name") LIKE @term`, verified from the
    /// running service's SQL log. A leading-wildcard LIKE cannot use a B-tree index at any size, so every
    /// search was a full sequential scan over the whole table plus a lower() call per row. That is
    /// invisible on five users and is the first thing to fall over on a real staff directory.
    ///
    /// The index expression must match the query expression exactly — `lower("Name")`, not `"Name"` —
    /// or the planner cannot use it.
    ///
    /// WRITTEN DEFENSIVELY ON PURPOSE. pg_trgm is a trusted extension and `neondb_owner` can create it
    /// (confirmed against this deployment: available 1.6, role neondb_owner), but a bank's production
    /// role frequently cannot CREATE EXTENSION. So the whole thing is wrapped: if the extension cannot be
    /// installed the migration logs a notice and completes, leaving the previous behaviour intact rather
    /// than failing the deploy. Search still works, just without the index.
    /// </summary>
    [DbContext(typeof(AuthDbContext))]
    [Migration("20260817180000_AddTrigramSearchIndexes")]
    public partial class AddTrigramSearchIndexes : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DO $$
BEGIN
    BEGIN
        CREATE EXTENSION IF NOT EXISTS pg_trgm;
    EXCEPTION WHEN OTHERS THEN
        -- No privilege to install it (or it is unavailable). Not fatal: the LIKE queries still work,
        -- they simply stay sequential scans. A DBA can create the extension later and re-run this
        -- migration's index statements by hand.
        RAISE NOTICE 'pg_trgm could not be created (%). Trigram search indexes skipped.', SQLERRM;
        RETURN;
    END;

    -- Only attempt the indexes if the extension really is present, so a partial failure above cannot
    -- produce a confusing 'operator class gin_trgm_ops does not exist' error.
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
        CREATE INDEX IF NOT EXISTS ""IX_Users_Name_Trgm""
            ON ""Users"" USING gin (lower(""Name"") gin_trgm_ops);

        CREATE INDEX IF NOT EXISTS ""IX_Users_Email_Trgm""
            ON ""Users"" USING gin (lower(""Email"") gin_trgm_ops);

        CREATE INDEX IF NOT EXISTS ""IX_Roles_Name_Trgm""
            ON ""Roles"" USING gin (lower(""Name"") gin_trgm_ops);

        -- The audit log is the largest table in the platform and is filtered by actor and action.
        CREATE INDEX IF NOT EXISTS ""IX_AuditLogs_ActorName_Trgm""
            ON ""AuditLogs"" USING gin (lower(""ActorName"") gin_trgm_ops);
    END IF;
END $$;
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // The extension itself is deliberately NOT dropped: other objects may depend on it, and
            // dropping a shared extension as part of reverting one migration is more destructive than
            // leaving it installed.
            migrationBuilder.Sql(@"
DROP INDEX IF EXISTS ""IX_Users_Name_Trgm"";
DROP INDEX IF EXISTS ""IX_Users_Email_Trgm"";
DROP INDEX IF EXISTS ""IX_Roles_Name_Trgm"";
DROP INDEX IF EXISTS ""IX_AuditLogs_ActorName_Trgm"";
");
        }
    }
}
