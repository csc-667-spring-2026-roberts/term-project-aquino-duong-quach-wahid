import { Router, Request, Response } from "express";
import { broadcastAll } from "./sse.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// in-memory games list
const games: { id: number; name: string; players: number[] }[] = [];
let nextId = 1;

// get all games
router.get("/", (_req: Request, res: Response) => {
  res.json(games);
});

// create game
router.post("/", (req: Request, res: Response) => {
  const { name } = req.body as { name: string };
  const game = { id: nextId++, name, players: [] };
  games.push(game);
  broadcastAll(games);
  res.status(201).json(game);
});

// join game
router.post("/:id/join", requireAuth, (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  const game = games.find((g) => g.id === id);
  if (!game) {
    res.status(404).json({ error: "Game not found" });
    return;
  }
  const user = req.session.user!;
  if (!game.players.includes(user.id)) {
    game.players.push(user.id);
  }
  broadcastAll(games);
  res.status(200).json(game);
});

export default router;
