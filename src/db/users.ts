// insert user
import db from "./connection.js";
import { User, DbUser } from "../types/user.js";

const existing = async (email: string): Promise<boolean> => {
  try {
    await db.none("SELECT id FROM users WHERE email = $1", [email]);
    return false;
  } catch {
    return true;
  }
};

const create = async (
  email: string,
  passwordHash: string,
): Promise<User> =>
  await db.one<User>(
    "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email",
    [email, passwordHash],
  );

const findByEmail = async (email: string): Promise<DbUser> =>
  await db.one<DbUser>("SELECT * FROM users WHERE email = $1", [email]);

export default { existing, create, findByEmail };
