import { ColumnDefinitions, MigrationBuilder, PgType } from "node-pg-migrate";

export const shorthands: ColumnDefinitions | undefined = undefined;

// Moves table: append-only log of every action taken in a game
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable("moves", {
    id: "id",
    game_id: { type: PgType.INTEGER, notNull: true },
    user_id: { type: PgType.INTEGER, notNull: true },
    card_id: { type: PgType.INTEGER },
    action: { type: PgType.VARCHAR, notNull: true },
    target_user_id: { type: PgType.INTEGER },
    chosen_color: { type: PgType.VARCHAR },
    is_challenged: { type: PgType.BOOLEAN, notNull: true, default: false },
    challenge_result: { type: PgType.BOOLEAN },
    created_at: { type: PgType.TIMESTAMP, default: pgm.func("NOW()") },
  });

  pgm.addConstraint("moves", "fk_moves_game", "FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE");
  pgm.addConstraint("moves", "fk_moves_user", "FOREIGN KEY (user_id) REFERENCES users(id)");
  pgm.addConstraint("moves", "fk_moves_card", "FOREIGN KEY (card_id) REFERENCES cards(id)");
  pgm.addConstraint("moves", "fk_moves_target_user", "FOREIGN KEY (target_user_id) REFERENCES users(id)");

  pgm.createIndex("moves", "game_id");
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable("moves");
}
