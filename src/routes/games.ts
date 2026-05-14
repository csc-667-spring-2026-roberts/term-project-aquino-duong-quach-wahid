/* eslint-disable */

import { Router, Request, Response } from "express";
import { broadcastAll } from "./sse.js";
import { requireAuth } from "../middleware/auth.js";
import db from "../db/connection.js";

const router = Router();

const dbColorToCode = (color: string): string => {
  if (color === "RED") return "R";
  if (color === "GREEN") return "G";
  if (color === "BLUE") return "B";
  if (color === "YELLOW") return "Y";
  return "W";
};

const dbValueToCode = (value: string): string => {
  if (value === "SKIP") return "Sk";
  if (value === "REVERSE") return "Rv";
  if (value === "DRAW_TWO") return "D2";
  if (value === "WILD") return "l";
  if (value === "WILD_DRAW_FOUR") return "D4";
  return value;
};

const cardCode = (color: string, value: string): string => {
  const c = dbColorToCode(color);
  const v = dbValueToCode(value);
  if (c === "W") return v === "l" ? "Wl" : "WD4";
  return `${c}${v}`;
};

const codeToDbColor = (colorCode: string): string => {
  if (colorCode === "R") return "RED";
  if (colorCode === "G") return "GREEN";
  if (colorCode === "B") return "BLUE";
  if (colorCode === "Y") return "YELLOW";
  return "WILD";
};

const codeToDbValue = (valueCode: string): string => {
  if (valueCode === "Sk") return "SKIP";
  if (valueCode === "Rv") return "REVERSE";
  if (valueCode === "D2") return "DRAW_TWO";
  return valueCode;
};

const parseCardCode = (code: string): { color: string; value: string } => {
  if (code === "Wl") return { color: "WILD", value: "WILD" };
  if (code === "WD4") return { color: "WILD", value: "WILD_DRAW_FOUR" };
  const colorCode = code[0] ?? "R";
  const valueCode = code.slice(1);
  return { color: codeToDbColor(colorCode), value: codeToDbValue(valueCode) };
};

const letterToDbColor = (letter: string): string => {
  if (letter === "R") return "RED";
  if (letter === "G") return "GREEN";
  if (letter === "B") return "BLUE";
  if (letter === "Y") return "YELLOW";
  return "RED";
};

const cardColorOf = (code: string): string => code[0] ?? "W";
const cardValueOf = (code: string): string => code.slice(1);

const isPlayable = (card: string, topCard: string, currentColor: string): boolean => {
  const c = cardColorOf(card);
  if (c === "W") return true;
  if (c === currentColor) return true;
  if (topCard && cardValueOf(card) === cardValueOf(topCard) && cardColorOf(topCard) !== "W")
    return true;
  return false;
};

type PlayerRow = { user_id: number; turn_order: number };

 
const drawCardsInTx = async (
  t: any,
  gameId: number,
  userId: number,
  count: number,
): Promise<void> => {
  for (let i = 0; i < count; i++) {
    let topDeck = await t.oneOrNone(
      `SELECT id FROM game_cards WHERE game_id = $1 AND location = 'deck' ORDER BY position LIMIT 1`,
      [gameId],
    );

    if (!topDeck) {
      const topDiscard = await t.oneOrNone(
        `SELECT id FROM game_cards WHERE game_id = $1 AND location = 'discard'
         ORDER BY position DESC LIMIT 1`,
        [gameId],
      );
      if (!topDiscard) return;

      const others = await t.manyOrNone(
        `SELECT id FROM game_cards WHERE game_id = $1 AND location = 'discard' AND id != $2`,
        [gameId, topDiscard.id],
      );

      const shuffled = others.sort(() => Math.random() - 0.5) as { id: number }[];
      for (let j = 0; j < shuffled.length; j++) {
        await t.none(
          `UPDATE game_cards SET location = 'deck', user_id = NULL, position = $1 WHERE id = $2`,
          [j, shuffled[j]!.id],
        );
      }

      topDeck = await t.oneOrNone(
        `SELECT id FROM game_cards WHERE game_id = $1 AND location = 'deck' ORDER BY position LIMIT 1`,
        [gameId],
      );
      if (!topDeck) return;
    }

    await t.none(`UPDATE game_cards SET location = 'hand', user_id = $1 WHERE id = $2`, [
      userId,
      topDeck.id,
    ]);
  }
};

