import { Router, Request, Response } from "express";
import { broadcastAll } from "./sse.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

type Game = {
  id: number;
  name: string;
  players: number[];
  started: boolean;
  deck: string[];
  pile: string[];
};

const games: Game[] = [];
let nextId = 1;

function shuffle(array: string[]): string[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function createDeck(): string[] {
  const colors = ["R", "G", "B", "Y"];
  const numbers = ["0","1","2","3","4","5","6","7","8","9"];
  const deck: string[] = [];

  for (const c of colors) {
    for (const n of numbers) {
      deck.push(c + n);
    }
  }

  return shuffle(deck);
}

router.get("/", (_req: Request, res: Response) => {
  res.json(games);
});

router.post("/", (req: Request, res: Response) => {
  const { name } = req.body as { name: string };

  const game: Game = {
    id: nextId++,
    name,
    players: [],
    started: false,
    deck: [],
    pile: [],
  };

  games.push(game);
  broadcastAll(games);

  res.status(201).json(game);
});

router.post("/:id/join", requireAuth, (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const game = games.find(g => g.id === id);

  if (!game) return res.status(404).json({ error: "Game not found" });

  const user = req.session.user!;

  if (!game.players.includes(user.id)) {
    game.players.push(user.id);
  }

  broadcastAll(games);
  res.json(game);
});

router.post("/:id/start", (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const game = games.find(g => g.id === id);

  if (!game) return res.status(404).json({ error: "Game not found" });

  game.started = true;
  game.deck = createDeck();

  // put first card in pile
  game.pile.push(game.deck.pop()!);

  broadcastAll(games);

  res.json(game);
});

router.post("/:id/play", (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const game = games.find(g => g.id === id);

  if (!game) return res.status(404).json({ error: "Game not found" });

  if (!game.started) {
    return res.status(400).json({ error: "Game not started" });
  }

  const card = game.deck.pop();
  if (card) {
    game.pile.push(card);
    console.log("Played card:", card);
  }

  broadcastAll(games);

  res.json(game);
});

export default router;