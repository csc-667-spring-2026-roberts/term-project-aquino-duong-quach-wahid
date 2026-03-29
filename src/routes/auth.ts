// Registration route (POST /auth/register) — validate input, hash password with bcrypt, insert user, set session
// Login route (POST /auth/login) — look up user, compare password with bcrypt, set session on success
import { Router, Request, Response } from "express";
import bcrypt from "bcrypt";
import Users from "../db/users.js";

const router = Router();

const SALT_ROUNDS = 10;

// validate input, hash password with bcrypt, insert user, set session
router.post("/register", async (request: Request, response: Response) => {
  const { email, password } = request.body as { email: string; password: string };

  // validate input
  if (!email || !password) {
    response.status(400).json({ error: "Email and password required" });
    return;
  }

  if (password.length < 8) {
    response.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }

  try {
    if (await Users.existing(email)) {
      response.status(409).json({ error: "Email is already registered" });
      return;
    }

    // hash password with bcrypt
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // insert user
    const user = await Users.create(email, passwordHash);

    // set session
    request.session.user = { id: user.id, email: user.email };

    response.status(201).json({ ...user });
  } catch (error) {
    console.error(error);
    response.status(500).json({ error: "Registration failed" });
  }
});

// look up user, compare password with bcrypt, set session on success
router.post("/login", async (request: Request, response: Response) => {
  const { email, password } = request.body as { email: string; password: string };

  if (!email || !password) {
    response.status(400).json({ error: "Email and password required" });
    return;
  }

  try {
    // look up user
    const dbUser = await Users.findByEmail(email);

    // compare password with bcrypt
    const match = await bcrypt.compare(password, dbUser.password_hash);

    if (!match) {
      response.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const user = { id: dbUser.id, email: dbUser.email };

    // set session on success
    request.session.user = user;

    response.json({ ...user });
  } catch {
    response.status(401).json({ error: "Invalid email or password" });
  }
});

export default router;
