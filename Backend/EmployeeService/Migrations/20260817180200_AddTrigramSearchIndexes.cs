using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using EmployeeService.Data;

#nullable disable

namespace EmployeeService.Migrations
{
    /// <summary>
    /// GIN trigram indexes for the employee roster search.
    ///
    /// EmployeeRepository searches name, email and department with `.ToLower().Contains(term)`, which EF
    /// emits as three OR'd `lower(col) LIKE @term` predicates — a full sequential scan of the roster per
    /// keystroke-debounced search. This is the table most likely to hold real volume in a bank
    /// deployment, so it is the one where the index matters most.
    ///
    /// Privilege-safe in the same way as the other two services: if pg_trgm cannot be installed the
    /// migration completes with a notice rather than failing the deploy.
    /// </summary>
    [DbContext(typeof(AppDbContext))]
    [Migration("20260817180200_AddTrigramSearchIndexes")]
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
        CREATE INDEX IF NOT EXISTS ""IX_Employees_Name_Trgm""
            ON ""Employees"" USING gin (lower(""Name"") gin_trgm_ops);

        CREATE INDEX IF NOT EXISTS ""IX_Employees_Email_Trgm""
            ON ""Employees"" USING gin (lower(""Email"") gin_trgm_ops);

        CREATE INDEX IF NOT EXISTS ""IX_Employees_Department_Trgm""
            ON ""Employees"" USING gin (lower(""Department"") gin_trgm_ops);
    END IF;
END $$;
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DROP INDEX IF EXISTS ""IX_Employees_Name_Trgm"";
DROP INDEX IF EXISTS ""IX_Employees_Email_Trgm"";
DROP INDEX IF EXISTS ""IX_Employees_Department_Trgm"";
");
        }
    }
}
