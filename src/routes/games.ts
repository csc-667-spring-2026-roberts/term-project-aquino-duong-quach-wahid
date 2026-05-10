import { Router, Request, Response } from "express";
import { broadcastAll } from "./sse.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

type Game = {
  id: number;
  name: string;
  players: number[];
  started?: boolean;
  hands?: Record<number, string[]>;
  drawPile?: string[];
  discardPile?: string[];
  currentPlayerIndex?: number;
  direction?: number;
  currentColor?: string;
};

const games: Game[] = [];
let nextId = 1;

// 108-card UNO deck: one 0, two 1-9, two each of Skip/Reverse/Draw2 per color, four Wild and Wild Draw 4
const createDeck = (): string[] => {
  const colors = ["R", "G", "B", "Y"];
  const deck: string[] = [];

  for (const color of colors) {
    deck.push(`${color}0`);
    for (let i = 1; i <= 9; i++) {
      deck.push(`${color}${String(i)}`);
      deck.push(`${color}${String(i)}`);
    }
    for (let k = 0; k < 2; k++) {
      deck.push(`${color}Sk`);
      deck.push(`${color}Rv`);
      deck.push(`${color}D2`);
    }
  }

  for (let k = 0; k < 4; k++) {
    deck.push("Wl");
    deck.push("WD4");
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

const cardColor = (card: string): string => card[0] ?? "W";
const cardValue = (card: string): string => card.slice(1);

const isPlayable = (card: string, topCard: string, currentColor: string): boolean => {
  const c = cardColor(card);
  if (c === "W") return true;
  if (c === currentColor) return true;
  if (cardValue(card) === cardValue(topCard) && cardColor(topCard) !== "W") return true;
  return false;
};

// Reshuffle discard pile (minus top card) back into draw pile when deck runs out
const reshuffleDeck = (game: Game): void => {
  const discard = game.discardPile;
  if (!discard || discard.length <= 1) return;
  const top = discard[discard.length - 1] as string;
  game.drawPile = shuffle(discard.slice(0, -1));
  game.discardPile = [top];
};

const drawOneCard = (game: Game, playerId: number): string | null => {
  if (!game.drawPile || game.drawPile.length === 0) reshuffleDeck(game);
  const drawPile = game.drawPile;
  if (!drawPile || drawPile.length === 0) return null;
  const card = drawPile.pop() as string;
  if (!game.hands) game.hands = {};
  const hand = game.hands[playerId] ?? [];
  hand.push(card);
  game.hands[playerId] = hand;
  return card;
};

const advanceTurn = (game: Game, steps: number): void => {
  const playerCount = game.players.length;
  const dir = game.direction ?? 1;
  game.currentPlayerIndex =
    ((((game.currentPlayerIndex ?? 0) + dir * steps) % playerCount) + playerCount) % playerCount;
};

// Apply Skip/Reverse/Draw2/Wild/WildDraw4 effects and advance turn
const applyCardEffect = (game: Game, card: string): void => {
  const dir = game.direction ?? 1;
  const idx = game.currentPlayerIndex ?? 0;
  const playerCount = game.players.length;

  if (card === "WD4") {
    const nextIdx = (((idx + dir) % playerCount) + playerCount) % playerCount;
    const nextPlayerId = game.players[nextIdx];
    if (nextPlayerId !== undefined) {
      for (let k = 0; k < 4; k++) drawOneCard(game, nextPlayerId);
    }
    advanceTurn(game, 2);
  } else if (cardValue(card) === "Rv") {
    game.direction = dir * -1;
    advanceTurn(game, playerCount === 2 ? 2 : 1);
  } else if (cardValue(card) === "Sk") {
    advanceTurn(game, 2);
  } else if (cardValue(card) === "D2") {
    const nextIdx = (((idx + dir) % playerCount) + playerCount) % playerCount;
    const nextPlayerId = game.players[nextIdx];
    if (nextPlayerId !== undefined) {
      for (let k = 0; k < 2; k++) drawOneCard(game, nextPlayerId);
    }
    advanceTurn(game, 2);
  } else {
    advanceTurn(game, 1);
  }
};

// Validate the card play, mutate game state, and return an error string or null on success
const applyPlay = (game: Game, userId: number, card: string, color?: string): string | null => {
  const hands: Record<number, string[]> = game.hands ?? {};
  const hand = hands[userId] ?? [];
  const cardIdx = hand.indexOf(card);
  if (cardIdx === -1) return "Card not in hand";

  const discardPile = game.discardPile ?? [];
  const topCard = discardPile[discardPile.length - 1] ?? "";
  const currentColor = game.currentColor ?? cardColor(topCard);
  if (!isPlayable(card, topCard, currentColor)) return "Card does not match";

  if ((card === "Wl" || card === "WD4") && (!color || !["R", "G", "B", "Y"].includes(color))) {
    return "Choose a color for wild";
  }

  hand.splice(cardIdx, 1);
  game.discardPile = [...discardPile, card];
  game.currentColor = cardColor(card) === "W" ? (color ?? "R") : cardColor(card);
  applyCardEffect(game, card);

  return null;
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

  // Deal 7 cards to each player
  const hands: Record<number, string[]> = {};
  for (const playerId of game.players) {
    hands[playerId] = deck.splice(0, 7);
  }
  game.hands = hands;

  // Flip first non-WD4 card to start the discard pile
  let startCard = deck.pop() as string;
  while (startCard === "WD4" && deck.length > 0) {
    deck.unshift(startCard);
    startCard = deck.pop() as string;
  }

  game.drawPile = deck;
  game.discardPile = [startCard];
  game.currentColor = cardColor(startCard) === "W" ? "R" : cardColor(startCard);
  game.started = true;
  game.currentPlayerIndex = 0;
  game.direction = 1;

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

  const user = req.session.user;
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const currentPlayerId = game.players[game.currentPlayerIndex ?? 0];
  if (user.id !== currentPlayerId) {
    res.status(403).json({ error: "Not your turn" });
    return;
  }

  const { card, color } = req.body as { card: string; color?: string };
  const err = applyPlay(game, user.id, card, color);
  if (err) {
    res.status(400).json({ error: err });
    return;
  }

  console.log("PLAYED:", card);

  broadcastAll(games);
  res.json({ message: "Card played", card });
});

router.post("/:id/draw", requireAuth, (req: Request, res: Response) => {
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

  const user = req.session.user;
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const currentPlayerId = game.players[game.currentPlayerIndex ?? 0];
  if (user.id !== currentPlayerId) {
    res.status(403).json({ error: "Not your turn" });
    return;
  }

  const drawnCard = drawOneCard(game, user.id);
  if (!drawnCard) {
    res.status(400).json({ error: "No cards left" });
    return;
  }

  advanceTurn(game, 1);

  console.log("DREW:", drawnCard);

  broadcastAll(games);
  res.json({ message: "Card drawn", card: drawnCard });
});

export default router;
