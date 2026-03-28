import { ColumnDefinitions, MigrationBuilder, PgType } from "node-pg-migrate";

export const shorthands: ColumnDefinitions | undefined = undefined;

// Users table with email, hashed password, and created_at
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable("users", {
    id: "id",
    email: { type: PgType.VARCHAR, notNull: true, unique: true },
    password_hash: { type: PgType.VARCHAR, notNull: true },
    created_at: { type: PgType.TIMESTAMP, default: pgm.func("NOW()") },
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable("users");
}
