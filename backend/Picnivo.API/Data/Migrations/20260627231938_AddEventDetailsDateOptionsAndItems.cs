using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Picnivo.API.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddEventDetailsDateOptionsAndItems : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // NOTE: OrganizerId (NOT NULL, zero-GUID default) gains an FK to Organizers,
            // and Token (NOT NULL, "" default) gains a UNIQUE index below. These backfill
            // defaults are only safe on an EMPTY Events table: any pre-existing row would
            // fail the FK (zero-GUID matches no Organizer) and two+ rows would collide on
            // the unique Token. This is safe pre-launch (no create endpoint shipped before
            // S-01), and the constraints fail loud rather than corrupt. Verify Events is
            // empty in the target environment before applying.
            migrationBuilder.AddColumn<string>(
                name: "Description",
                table: "Events",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true
            );

            migrationBuilder.AddColumn<string>(
                name: "Location",
                table: "Events",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true
            );

            migrationBuilder.AddColumn<Guid>(
                name: "OrganizerId",
                table: "Events",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000")
            );

            migrationBuilder.AddColumn<string>(
                name: "Token",
                table: "Events",
                type: "character varying(32)",
                maxLength: 32,
                nullable: false,
                defaultValue: ""
            );

            migrationBuilder.CreateTable(
                name: "DateOptions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    EventId = table.Column<Guid>(type: "uuid", nullable: false),
                    StartsAt = table.Column<DateTimeOffset>(
                        type: "timestamp with time zone",
                        nullable: false
                    ),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DateOptions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DateOptions_Events_EventId",
                        column: x => x.EventId,
                        principalTable: "Events",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade
                    );
                }
            );

            migrationBuilder.CreateTable(
                name: "EventItems",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    EventId = table.Column<Guid>(type: "uuid", nullable: false),
                    Label = table.Column<string>(
                        type: "character varying(200)",
                        maxLength: 200,
                        nullable: false
                    ),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EventItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EventItems_Events_EventId",
                        column: x => x.EventId,
                        principalTable: "Events",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade
                    );
                }
            );

            migrationBuilder.CreateIndex(
                name: "IX_Events_OrganizerId",
                table: "Events",
                column: "OrganizerId"
            );

            migrationBuilder.CreateIndex(
                name: "IX_Events_Token",
                table: "Events",
                column: "Token",
                unique: true
            );

            migrationBuilder.CreateIndex(
                name: "IX_DateOptions_EventId",
                table: "DateOptions",
                column: "EventId"
            );

            migrationBuilder.CreateIndex(
                name: "IX_EventItems_EventId",
                table: "EventItems",
                column: "EventId"
            );

            migrationBuilder.AddForeignKey(
                name: "FK_Events_Organizers_OrganizerId",
                table: "Events",
                column: "OrganizerId",
                principalTable: "Organizers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade
            );
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Events_Organizers_OrganizerId",
                table: "Events"
            );

            migrationBuilder.DropTable(name: "DateOptions");

            migrationBuilder.DropTable(name: "EventItems");

            migrationBuilder.DropIndex(name: "IX_Events_OrganizerId", table: "Events");

            migrationBuilder.DropIndex(name: "IX_Events_Token", table: "Events");

            migrationBuilder.DropColumn(name: "Description", table: "Events");

            migrationBuilder.DropColumn(name: "Location", table: "Events");

            migrationBuilder.DropColumn(name: "OrganizerId", table: "Events");

            migrationBuilder.DropColumn(name: "Token", table: "Events");
        }
    }
}
