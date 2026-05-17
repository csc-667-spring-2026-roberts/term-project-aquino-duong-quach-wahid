type Game = {
  id: number;
  name: string;
  players: number[];
  started?: boolean;
  hands?: Record<string, string[]>;
  drawPile?: string[];
  discardPile?: string[];
  currentPlayerIndex?: number;
  direction?: number;
  currentColor?: string;
};

const currentUserId = parseInt(
  (document.getElementById("current-user-id") as HTMLElement).dataset.userId ?? "0",
);

const createGameBtn = document.getElementById("create-game") as HTMLButtonElement;
const gamesList = document.getElementById("games-list") as HTMLDivElement;
const gameCardTemplate = document.getElementById("game-card-template") as HTMLTemplateElement;

let expandedGameId: number | null = null;
let lastKnownGames: Game[] = [];

const joinGame = async (id: number): Promise<void> => {
  await fetch(`/api/games/${String(id)}/join`, { method: "POST" });
};

const startGame = async (id: number): Promise<void> => {
  await fetch(`/api/games/${String(id)}/start`, { method: "POST" });
};

const playCard = async (id: number, card: string, color?: string): Promise<Response> => {
  return fetch(`/api/games/${String(id)}/play`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ card, color }),
  });
};

const drawCard = async (id: number): Promise<Response> => {
  return fetch(`/api/games/${String(id)}/draw`, { method: "POST" });
};

const cardColorOf = (card: string): string => card[0] ?? "W";
const cardValueOf = (card: string): string => card.slice(1);

const cardLabel = (card: string): string => {
  if (card === "Wl") return "Wild";
  if (card === "WD4") return "+4";
  const val = card.slice(1);
  if (val === "Sk") return "Skip";
  if (val === "Rv") return "Rev";
  if (val === "D2") return "+2";
  return val;
};

const cardColorClass = (card: string): string => {
  const c = card[0] ?? "";
  if (c === "R") return "hand-card-R";
  if (c === "G") return "hand-card-G";
  if (c === "B") return "hand-card-B";
  if (c === "Y") return "hand-card-Y";
  return "hand-card-W";
};

const colorLabel = (c: string): string => {
  if (c === "R") return "Red";
  if (c === "G") return "Green";
  if (c === "B") return "Blue";
  if (c === "Y") return "Yellow";
  return c;
};

const isPlayable = (card: string, topCard: string, currentColor: string): boolean => {
  const c = cardColorOf(card);
  if (c === "W") return true;
  if (c === currentColor) return true;
  if (cardValueOf(card) === cardValueOf(topCard) && cardColorOf(topCard) !== "W") return true;
  return false;
};

const showError = (errorDiv: HTMLDivElement, message: string): void => {
  errorDiv.textContent = message;
  setTimeout(() => {
    errorDiv.textContent = "";
  }, 3000);
};

const buildHandSection = (
  game: Game,
  extras: HTMLDivElement,
  errorDiv: HTMLDivElement,
  isMyTurn: boolean,
  topCard: string,
  currentColor: string,
): void => {
  const myHand = game.hands?.[String(currentUserId)] ?? [];
  if (myHand.length === 0) return;

  let pendingWildCard = "";

  const colorPicker = document.createElement("div");
  colorPicker.classList.add("color-picker");
  colorPicker.hidden = true;

  for (const c of ["R", "G", "B", "Y"]) {
    const colorBtn = document.createElement("button");
    colorBtn.classList.add("color-btn", `color-btn-${c}`);
    colorBtn.textContent = colorLabel(c);
    colorBtn.addEventListener("click", () => {
      colorPicker.hidden = true;
      void playCard(game.id, pendingWildCard, c).then(async (res) => {
        if (!res.ok) {
          const body = (await res.json()) as { error: string };
          showError(errorDiv, body.error);
        }
      });
    });
    colorPicker.appendChild(colorBtn);
  }

  const handRow = document.createElement("div");
  handRow.classList.add("hand-cards");

  for (const handCard of myHand) {
    const playable = isPlayable(handCard, topCard, currentColor);
    const btn = document.createElement("button");
    btn.classList.add("hand-card", cardColorClass(handCard));
    btn.textContent = cardLabel(handCard);
    btn.disabled = !isMyTurn || !playable;

    btn.addEventListener("click", () => {
      if (handCard === "Wl" || handCard === "WD4") {
        pendingWildCard = handCard;
        colorPicker.hidden = false;
      } else {
        void playCard(game.id, handCard).then(async (res) => {
          if (!res.ok) {
            const body = (await res.json()) as { error: string };
            showError(errorDiv, body.error);
          }
        });
      }
    });

    handRow.appendChild(btn);
  }

  const handSection = document.createElement("div");
  handSection.classList.add("hand-section");
  handSection.appendChild(handRow);
  handSection.appendChild(colorPicker);
  extras.appendChild(handSection);
};