const buildGameState = async (gameId: number) => {
  const game = await db.oneOrNone<{
    id: number;
    name: string;
    status: string;
    direction: number;
    current_player_id: number | null;
    current_color: string | null;
  }>(
    `SELECT id, name, status, direction, current_player_id, current_color
     FROM games WHERE id = $1`,
    [gameId],
  );
  if (!game) return null;

  const players = await db.manyOrNone<PlayerRow>(
    `SELECT user_id, turn_order FROM game_players WHERE game_id = $1 ORDER BY turn_order`,
    [gameId],
  );
  const playerIds = players.map((p) => p.user_id);

  const gameCards = await db.manyOrNone<{
    user_id: number | null;
    color: string;
    value: string;
    location: string;
    position: number;
  }>(
    `SELECT gc.user_id, c.color, c.value, gc.location, gc.position
     FROM game_cards gc JOIN cards c ON c.id = gc.card_id
     WHERE gc.game_id = $1`,
    [gameId],
  );

  const hands: Record<number, string[]> = {};
  const discardEntries: { position: number; code: string }[] = [];
  let drawPileCount = 0;

  for (const row of gameCards) {
    const code = cardCode(row.color, row.value);
    if (row.location === "hand" && row.user_id !== null && row.user_id !== undefined) {
      const uid = row.user_id;
      if (!hands[uid]) hands[uid] = [];
      hands[uid].push(code);
    } else if (row.location === "discard") {
      discardEntries.push({ position: row.position, code });
    } else if (row.location === "deck") {
      drawPileCount++;
    }
  }

  discardEntries.sort((a, b) => a.position - b.position);
  const discardPile = discardEntries.map((e) => e.code);
  const topCard = discardPile[discardPile.length - 1] ?? "";
  const currentColor = game.current_color
    ? dbColorToCode(game.current_color)
    : topCard
      ? cardColorOf(topCard)
      : "R";

  const currentPlayerIndex =
    game.current_player_id !== null ? playerIds.indexOf(game.current_player_id) : 0;

  return {
    id: game.id,
    name: game.name ?? `Game ${String(game.id)}`,
    players: playerIds,
    started: game.status === "playing" || game.status === "finished",
    hands,
    drawPile: Array(drawPileCount).fill("?") as string[],
    discardPile,
    currentPlayerIndex,
    direction: game.direction,
    currentColor,
  };
};

const getAllGamesState = async () => {
  const rows = await db.manyOrNone<{ id: number }>(`SELECT id FROM games ORDER BY id`);
  const states = await Promise.all(rows.map((r) => buildGameState(r.id)));
  return states.filter(Boolean);
};

const broadcastGames = async (): Promise<void> => {
  try {
    const states = await getAllGamesState();
    broadcastAll(states);
  } catch (err) {
    console.error("broadcastGames error:", err);
  }
};

router.get("/", async (_req: Request, res: Response) => {
  try {
    const states = await getAllGamesState();
    res.json(states);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load games" });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const { name } = req.body as { name?: string };
    const gameName = name ?? `Game ${String(Date.now())}`;
    const row = await db.one<{ id: number }>(
      `INSERT INTO games (name, status, direction) VALUES ($1, 'waiting', 1) RETURNING id`,
      [gameName],
    );
    await broadcastGames();
    res.status(201).json({ id: row.id, name: gameName });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create game" });
  }
});

