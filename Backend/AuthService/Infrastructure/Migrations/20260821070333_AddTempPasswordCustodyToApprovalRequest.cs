using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AuthService.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddTempPasswordCustodyToApprovalRequest : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "TempPasswordCiphertext",
                table: "ApprovalRequests",
                type: "character varying(512)",
                maxLength: 512,
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "TempPasswordRevealedAt",
                table: "ApprovalRequests",
                type: "timestamp with time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "TempPasswordCiphertext",
                table: "ApprovalRequests");

            migrationBuilder.DropColumn(
                name: "TempPasswordRevealedAt",
                table: "ApprovalRequests");
        }
    }
}
