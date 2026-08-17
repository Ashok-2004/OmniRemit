using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AuthService.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddPermissionFeatureHierarchy : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ParentFeatureId",
                table: "PermissionFeatures",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_PermissionFeatures_ParentFeatureId",
                table: "PermissionFeatures",
                column: "ParentFeatureId");

            migrationBuilder.AddForeignKey(
                name: "FK_PermissionFeatures_PermissionFeatures_ParentFeatureId",
                table: "PermissionFeatures",
                column: "ParentFeatureId",
                principalTable: "PermissionFeatures",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_PermissionFeatures_PermissionFeatures_ParentFeatureId",
                table: "PermissionFeatures");

            migrationBuilder.DropIndex(
                name: "IX_PermissionFeatures_ParentFeatureId",
                table: "PermissionFeatures");

            migrationBuilder.DropColumn(
                name: "ParentFeatureId",
                table: "PermissionFeatures");
        }
    }
}
