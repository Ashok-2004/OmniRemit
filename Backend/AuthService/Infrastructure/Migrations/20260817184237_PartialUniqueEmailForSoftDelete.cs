using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AuthService.Infrastructure.Migrations
{
    /// <summary>
    /// Makes the Users.Email unique index partial, so a soft-deleted account releases its address.
    ///
    /// Reproduced against the live database before writing this: deletion is SOFT
    /// (`HasQueryFilter(u => !u.IsDeleted)`), but IX_Users_Email was unfiltered. So
    /// UserAppService.CreateAsync's duplicate check — which the query filter rewrites to exclude
    /// deleted rows — reported "no duplicate", and the INSERT then violated the index, which surfaced
    /// to the operator as a raw "Microsoft.EntityFrameworkCore.DbUpdateException".
    ///
    /// Fifteen addresses were squatted this way in this deployment, including one an administrator was
    /// actively trying to re-create. The practical effect is that a staff member who leaves and
    /// returns can never be given their own email back.
    ///
    /// Partial-unique is the standard pairing for soft delete: uniqueness holds over the rows that are
    /// actually live. Audit history is unaffected — AuditLogs store the actor's id and name, not a
    /// foreign key to the email.
    /// </summary>
    public partial class PartialUniqueEmailForSoftDelete : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Pre-flight. Creating a unique index that cannot be satisfied would abort the deploy with
            // a generic Postgres error; this fails first with a message that says exactly what is
            // wrong. There should never be duplicates among live rows (the old index forbade them
            // globally), so this is a guard against surprise, not an expected path.
            migrationBuilder.Sql(@"
DO $$
DECLARE
    duplicate_count integer;
BEGIN
    SELECT COUNT(*) INTO duplicate_count
    FROM (
        SELECT ""Email""
        FROM ""Users""
        WHERE ""IsDeleted"" = false
        GROUP BY ""Email""
        HAVING COUNT(*) > 1
    ) AS dupes;

    IF duplicate_count > 0 THEN
        RAISE EXCEPTION 'Cannot create partial unique email index: % duplicate email(s) among active users.', duplicate_count;
    END IF;
END $$;
");

            migrationBuilder.DropIndex(
                name: "IX_Users_Email",
                table: "Users");

            migrationBuilder.CreateIndex(
                name: "IX_Users_Email",
                table: "Users",
                column: "Email",
                unique: true,
                filter: "\"IsDeleted\" = false");
        }

        /// <inheritdoc />
        /// <remarks>
        /// Reverting can legitimately fail once this migration has been live: an address may by then be
        /// held by both an active user and a deleted one, which the global index forbids. That is a real
        /// data conflict for an operator to resolve, not a defect in the migration, so it is allowed to
        /// surface rather than being silently swallowed.
        /// </remarks>
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Users_Email",
                table: "Users");

            migrationBuilder.CreateIndex(
                name: "IX_Users_Email",
                table: "Users",
                column: "Email",
                unique: true);
        }
    }
}
