using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ModuleRegistry.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddCapabilityModuleGrouping : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_RemoteAppCapabilities_RemoteAppId_Key",
                table: "RemoteAppCapabilities");

            migrationBuilder.AddColumn<string>(
                name: "ModuleDisplayName",
                table: "RemoteAppCapabilities",
                type: "character varying(150)",
                maxLength: 150,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ModuleKey",
                table: "RemoteAppCapabilities",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateIndex(
                name: "IX_RemoteAppCapabilities_RemoteAppId_ModuleKey_Key",
                table: "RemoteAppCapabilities",
                columns: new[] { "RemoteAppId", "ModuleKey", "Key" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_RemoteAppCapabilities_RemoteAppId_ModuleKey_Key",
                table: "RemoteAppCapabilities");

            migrationBuilder.DropColumn(
                name: "ModuleDisplayName",
                table: "RemoteAppCapabilities");

            migrationBuilder.DropColumn(
                name: "ModuleKey",
                table: "RemoteAppCapabilities");

            migrationBuilder.CreateIndex(
                name: "IX_RemoteAppCapabilities_RemoteAppId_Key",
                table: "RemoteAppCapabilities",
                columns: new[] { "RemoteAppId", "Key" },
                unique: true);
        }
    }
}