router.post("/:id/join", requireAuth, async (req: Request, res: Response) => {
  try {
    const gameId = parseInt(req.params.id as string);
    const user = req.session.user!;

    const game = await db.oneOrNone<{ status: string }>(`SELECT status FROM games WHERE id = $1`, [
      gameId,
    ]);
    if (!game) {
      res.status(404).json({ error: "Game not found" });
      return;
    }
    if (game.status !== "waiting") {
      res.status(400).json({ error: "Game already started" });
      return;
    }

    const existing = await db.oneOrNone(
      `SELECT 1 FROM game_players WHERE game_id = $1 AND user_id = $2`,
      [gameId, user.id],
    );

    if (!existing) {
      const maxRow = await db.oneOrNone<{ max: number | null }>(
        `SELECT MAX(turn_order) AS max FROM game_players WHERE game_id = $1`,
        [gameId],
      );
      const nextOrder = (maxRow?.max ?? -1) + 1;
      await db.none(`INSERT INTO game_players (game_id, user_id, turn_order) VALUES ($1, $2, $3)`, [
        gameId,
        user.id,
        nextOrder,
      ]);
    }

    await broadcastGames();
    res.json({ message: "Joined" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to join game" });
  }
});

router.post("/:id/start", requireAuth, async (req: Request, res: Response) => {
  try {
    const gameId = parseInt(req.params.id as string);

    const game = await db.oneOrNone<{ status: string }>(`SELECT status FROM games WHERE id = $1`, [
      gameId,
    ]);
    if (!game) {
      res.status(404).json({ error: "Game not found" });
      return;
    }
    if (game.status !== "waiting") {
      res.status(400).json({ error: "Already started" });
      return;
    }

    const players = await db.manyOrNone<PlayerRow>(
      `SELECT user_id, turn_order FROM game_players WHERE game_id = $1 ORDER BY turn_order`,
      [gameId],
    );
    if (players.length < 2) {
      res.status(400).json({ error: "Need at least 2 players" });
      return;
    }

    const allCards = await db.manyOrNone<{ id: number; color: string; value: string }>(
      `SELECT id, color, value FROM cards ORDER BY RANDOM()`,
    );

    await db.tx(async (t) => {
      for (let i = 0; i < allCards.length; i++) {
        await t.none(
          `INSERT INTO game_cards (game_id, card_id, location, position) VALUES ($1, $2, 'deck', $3)`,
          [gameId, allCards[i]!.id, i],
        );
      }

      let deckPos = 0;
      for (const player of players) {
        for (let k = 0; k < 7; k++) {
          await t.none(
            `UPDATE game_cards SET location = 'hand', user_id = $1
             WHERE game_id = $2 AND position = $3 AND location = 'deck'`,
            [player.user_id, gameId, deckPos++],
          );
        }
      }

      let startCardIdx = deckPos;
      for (let i = deckPos; i < allCards.length; i++) {
        const c = allCards[i]!;
        if (!(c.color === "WILD" && c.value === "WILD_DRAW_FOUR")) {
          startCardIdx = i;
          break;
        }
      }
      const startCard = allCards[startCardIdx]!;

      await t.none(
        `UPDATE game_cards SET location = 'discard', position = 0, user_id = NULL
         WHERE game_id = $1 AND position = $2`,
        [gameId, startCardIdx],
      );

      const startColor = startCard.color === "WILD" ? "RED" : startCard.color;
      const firstPlayer = players[0]!;

      await t.none(
        `UPDATE games SET status = 'playing', current_player_id = $1, current_color = $2, direction = 1 WHERE id = $3`,
        [firstPlayer.user_id, startColor, gameId],
      );
    });

    console.log("GAME STARTED:", gameId);
    await broadcastGames();
    res.json({ message: "Game started" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to start game" });
  }
});

router.post("/:id/play", requireAuth, async (req: Request, res: Response) => {
  try {
    const gameId = parseInt(req.params.id as string);
    const user = req.session.user!;
    const { card: playedCode, color: chosenColorLetter } = req.body as {
      card: string;
      color?: string;
    };

    const game = await db.oneOrNone<{
      status: string;
      direction: number;
      current_player_id: number;
      current_color: string;
    }>(`SELECT status, direction, current_player_id, current_color FROM games WHERE id = $1`, [
      gameId,
    ]);
    if (!game) {
      res.status(404).json({ error: "Game not found" });
      return;
    }
    if (game.status !== "playing") {
      res.status(400).json({ error: "Game not started" });
      return;
    }
    if (user.id !== game.current_player_id) {
      res.status(403).json({ error: "Not your turn" });
      return;
    }

    const { color: dbColor, value: dbValue } = parseCardCode(playedCode);
    const handCard = await db.oneOrNone<{ id: number }>(
      `SELECT gc.id
       FROM game_cards gc JOIN cards c ON c.id = gc.card_id
       WHERE gc.game_id = $1 AND gc.location = 'hand' AND gc.user_id = $2
         AND c.color = $3 AND c.value = $4
       LIMIT 1`,
      [gameId, user.id, dbColor, dbValue],
    );
    if (!handCard) {
      res.status(400).json({ error: "Card not in hand" });
      return;
    }

    const topRow = await db.oneOrNone<{ color: string; value: string }>(
      `SELECT c.color, c.value
       FROM game_cards gc JOIN cards c ON c.id = gc.card_id
       WHERE gc.game_id = $1 AND gc.location = 'discard'
       ORDER BY gc.position DESC LIMIT 1`,
      [gameId],
    );
    const topCard = topRow ? cardCode(topRow.color, topRow.value) : "";
    const currentColorLetter = dbColorToCode(game.current_color ?? "RED");

    if (!isPlayable(playedCode, topCard, currentColorLetter)) {
      res.status(400).json({ error: "Card does not match" });
      return;
    }

    if (
      (playedCode === "Wl" || playedCode === "WD4") &&
      (!chosenColorLetter || !["R", "G", "B", "Y"].includes(chosenColorLetter))
    ) {
      res.status(400).json({ error: "Choose a color for wild card" });
      return;
    }

    const players = await db.manyOrNone<PlayerRow>(
      `SELECT user_id, turn_order FROM game_players WHERE game_id = $1 ORDER BY turn_order`,
      [gameId],
    );
    const playerIds = players.map((p) => p.user_id);
    const currentIdx = playerIds.indexOf(user.id);
    const playerCount = playerIds.length;
    const dir = game.direction;

    const newDbColor =
      cardColorOf(playedCode) === "W" ? letterToDbColor(chosenColorLetter ?? "R") : dbColor;

    await db.tx(async (t) => {
      const maxPosRow = await t.oneOrNone<{ max: number | null }>(
        `SELECT MAX(position) AS max FROM game_cards WHERE game_id = $1 AND location = 'discard'`,
        [gameId],
      );
      const newDiscardPos = (maxPosRow?.max ?? -1) + 1;
      await t.none(
        `UPDATE game_cards SET location = 'discard', user_id = NULL, position = $1 WHERE id = $2`,
        [newDiscardPos, handCard.id],
      );

      let newDirection = dir;
      let nextIdx = currentIdx;
      const val = cardValueOf(playedCode);

      if (playedCode === "WD4") {
        const target = (((currentIdx + dir) % playerCount) + playerCount) % playerCount;
        await drawCardsInTx(t, gameId, playerIds[target]!, 4);
        nextIdx = (((currentIdx + dir * 2) % playerCount) + playerCount) % playerCount;
      } else if (val === "Rv") {
        newDirection = dir * -1;
        nextIdx =
          playerCount === 2
            ? (((currentIdx + newDirection * 2) % playerCount) + playerCount) % playerCount
            : (((currentIdx + newDirection) % playerCount) + playerCount) % playerCount;
      } else if (val === "Sk") {
        nextIdx = (((currentIdx + dir * 2) % playerCount) + playerCount) % playerCount;
      } else if (val === "D2") {
        const target = (((currentIdx + dir) % playerCount) + playerCount) % playerCount;
        await drawCardsInTx(t, gameId, playerIds[target]!, 2);
        nextIdx = (((currentIdx + dir * 2) % playerCount) + playerCount) % playerCount;
      } else {
        nextIdx = (((currentIdx + dir) % playerCount) + playerCount) % playerCount;
      }

      const nextPlayerId = playerIds[nextIdx]!;

      await t.none(
        `UPDATE games SET current_player_id = $1, current_color = $2, direction = $3 WHERE id = $4`,
        [nextPlayerId, newDbColor, newDirection, gameId],
      );

      await t.none(
        `INSERT INTO moves (game_id, user_id, card_id, action, chosen_color)
         VALUES ($1, $2, (SELECT card_id FROM game_cards WHERE id = $3), 'play', $4)`,
        [gameId, user.id, handCard.id, chosenColorLetter ?? null],
      );
    });

    console.log("PLAYED:", playedCode, "in game", gameId);
    await broadcastGames();
    res.json({ message: "Card played", card: playedCode });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to play card" });
  }
});

router.post("/:id/draw", requireAuth, async (req: Request, res: Response) => {
  try {
    const gameId = parseInt(req.params.id as string);
    const user = req.session.user!;

    const game = await db.oneOrNone<{
      status: string;
      direction: number;
      current_player_id: number;
    }>(`SELECT status, direction, current_player_id FROM games WHERE id = $1`, [gameId]);
    if (!game) {
      res.status(404).json({ error: "Game not found" });
      return;
    }
    if (game.status !== "playing") {
      res.status(400).json({ error: "Game not started" });
      return;
    }
    if (user.id !== game.current_player_id) {
      res.status(403).json({ error: "Not your turn" });
      return;
    }

    const players = await db.manyOrNone<PlayerRow>(
      `SELECT user_id, turn_order FROM game_players WHERE game_id = $1 ORDER BY turn_order`,
      [gameId],
    );
    const playerIds = players.map((p) => p.user_id);
    const currentIdx = playerIds.indexOf(user.id);
    const playerCount = playerIds.length;
    const dir = game.direction;

    await db.tx(async (t) => {
      await drawCardsInTx(t, gameId, user.id, 1);

      const nextIdx = (((currentIdx + dir) % playerCount) + playerCount) % playerCount;
      await t.none(`UPDATE games SET current_player_id = $1 WHERE id = $2`, [
        playerIds[nextIdx]!,
        gameId,
      ]);

      await t.none(`INSERT INTO moves (game_id, user_id, action) VALUES ($1, $2, 'draw')`, [
        gameId,
        user.id,
      ]);
    });

    console.log("DREW in game", gameId);
    await broadcastGames();
    res.json({ message: "Card drawn" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to draw card" });
  }
});

export default router;
