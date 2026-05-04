import { ColumnDefinitions, MigrationBuilder, PgType } from "node-pg-migrate";

export const shorthands: ColumnDefinitions | undefined = undefined;

// game_cards junction table: tracks each card's location (deck, hand, discard) per game
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable("game_cards", {
    id: "id",
    game_id: { type: PgType.INTEGER, notNull: true },
    card_id: { type: PgType.INTEGER, notNull: true },
    location: { type: PgType.VARCHAR, notNull: true },
    user_id: { type: PgType.INTEGER },
    position: { type: PgType.INTEGER, notNull: true },
    chosen_color: { type: PgType.VARCHAR },
  });

  pgm.addConstraint("game_cards", "fk_game_cards_game", "FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE");
  pgm.addConstraint("game_cards", "fk_game_cards_card", "FOREIGN KEY (card_id) REFERENCES cards(id)");
  pgm.addConstraint("game_cards", "fk_game_cards_user", "FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL");

  pgm.createIndex("game_cards", ["game_id", "location"]);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable("game_cards");
}
