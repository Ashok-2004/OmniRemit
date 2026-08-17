using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ModuleRegistry.Infrastructure;

#nullable disable

namespace ModuleRegistry.Infrastructure.Migrations
{
    /// <summary>
    /// GIN trigram indexes for the remote-app search predicate. See AuthService's migration of the same
    /// name for the full rationale — EF emits `lower(a."DisplayName") LIKE @term`, which no B-tree index
    /// can serve, and the whole block is privilege-safe so a deploy still succeeds where the role cannot
    /// CREATE EXTENSION.
    ///
    /// The registry holds one row per registered application, so this table is small today. The index is
    /// added anyway for consistency: the search path should not be the one place that degrades as a bank
    /// onboards more internal applications.
    /// </summary>
    [DbContext(typeof(ModuleRegistryDbContext))]
    [Migration("20260817180100_AddTrigramSearchIndexes")]
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
        RAISE NOTICE 'pg_trgm could not be created (%). Trigram search indexes skipped.', SQLERRM;
        RETURN;
    END;

    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
        CREATE INDEX IF NOT EXISTS ""IX_RemoteApps_DisplayName_Trgm""
            ON ""RemoteApps"" USING gin (lower(""DisplayName"") gin_trgm_ops);

        CREATE INDEX IF NOT EXISTS ""IX_RemoteApps_Key_Trgm""
            ON ""RemoteApps"" USING gin (lower(""Key"") gin_trgm_ops);
    END IF;
END $$;
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DROP INDEX IF EXISTS ""IX_RemoteApps_DisplayName_Trgm"";
DROP INDEX IF EXISTS ""IX_RemoteApps_Key_Trgm"";
");
        }
    }
}