const renderStartedSection = (
  game: Game,
  extras: HTMLDivElement,
  errorDiv: HTMLDivElement,
  isMyTurn: boolean,
): void => {
  const topCard = game.discardPile?.[game.discardPile.length - 1] ?? "";
  const currentColor = game.currentColor ?? cardColorOf(topCard);

  const info = document.createElement("div");
  info.textContent = topCard ? `Last played: ${topCard}` : "No cards played yet";

  const deckInfo = document.createElement("div");
  if (game.drawPile) {
    deckInfo.textContent = `Draw pile: ${String(game.drawPile.length)}`;
  }

  const colorInfo = document.createElement("div");
  colorInfo.textContent = `Color: ${currentColor}`;

  extras.appendChild(info);
  extras.appendChild(deckInfo);
  extras.appendChild(colorInfo);

  buildHandSection(game, extras, errorDiv, isMyTurn, topCard, currentColor);

  const drawBtn = document.createElement("button");
  drawBtn.textContent = "Draw Card";
  drawBtn.disabled = !isMyTurn;
  drawBtn.classList.add("button", "button-small");
  drawBtn.addEventListener("click", () => {
    void drawCard(game.id).then(async (res) => {
      if (!res.ok) {
        const body = (await res.json()) as { error: string };
        showError(errorDiv, body.error);
      }
    });
  });
  extras.appendChild(drawBtn);
};

const renderGame = (game: Game, container: HTMLElement = gamesList): void => {
  const clone = gameCardTemplate.content.cloneNode(true) as DocumentFragment;

  const idSpan = clone.querySelector("[data-game-id]") as HTMLSpanElement;
  const nameSpan = clone.querySelector("[data-game-name]") as HTMLSpanElement;
  const playersSpan = clone.querySelector("[data-game-players]") as HTMLSpanElement;
  const joinBtn = clone.querySelector("[data-join-btn]") as HTMLButtonElement;
  const turnBadge = clone.querySelector("[data-turn-badge]") as HTMLSpanElement;

  idSpan.textContent = String(game.id);
  nameSpan.textContent = game.name;
  playersSpan.textContent = `${String(game.players.length)} players`;

  joinBtn.addEventListener("click", () => void joinGame(game.id));

  const isMyTurn =
    game.started === true && game.players[game.currentPlayerIndex ?? 0] === currentUserId;

  if (game.started) {
    turnBadge.textContent = isMyTurn ? "Your Turn" : "Waiting...";
    if (!isMyTurn) turnBadge.classList.add("waiting");
  }

  const card = clone.querySelector(".game-card") as HTMLDivElement;

  // spans both grid columns
  const extras = document.createElement("div");
  extras.classList.add("game-extras");
  card.appendChild(extras);

  const errorDiv = document.createElement("div");
  errorDiv.classList.add("game-action-error");

  const startBtn = document.createElement("button");
  startBtn.textContent = game.started ? "Game Started" : "Start Game";
  startBtn.disabled = game.started === true;
  startBtn.classList.add("button", "button-small");
  startBtn.addEventListener("click", () => void startGame(game.id));
  extras.appendChild(startBtn);

  if (game.started) {
    renderStartedSection(game, extras, errorDiv, isMyTurn);
  }

  const expandBtn = document.createElement("button");
  expandBtn.textContent = "Expand";
  expandBtn.classList.add("button", "button-small", "button-outline");
  expandBtn.addEventListener("click", () => {
    expandedGameId = game.id;
    renderGames(lastKnownGames);
  });
  extras.appendChild(expandBtn);

  extras.appendChild(errorDiv);
  container.appendChild(clone);
};

