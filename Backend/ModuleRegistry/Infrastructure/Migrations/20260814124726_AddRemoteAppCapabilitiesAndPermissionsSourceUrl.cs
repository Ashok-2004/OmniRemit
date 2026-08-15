using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ModuleRegistry.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddRemoteAppCapabilitiesAndPermissionsSourceUrl : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "PermissionsSourceUrl",
                table: "RemoteApps",
                type: "character varying(2048)",
                maxLength: 2048,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "RemoteAppCapabilities",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    RemoteAppId = table.Column<Guid>(type: "uuid", nullable: false),
                    Key = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    DisplayName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RemoteAppCapabilities", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RemoteAppCapabilities_RemoteApps_RemoteAppId",
                        column: x => x.RemoteAppId,
                        principalTable: "RemoteApps",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_RemoteAppCapabilities_RemoteAppId_Key",
                table: "RemoteAppCapabilities",
                columns: new[] { "RemoteAppId", "Key" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "RemoteAppCapabilities");

            migrationBuilder.DropColumn(
                name: "PermissionsSourceUrl",
                table: "RemoteApps");
        }
    }
}
