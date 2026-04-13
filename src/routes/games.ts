import { Router, Request, Response } from "express";
import { broadcastAll } from "./sse.js";

const router = Router();

// in-memory games list
const games: { id: number; name: string }[] = [];
let nextId = 1;

// get all games
router.get("/", (_req: Request, res: Response) => {
  res.json(games);
});

// create game
router.post("/", (req: Request, res: Response) => {
  const { name } = req.body as { name: string };
  const game = { id: nextId++, name };
  games.push(game);

  // broadcast to lobby
  broadcastAll(games);

  res.status(201).json(game);
});

export default router;
