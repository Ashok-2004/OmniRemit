using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ModuleRegistry.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddRemoteAppHealthProbeFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ContainerName",
                table: "RemoteApps",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Health",
                table: "RemoteApps",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                // Hand-corrected from the scaffolder's `defaultValue: ""`. Health is an enum mapped
                // with HasConversion<string>(), and no RemoteAppHealth member maps to the empty
                // string — every pre-existing row would have been backfilled with a value that
                // throws on read-back, breaking every query that touches RemoteApps. "Unknown" is
                // also the factually correct state: these rows predate probing and have never been
                // checked.
                defaultValue: "Unknown");

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "LastHealthCheckAt",
                table: "RemoteApps",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LastHealthError",
                table: "RemoteApps",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_RemoteApps_Status_SidebarOrder",
                table: "RemoteApps",
                columns: new[] { "Status", "SidebarOrder" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_RemoteApps_Status_SidebarOrder",
                table: "RemoteApps");

            migrationBuilder.DropColumn(
                name: "ContainerName",
                table: "RemoteApps");

            migrationBuilder.DropColumn(
                name: "Health",
                table: "RemoteApps");

            migrationBuilder.DropColumn(
                name: "LastHealthCheckAt",
                table: "RemoteApps");

            migrationBuilder.DropColumn(
                name: "LastHealthError",
                table: "RemoteApps");
        }
    }
}
