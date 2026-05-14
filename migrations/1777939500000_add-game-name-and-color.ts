import { ColumnDefinitions, MigrationBuilder, PgType } from "node-pg-migrate";

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumn("games", {
    name: { type: PgType.VARCHAR, notNull: false },
    current_color: { type: PgType.VARCHAR, notNull: false },
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumn("games", "name");
  pgm.dropColumn("games", "current_color");
}