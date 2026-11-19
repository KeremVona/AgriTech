using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AgriTech.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddDiseaseAdvisoriesCache : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "disease_advisories",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "uuid_generate_v4()"),
                    class_key = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    crop = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    condition = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    scientific_name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    severity = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    immediate_action = table.Column<string>(type: "text", nullable: false),
                    recommended_treatments = table.Column<string>(type: "jsonb", nullable: false),
                    microclimate_risk = table.Column<string>(type: "text", nullable: false),
                    llm_model = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_disease_advisories", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_disease_advisories_class_key",
                table: "disease_advisories",
                column: "class_key",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "disease_advisories");
        }
    }
}
