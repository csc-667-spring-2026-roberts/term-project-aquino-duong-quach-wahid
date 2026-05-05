import { ColumnDefinitions, MigrationBuilder, PgType } from "node-pg-migrate";

export const shorthands: ColumnDefinitions | undefined = undefined;

// Cards table: static lookup of all 108 UNO cards, seeded once on migration
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable("cards", {
    id: "id",
    color: { type: PgType.VARCHAR, notNull: true },
    value: { type: PgType.VARCHAR, notNull: true },
    type: { type: PgType.VARCHAR, notNull: true },
  });

  const colors = ["RED", "GREEN", "BLUE", "YELLOW"];
  const rows: string[] = [];

  for (const color of colors) {
    rows.push(`('${color}', '0', 'NUMBER')`);
    for (let v = 1; v <= 9; v++) {
      rows.push(`('${color}', '${v}', 'NUMBER')`);
      rows.push(`('${color}', '${v}', 'NUMBER')`);
    }
    for (let i = 0; i < 2; i++) {
      rows.push(`('${color}', 'SKIP', 'ACTION')`);
      rows.push(`('${color}', 'REVERSE', 'ACTION')`);
      rows.push(`('${color}', 'DRAW_TWO', 'ACTION')`);
    }
  }

  for (let i = 0; i < 4; i++) {
    rows.push(`('WILD', 'WILD', 'WILD')`);
    rows.push(`('WILD', 'WILD_DRAW_FOUR', 'WILD')`);
  }

  pgm.sql(`INSERT INTO cards (color, value, type) VALUES ${rows.join(", ")}`);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable("cards");
}
