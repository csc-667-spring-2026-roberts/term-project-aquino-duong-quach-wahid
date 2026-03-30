// Registration route (POST /auth/register) — validate input, hash password with bcrypt, insert user, set session
// Login route (POST /auth/login) — look up user, compare password with bcrypt, set session on success
// Logout route (POST /auth/logout) — destroy session
import { Router, Request, Response } from "express";
import bcrypt from "bcrypt";
import Users from "../db/users.js";

const router = Router();

const SALT_ROUNDS = 10;

router.get("/register", (_request, response) => {
  response.render("auth/register");
});

// validate input, hash password with bcrypt, insert user, set session
router.post("/register", async (request: Request, response: Response) => {
  const { email, password } = request.body as { email: string; password: string };

  // validate input
  if (!email || !password) {
    response.render("auth/register", { error: "Email and password required" });
    return;
  }

  if (password.length < 8) {
    response.render("auth/register", { error: "Password must be at least 8 characters" });
    return;
  }

  try {
    if (await Users.existing(email)) {
      response.render("auth/register", { error: "Email is already registered" });
      return;
    }

    // hash password with bcrypt
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // insert user
    const user = await Users.create(email, passwordHash);

    // set session
    request.session.user = { id: user.id, email: user.email };

    response.redirect("/lobby");
  } catch (error) {
    console.error(error);
    response.status(500).render("auth/register", { error: "Registration failed" });
  }
});

router.get("/login", (_request, response) => {
  response.render("auth/login");
});

// look up user, compare password with bcrypt, set session on success
router.post("/login", async (request: Request, response: Response) => {
  const { email, password } = request.body as { email: string; password: string };

  if (!email || !password) {
    response.render("auth/login", { error: "Email and password required" });
    return;
  }

  try {
    // look up user
    const dbUser = await Users.findByEmail(email);

    // compare password with bcrypt
    const match = await bcrypt.compare(password, dbUser.password_hash);

    if (!match) {
      response.render("auth/login", { error: "Invalid email or password" });
      return;
    }

    const user = { id: dbUser.id, email: dbUser.email };

    // set session on success
    request.session.user = user;
    response.redirect("/lobby");
  } catch {
    response.render("auth/login", { error: "Invalid email or password" });
  }
});

// destroy session
router.post("/logout", (request: Request, response: Response) => {
  request.session.destroy((error) => {
    if (error) {
      console.error(error);
      response.status(500).render("auth/login", { error: "Logout failed" });
      return;
    }

    response.clearCookie("connect.sid");
    response.redirect("/auth/login");
  });
});

export default router;
