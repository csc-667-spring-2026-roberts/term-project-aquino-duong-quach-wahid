// Auth middleware protecting at least one route
import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/", requireAuth, (request: Request, response: Response) => {
  const { user } = request.session;

  response.render("lobby", { user });
});

export default router;
