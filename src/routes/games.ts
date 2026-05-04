import { Router, Request, Response } from "express";
import { broadcastAll } from "./sse.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

type Game = {
  id: number;
  name: string;
  players: number[];
  started?: boolean;
  deck?: string[];
  discardPile?: string[];
};

const games: Game[] = [];
let nextId = 1;

const createDeck = (): string[] => {
  const colors = ["R", "G", "B", "Y"];
  const deck: string[] = [];

  for (const color of colors) {
    for (let i = 0; i <= 9; i++) {
      deck.push(`${color}${i}`);
    }
  }

  return deck;
};

const shuffle = (array: string[]): string[] => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

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
    discardPile: [],
  };

  games.push(game);
  broadcastAll(games);

  res.status(201).json(game);
});

router.post("/:id/join", requireAuth, (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  const game = games.find((g) => g.id === id);

  if (!game) return res.status(404).json({ error: "Game not found" });

  const user = req.session.user;
  if (!user) return res.status(401).json({ error: "Not authenticated" });

  if (!game.players.includes(user.id)) {
    game.players.push(user.id);
  }

  broadcastAll(games);
  res.json(game);
});

router.post("/:id/start", requireAuth, (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  const game = games.find((g) => g.id === id);

  if (!game) return res.status(404).json({ error: "Game not found" });

  if (game.started) {
    return res.status(400).json({ error: "Already started" });
  }

  if (game.players.length < 2) {
    return res.status(400).json({ error: "Need 2 players" });
  }

  const deck = shuffle(createDeck());

  game.deck = deck;
  game.discardPile = [];
  game.started = true;

  console.log("GAME STARTED:", game.id);

  broadcastAll(games);

  res.json({ message: "Game started", game });
});

router.post("/:id/play", requireAuth, (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  const game = games.find((g) => g.id === id);

  if (!game) return res.status(404).json({ error: "Game not found" });

  if (!game.started) {
    return res.status(400).json({ error: "Game not started" });
  }

  if (!game.deck || game.deck.length === 0) {
    return res.status(400).json({ error: "No cards left" });
  }

  const card = game.deck.pop();

  if (!card) {
    return res.status(400).json({ error: "Invalid card" });
  }

  game.discardPile?.push(card);

  console.log("PLAYED:", card);

  broadcastAll(games);

  res.json({ message: "Card played", card });
});

export default router;