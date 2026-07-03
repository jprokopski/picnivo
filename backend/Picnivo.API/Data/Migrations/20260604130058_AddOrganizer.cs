using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Picnivo.API.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddOrganizer : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Organizers",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    DisplayName = table.Column<string>(
                        type: "character varying(100)",
                        maxLength: 100,
                        nullable: false
                    ),
                    CreatedAt = table.Column<DateTimeOffset>(
                        type: "timestamp with time zone",
                        nullable: false,
                        defaultValueSql: "now()"
                    ),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Organizers", x => x.Id);
                }
            );

            migrationBuilder.Sql(
                """
                ALTER TABLE "Organizers"
                ADD CONSTRAINT fk_organizers_auth_users
                FOREIGN KEY ("Id") REFERENCES auth.users(id) ON DELETE CASCADE;
                """
            );

            migrationBuilder.Sql(
                """
                CREATE OR REPLACE FUNCTION public.handle_new_user()
                RETURNS TRIGGER AS $$
                BEGIN
                  INSERT INTO public."Organizers" ("Id", "DisplayName", "CreatedAt")
                  VALUES (
                    NEW.id,
                    COALESCE(NEW.raw_user_meta_data ->> 'display_name', NEW.raw_user_meta_data ->> 'full_name', 'Organizer'),
                    NOW()
                  );
                  RETURN NEW;
                END;
                $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
                """
            );

            migrationBuilder.Sql(
                """
                CREATE TRIGGER on_auth_user_created
                  AFTER INSERT ON auth.users
                  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
                """
            );
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;");
            migrationBuilder.Sql("DROP FUNCTION IF EXISTS public.handle_new_user();");
            migrationBuilder.Sql(
                """ALTER TABLE "Organizers" DROP CONSTRAINT IF EXISTS fk_organizers_auth_users;"""
            );

            migrationBuilder.DropTable(name: "Organizers");
        }
    }
}
