using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AgriTech.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class InitialPostGisBaseline : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterDatabase()
                .Annotation("Npgsql:PostgresExtension:postgis", ",,")
                .Annotation("Npgsql:PostgresExtension:uuid-ossp", ",,");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {

        }
    }
}
