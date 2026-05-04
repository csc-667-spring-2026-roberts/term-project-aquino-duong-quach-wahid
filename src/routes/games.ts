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
      deck.push(`${color}${String(i)}`);
    }
  }

  return deck;
};

const shuffle = (array: string[]): string[] => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = array[i] as string;
    array[i] = array[j] as string;
    array[j] = temp;
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

  if (!game) {
    res.status(404).json({ error: "Game not found" });
    return;
  }

  const user = req.session.user;
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  if (!game.players.includes(user.id)) {
    game.players.push(user.id);
  }

  broadcastAll(games);
  res.json(game);
});

router.post("/:id/start", requireAuth, (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  const game = games.find((g) => g.id === id);

  if (!game) {
    res.status(404).json({ error: "Game not found" });
    return;
  }

  if (game.started) {
    res.status(400).json({ error: "Already started" });
    return;
  }

  if (game.players.length < 2) {
    res.status(400).json({ error: "Need 2 players" });
    return;
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

  if (!game) {
    res.status(404).json({ error: "Game not found" });
    return;
  }

  if (!game.started) {
    res.status(400).json({ error: "Game not started" });
    return;
  }

  if (!game.deck || game.deck.length === 0) {
    res.status(400).json({ error: "No cards left" });
    return;
  }

  const card = game.deck.pop();

  if (!card) {
    res.status(400).json({ error: "Invalid card" });
    return;
  }

  game.discardPile?.push(card);

  console.log("PLAYED:", card);

  broadcastAll(games);

  res.json({ message: "Card played", card });
});

export default router;
