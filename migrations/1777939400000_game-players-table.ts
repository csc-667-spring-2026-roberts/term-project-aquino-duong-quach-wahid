import { ColumnDefinitions, MigrationBuilder, PgType } from "node-pg-migrate";

export const shorthands: ColumnDefinitions | undefined = undefined;

// game_players junction table: tracks which users are in which game and their turn order
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable("game_players", {
    game_id: { type: PgType.INTEGER, notNull: true },
    user_id: { type: PgType.INTEGER, notNull: true },
    turn_order: { type: PgType.INTEGER, notNull: true },
    has_called_uno: { type: PgType.BOOLEAN, notNull: true, default: false },
    score: { type: PgType.INTEGER, notNull: true, default: 0 },
    joined_at: { type: PgType.TIMESTAMP, default: pgm.func("NOW()") },
  });

  pgm.addConstraint("game_players", "pk_game_players", "PRIMARY KEY (game_id, user_id)");
  pgm.addConstraint("game_players", "fk_game_players_game", "FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE");
  pgm.addConstraint("game_players", "fk_game_players_user", "FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE");
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable("game_players");
}
