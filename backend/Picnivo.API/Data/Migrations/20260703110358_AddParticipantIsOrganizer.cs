using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Picnivo.API.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddParticipantIsOrganizer : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsOrganizer",
                table: "Participants",
                type: "boolean",
                nullable: false,
                defaultValue: false
            );
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "IsOrganizer", table: "Participants");
        }
    }
}
