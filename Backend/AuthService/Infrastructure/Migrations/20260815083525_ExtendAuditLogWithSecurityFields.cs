using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AuthService.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class ExtendAuditLogWithSecurityFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AuthMethod",
                table: "AuditLogs",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CorrelationId",
                table: "AuditLogs",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "FailureReason",
                table: "AuditLogs",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Result",
                table: "AuditLogs",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "UserAgent",
                table: "AuditLogs",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AuthMethod",
                table: "AuditLogs");

            migrationBuilder.DropColumn(
                name: "CorrelationId",
                table: "AuditLogs");

            migrationBuilder.DropColumn(
                name: "FailureReason",
                table: "AuditLogs");

            migrationBuilder.DropColumn(
                name: "Result",
                table: "AuditLogs");

            migrationBuilder.DropColumn(
                name: "UserAgent",
                table: "AuditLogs");
        }
    }
}
