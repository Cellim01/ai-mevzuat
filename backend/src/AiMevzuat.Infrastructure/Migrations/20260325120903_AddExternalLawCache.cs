using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AiMevzuat.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddExternalLawCache : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ExternalLawCaches",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Source = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    QueryHash = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    QueryText = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    ExternalId = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    Title = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    Content = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    SourceUrl = table.Column<string>(type: "nvarchar(1024)", maxLength: 1024, nullable: true),
                    MetadataJson = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    FetchedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    HitCount = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ExternalLawCaches", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ExternalLawCaches_ExpiresAt",
                table: "ExternalLawCaches",
                column: "ExpiresAt");

            migrationBuilder.CreateIndex(
                name: "IX_ExternalLawCaches_Source_QueryHash",
                table: "ExternalLawCaches",
                columns: new[] { "Source", "QueryHash" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ExternalLawCaches");
        }
    }
}
