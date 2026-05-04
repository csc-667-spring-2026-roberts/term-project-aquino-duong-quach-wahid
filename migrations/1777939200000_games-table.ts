import { ColumnDefinitions, MigrationBuilder, PgType } from "node-pg-migrate";

export const shorthands: ColumnDefinitions | undefined = undefined;

// Games table: one row per game session, tracks status, turn direction, and optional winner
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable("games", {
    id: "id",
    status: { type: PgType.VARCHAR, notNull: true, default: "'waiting'" },
    direction: { type: PgType.INTEGER, notNull: true, default: 1 },
    current_player_id: { type: PgType.INTEGER },
    winner_id: { type: PgType.INTEGER },
    draw_until_play: { type: PgType.BOOLEAN, notNull: true, default: false },
    no_mercy: { type: PgType.BOOLEAN, notNull: true, default: false },
    round_number: { type: PgType.INTEGER, notNull: true, default: 1 },
    seven_zero: { type: PgType.BOOLEAN, notNull: true, default: false },
    allow_stacking: { type: PgType.BOOLEAN, notNull: true, default: false },
    allow_jump_in: { type: PgType.BOOLEAN, notNull: true, default: false },
    created_at: { type: PgType.TIMESTAMP, default: pgm.func("NOW()") },
  });

  pgm.addConstraint("games", "fk_games_current_player", "FOREIGN KEY (current_player_id) REFERENCES users(id) ON DELETE SET NULL");
  pgm.addConstraint("games", "fk_games_winner", "FOREIGN KEY (winner_id) REFERENCES users(id) ON DELETE SET NULL");
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable("games");
}
