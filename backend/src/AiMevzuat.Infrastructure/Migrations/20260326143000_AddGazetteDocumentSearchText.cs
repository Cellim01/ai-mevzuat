using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AiMevzuat.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddGazetteDocumentSearchText : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF COL_LENGTH('dbo.GazetteDocuments', 'SearchText') IS NULL
BEGIN
    ALTER TABLE dbo.GazetteDocuments
    ADD SearchText nvarchar(max) NOT NULL
        CONSTRAINT DF_GazetteDocuments_SearchText DEFAULT (N'');
END;
");

            migrationBuilder.Sql(@"
UPDATE dbo.GazetteDocuments
SET SearchText = RawText
WHERE LTRIM(RTRIM(ISNULL(SearchText, N''))) = N'';
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF COL_LENGTH('dbo.GazetteDocuments', 'SearchText') IS NOT NULL
BEGIN
    ALTER TABLE dbo.GazetteDocuments DROP CONSTRAINT DF_GazetteDocuments_SearchText;
    ALTER TABLE dbo.GazetteDocuments DROP COLUMN SearchText;
END;
");
        }
    }
}
