import pgp from "pg-promise";
import dotenv from "dotenv";

dotenv.config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL undefined in process environment");
}

const db = pgp()({
  connectionString,

  ssl: {
    rejectUnauthorized: false,
  },
});

export default db;