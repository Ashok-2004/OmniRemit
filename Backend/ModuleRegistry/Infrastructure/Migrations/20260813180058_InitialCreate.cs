using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ModuleRegistry.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "RemoteApps",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Key = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    DisplayName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    IconKey = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    ManifestUrl = table.Column<string>(type: "character varying(2048)", maxLength: 2048, nullable: false),
                    SidebarOrder = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    MaintenanceMessage = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    PermissionFeatureKey = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RemoteApps", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_RemoteApps_Key",
                table: "RemoteApps",
                column: "Key",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_RemoteApps_PermissionFeatureKey",
                table: "RemoteApps",
                column: "PermissionFeatureKey",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "RemoteApps");
        }
    }
}