const buildOpponentSlot = (
  playerId: number,
  handCount: number,
  isCurrentTurn: boolean,
): HTMLDivElement => {
  const slot = document.createElement("div");
  slot.classList.add("opponent-slot");
  if (isCurrentTurn) slot.classList.add("opponent-active");

  const stack = document.createElement("div");
  stack.classList.add("face-down-stack");
  const count = document.createElement("span");
  count.classList.add("card-count");
  count.textContent = String(handCount);
  stack.appendChild(count);
  slot.appendChild(stack);

  const label = document.createElement("div");
  label.classList.add("opponent-label");
  label.textContent = `Player ${String(playerId)}`;
  slot.appendChild(label);

  if (isCurrentTurn) {
    const badge = document.createElement("div");
    badge.classList.add("opponent-turn-badge");
    badge.textContent = "Their Turn";
    slot.appendChild(badge);
  }

  return slot;
};

const buildOpponents = (game: Game, table: HTMLDivElement): void => {
  const opponents = document.createElement("div");
  opponents.classList.add("table-opponents");

  const currentTurnIdx = game.currentPlayerIndex ?? 0;

  for (let i = 0; i < game.players.length; i++) {
    const playerId = game.players[i];
    if (playerId === undefined || playerId === currentUserId) continue;
    const handCount = game.hands?.[String(playerId)]?.length ?? 0;
    const isCurrentTurn = i === currentTurnIdx;
    opponents.appendChild(buildOpponentSlot(playerId, handCount, isCurrentTurn));
  }

  table.appendChild(opponents);
};

const buildCenter = (
  game: Game,
  table: HTMLDivElement,
  topCard: string,
  currentColor: string,
): void => {
  const center = document.createElement("div");
  center.classList.add("table-center-area");

  const drawPile = document.createElement("div");
  drawPile.classList.add("draw-pile-stack");
  const drawLabel = document.createElement("span");
  drawLabel.classList.add("pile-count");
  drawLabel.textContent = String(game.drawPile?.length ?? 0);
  drawPile.appendChild(drawLabel);

  const topColorCode = cardColorOf(topCard);
  const colorCode = topColorCode === "W" ? currentColor : topColorCode;
  const discard = document.createElement("div");
  discard.classList.add("discard-top", `hand-card-${colorCode}`);
  discard.textContent = topCard ? cardLabel(topCard) : "—";

  center.appendChild(drawPile);
  center.appendChild(discard);
  table.appendChild(center);
};

const buildMyArea = (
  game: Game,
  table: HTMLDivElement,
  errorDiv: HTMLDivElement,
  isMyTurn: boolean,
  topCard: string,
  currentColor: string,
): void => {
  const myArea = document.createElement("div");
  myArea.classList.add("table-player-area");

  const label = document.createElement("div");
  label.classList.add("player-area-label");
  label.textContent = isMyTurn ? "Your Turn" : "Your Hand";
  if (isMyTurn) label.classList.add("player-area-active");
  myArea.appendChild(label);

  buildHandSection(game, myArea, errorDiv, isMyTurn, topCard, currentColor);

  const drawBtn = document.createElement("button");
  drawBtn.textContent = "Draw Card";
  drawBtn.disabled = !isMyTurn;
  drawBtn.classList.add("button", "button-small");
  drawBtn.addEventListener("click", () => {
    void drawCard(game.id).then(async (res) => {
      if (!res.ok) {
        const body = (await res.json()) as { error: string };
        showError(errorDiv, body.error);
      }
    });
  });
  myArea.appendChild(drawBtn);
  table.appendChild(myArea);
};

