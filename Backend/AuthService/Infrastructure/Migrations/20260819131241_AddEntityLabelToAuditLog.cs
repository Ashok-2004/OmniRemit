using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AuthService.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddEntityLabelToAuditLog : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "EntityLabel",
                table: "AuditLogs",
                type: "character varying(300)",
                maxLength: 300,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "EntityLabel",
                table: "AuditLogs");
        }
    }
}
