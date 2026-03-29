import { ColumnDefinitions, MigrationBuilder, PgType } from "node-pg-migrate";

export const shorthands: ColumnDefinitions | undefined = undefined;

// Session persistence using connect-pg-simple (sessions survive server restart)
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable("session", {
    sid: { type: PgType.VARCHAR, notNull: true, primaryKey: true },
    sess: { type: PgType.JSON, notNull: true },
    expire: { type: PgType.TIMESTAMP, notNull: true },
  });

  pgm.createIndex("session", "expire");
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable("session");
}
