using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Migrations
{
    /// <inheritdoc />
    public partial class FixCorporateFieldConfigSeed : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // The very first seed of Corporate field_configs was built from CompanyOverview.tsx —
            // which turned out to be dead code, never actually rendered. The real corporate fields
            // live inline in Customer360.tsx (Company Overview/Information/Contact &
            // Relationship/RM Manager tabs) and are a substantially different, larger field set.
            // Purging the wrong rows here lets FieldConfigService.EnsureSeededAsync reseed correctly
            // (it only seeds an EMPTY table) on the next app startup — no admin has had a chance to
            // edit this table yet, so nothing real is lost.
            migrationBuilder.Sql("DELETE FROM field_configs WHERE \"ProfileType\" = 'Corporate';");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Not reversible — the deleted rows were wrong data, not something to restore.
        }
    }
}
