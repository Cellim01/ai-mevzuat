using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AiMevzuat.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddRgSectionFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "RgSection",
                table: "GazetteDocuments",
                type: "nvarchar(256)",
                maxLength: 256,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RgSubSection",
                table: "GazetteDocuments",
                type: "nvarchar(256)",
                maxLength: 256,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "RgSection",
                table: "GazetteDocuments");

            migrationBuilder.DropColumn(
                name: "RgSubSection",
                table: "GazetteDocuments");
        }
    }
}