const renderTableView = (game: Game, container: HTMLElement): void => {
  const topCard = game.discardPile?.[game.discardPile.length - 1] ?? "";
  const currentColor = game.currentColor ?? cardColorOf(topCard);
  const isMyTurn =
    game.started === true && game.players[game.currentPlayerIndex ?? 0] === currentUserId;

  const errorDiv = document.createElement("div");
  errorDiv.classList.add("game-action-error");

  const table = document.createElement("div");
  table.classList.add("game-table");

  buildOpponents(game, table);
  buildCenter(game, table, topCard, currentColor);
  buildMyArea(game, table, errorDiv, isMyTurn, topCard, currentColor);

  container.appendChild(table);
  container.appendChild(errorDiv);
};

const renderCompactGame = (game: Game, container: HTMLElement): void => {
  const div = document.createElement("div");
  div.classList.add("game-card-compact");

  const name = document.createElement("div");
  name.classList.add("compact-name");
  name.textContent = game.name;
  div.appendChild(name);

  const players = document.createElement("div");
  players.classList.add("compact-players");
  players.textContent = `${String(game.players.length)} players`;
  div.appendChild(players);

  if (game.started) {
    const isMyTurn = game.players[game.currentPlayerIndex ?? 0] === currentUserId;
    const badge = document.createElement("span");
    badge.classList.add("compact-badge");
    badge.textContent = isMyTurn ? "Your Turn" : "In Progress";
    if (!isMyTurn) badge.classList.add("waiting");
    div.appendChild(badge);
  }

  const expandBtn = document.createElement("button");
  expandBtn.textContent = "Expand";
  expandBtn.classList.add("button", "button-small");
  expandBtn.addEventListener("click", () => {
    expandedGameId = game.id;
    renderGames(lastKnownGames);
  });
  div.appendChild(expandBtn);
  container.appendChild(div);
};

const renderSplitView = (game: Game, others: Game[]): void => {
  const split = document.createElement("div");
  split.classList.add("lobby-split");

  const main = document.createElement("div");
  main.classList.add("lobby-main");

  const collapseBtn = document.createElement("button");
  collapseBtn.textContent = "← All Games";
  collapseBtn.classList.add("button", "button-small", "button-outline");
  collapseBtn.addEventListener("click", () => {
    expandedGameId = null;
    renderGames(lastKnownGames);
  });
  main.appendChild(collapseBtn);
  if (game.started === true) {
    renderTableView(game, main);
  } else {
    renderGame(game, main);
  }

  const sidebar = document.createElement("div");
  sidebar.classList.add("lobby-sidebar");

  const heading = document.createElement("div");
  heading.classList.add("sidebar-heading");
  heading.textContent = "Other Games";
  sidebar.appendChild(heading);

  if (others.length === 0) {
    const empty = document.createElement("div");
    empty.classList.add("sidebar-empty");
    empty.textContent = "No other games";
    sidebar.appendChild(empty);
  } else {
    others.forEach((g) => {
      renderCompactGame(g, sidebar);
    });
  }

  split.appendChild(main);
  split.appendChild(sidebar);
  gamesList.appendChild(split);
};

const renderGames = (games: Game[]): void => {
  lastKnownGames = games;
  gamesList.innerHTML = "";

  if (!games.length) {
    gamesList.innerHTML = "<p>No games yet.</p>";
    return;
  }

  if (expandedGameId !== null) {
    const expanded = games.find((g) => g.id === expandedGameId);
    if (expanded !== undefined) {
      renderSplitView(
        expanded,
        games.filter((g) => g.id !== expandedGameId),
      );
      return;
    }
    expandedGameId = null;
  }

  games.forEach((g) => {
    renderGame(g);
  });
};

const loadGames = async (): Promise<void> => {
  const res = await fetch("/api/games");
  const games = (await res.json()) as Game[];
  renderGames(games);
};

const createGame = async (): Promise<void> => {
  await fetch("/api/games", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: `Game ${String(Date.now())}` }),
  });
};

const eventSource = new EventSource("/api/sse");

eventSource.onmessage = (event: MessageEvent): void => {
  const games = JSON.parse(event.data as string) as Game[];
  renderGames(games);
};

eventSource.onerror = (err): void => {
  console.error("SSE error:", err);
};

createGameBtn.addEventListener("click", () => void createGame());

// Initial load
void loadGames();
