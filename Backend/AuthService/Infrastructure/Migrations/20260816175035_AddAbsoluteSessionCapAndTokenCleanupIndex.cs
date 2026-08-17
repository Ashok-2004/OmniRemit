using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AuthService.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddAbsoluteSessionCapAndTokenCleanupIndex : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // The scaffolder's default for this column was DateTimeOffset.MinValue (0001-01-01).
            // That is in the past, so RotateAsync's new absolute-expiry guard would have treated
            // EVERY pre-existing refresh token as a dead session and signed out every currently
            // logged-in user the moment this deployed. The column is added with a harmless far-future
            // placeholder and then backfilled from real data below.
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "AbsoluteExpiresAt",
                table: "RefreshTokens",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTimeOffset(new DateTime(9999, 12, 31, 23, 59, 59, DateTimeKind.Unspecified), TimeSpan.Zero));

            // Give existing sessions the same deadline they would have had if the cap had always
            // existed: eight hours from when that session's token was actually created. Sessions
            // older than that expire on their next refresh, which is the correct outcome — they have
            // already outlived the policy.
            migrationBuilder.Sql(@"UPDATE ""RefreshTokens"" SET ""AbsoluteExpiresAt"" = ""CreatedAt"" + INTERVAL '8 hours';");

            migrationBuilder.CreateIndex(
                name: "IX_RefreshTokens_ExpiresAt",
                table: "RefreshTokens",
                column: "ExpiresAt");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_RefreshTokens_ExpiresAt",
                table: "RefreshTokens");

            migrationBuilder.DropColumn(
                name: "AbsoluteExpiresAt",
                table: "RefreshTokens");
        }
    }
}
