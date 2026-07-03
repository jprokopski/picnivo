using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Picnivo.API.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddEventItemNormalizedLabelUniqueIndex : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(name: "IX_EventItems_EventId", table: "EventItems");

            migrationBuilder.AddColumn<string>(
                name: "NormalizedLabel",
                table: "EventItems",
                type: "text",
                nullable: true,
                computedColumnSql: "lower(\"Label\")",
                stored: true
            );

            migrationBuilder.CreateIndex(
                name: "IX_EventItems_Event_NormalizedLabel",
                table: "EventItems",
                columns: new[] { "EventId", "NormalizedLabel" },
                unique: true
            );
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_EventItems_Event_NormalizedLabel",
                table: "EventItems"
            );

            migrationBuilder.DropColumn(name: "NormalizedLabel", table: "EventItems");

            migrationBuilder.CreateIndex(
                name: "IX_EventItems_EventId",
                table: "EventItems",
                column: "EventId"
            );
        }
    }
}
