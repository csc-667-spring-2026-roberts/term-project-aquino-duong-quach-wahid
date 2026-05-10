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

const renderGame = (game: Game): void => {
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

  // Single wrapper spanning both grid columns for all dynamic content
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

  extras.appendChild(errorDiv);
  gamesList.appendChild(clone);
};

const renderGames = (games: Game[]): void => {
  gamesList.innerHTML = "";

  if (!games.length) {
    gamesList.innerHTML = "<p>No games yet.</p>";
    return;
  }

  games.forEach(renderGame);
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
