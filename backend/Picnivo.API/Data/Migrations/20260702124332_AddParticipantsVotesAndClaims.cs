using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Picnivo.API.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddParticipantsVotesAndClaims : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ChosenDateOptionId",
                table: "Events",
                type: "uuid",
                nullable: true
            );

            migrationBuilder.AddColumn<Guid>(
                name: "AddedByParticipantId",
                table: "EventItems",
                type: "uuid",
                nullable: true
            );

            migrationBuilder.AddColumn<Guid>(
                name: "OrphanedFromParticipantId",
                table: "EventItems",
                type: "uuid",
                nullable: true
            );

            migrationBuilder.CreateTable(
                name: "Participants",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    EventId = table.Column<Guid>(type: "uuid", nullable: false),
                    DisplayName = table.Column<string>(
                        type: "character varying(100)",
                        maxLength: 100,
                        nullable: false
                    ),
                    Attendance = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(
                        type: "timestamp with time zone",
                        nullable: false,
                        defaultValueSql: "now()"
                    ),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Participants", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Participants_Events_EventId",
                        column: x => x.EventId,
                        principalTable: "Events",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade
                    );
                }
            );

            migrationBuilder.CreateTable(
                name: "DateVotes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ParticipantId = table.Column<Guid>(type: "uuid", nullable: false),
                    DateOptionId = table.Column<Guid>(type: "uuid", nullable: false),
                    Choice = table.Column<int>(type: "integer", nullable: false),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DateVotes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DateVotes_DateOptions_DateOptionId",
                        column: x => x.DateOptionId,
                        principalTable: "DateOptions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade
                    );
                    table.ForeignKey(
                        name: "FK_DateVotes_Participants_ParticipantId",
                        column: x => x.ParticipantId,
                        principalTable: "Participants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade
                    );
                }
            );

            migrationBuilder.CreateTable(
                name: "ItemClaims",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    EventItemId = table.Column<Guid>(type: "uuid", nullable: false),
                    ParticipantId = table.Column<Guid>(type: "uuid", nullable: false),
                    ClaimedAt = table.Column<DateTimeOffset>(
                        type: "timestamp with time zone",
                        nullable: false,
                        defaultValueSql: "now()"
                    ),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ItemClaims", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ItemClaims_EventItems_EventItemId",
                        column: x => x.EventItemId,
                        principalTable: "EventItems",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade
                    );
                    table.ForeignKey(
                        name: "FK_ItemClaims_Participants_ParticipantId",
                        column: x => x.ParticipantId,
                        principalTable: "Participants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade
                    );
                }
            );

            migrationBuilder.CreateIndex(
                name: "IX_Events_ChosenDateOptionId",
                table: "Events",
                column: "ChosenDateOptionId"
            );

            migrationBuilder.CreateIndex(
                name: "IX_EventItems_AddedByParticipantId",
                table: "EventItems",
                column: "AddedByParticipantId"
            );

            migrationBuilder.CreateIndex(
                name: "IX_EventItems_OrphanedFromParticipantId",
                table: "EventItems",
                column: "OrphanedFromParticipantId"
            );

            migrationBuilder.CreateIndex(
                name: "IX_DateVotes_DateOptionId",
                table: "DateVotes",
                column: "DateOptionId"
            );

            migrationBuilder.CreateIndex(
                name: "IX_DateVotes_Participant_DateOption",
                table: "DateVotes",
                columns: new[] { "ParticipantId", "DateOptionId" },
                unique: true
            );

            migrationBuilder.CreateIndex(
                name: "IX_ItemClaims_EventItem",
                table: "ItemClaims",
                column: "EventItemId",
                unique: true
            );

            migrationBuilder.CreateIndex(
                name: "IX_ItemClaims_ParticipantId",
                table: "ItemClaims",
                column: "ParticipantId"
            );

            migrationBuilder.CreateIndex(
                name: "IX_Participants_EventId",
                table: "Participants",
                column: "EventId"
            );

            migrationBuilder.AddForeignKey(
                name: "FK_EventItems_Participants_AddedByParticipantId",
                table: "EventItems",
                column: "AddedByParticipantId",
                principalTable: "Participants",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull
            );

            migrationBuilder.AddForeignKey(
                name: "FK_EventItems_Participants_OrphanedFromParticipantId",
                table: "EventItems",
                column: "OrphanedFromParticipantId",
                principalTable: "Participants",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull
            );

            migrationBuilder.AddForeignKey(
                name: "FK_Events_DateOptions_ChosenDateOptionId",
                table: "Events",
                column: "ChosenDateOptionId",
                principalTable: "DateOptions",
                principalColumn: "Id"
            );
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_EventItems_Participants_AddedByParticipantId",
                table: "EventItems"
            );

            migrationBuilder.DropForeignKey(
                name: "FK_EventItems_Participants_OrphanedFromParticipantId",
                table: "EventItems"
            );

            migrationBuilder.DropForeignKey(
                name: "FK_Events_DateOptions_ChosenDateOptionId",
                table: "Events"
            );

            migrationBuilder.DropTable(name: "DateVotes");

            migrationBuilder.DropTable(name: "ItemClaims");

            migrationBuilder.DropTable(name: "Participants");

            migrationBuilder.DropIndex(name: "IX_Events_ChosenDateOptionId", table: "Events");

            migrationBuilder.DropIndex(
                name: "IX_EventItems_AddedByParticipantId",
                table: "EventItems"
            );

            migrationBuilder.DropIndex(
                name: "IX_EventItems_OrphanedFromParticipantId",
                table: "EventItems"
            );

            migrationBuilder.DropColumn(name: "ChosenDateOptionId", table: "Events");

            migrationBuilder.DropColumn(name: "AddedByParticipantId", table: "EventItems");

            migrationBuilder.DropColumn(name: "OrphanedFromParticipantId", table: "EventItems");
        }
    }
}
