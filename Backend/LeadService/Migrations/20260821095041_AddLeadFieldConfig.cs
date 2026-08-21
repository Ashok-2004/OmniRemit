using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LeadManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddLeadFieldConfig : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "LeadFieldConfigs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ProductId = table.Column<Guid>(type: "uuid", nullable: false),
                    ApiField = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    DisplayLabel = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Section = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    DisplayOrder = table.Column<int>(type: "integer", nullable: false),
                    Visible = table.Column<bool>(type: "boolean", nullable: false),
                    Required = table.Column<bool>(type: "boolean", nullable: false),
                    Editable = table.Column<bool>(type: "boolean", nullable: false),
                    Sensitive = table.Column<bool>(type: "boolean", nullable: false),
                    MaskingRule = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    VisibleCharCount = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LeadFieldConfigs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LeadFieldConfigs_Products_ProductId",
                        column: x => x.ProductId,
                        principalTable: "Products",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_LeadFieldConfigs_ProductId_ApiField",
                table: "LeadFieldConfigs",
                columns: new[] { "ProductId", "ApiField" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "LeadFieldConfigs");
        }
    }
}
