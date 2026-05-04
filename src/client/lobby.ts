type Game = {
  id: number;
  name: string;
  players: number[];
  started?: boolean;
  deck?: string[];
  discardPile?: string[];
};

const createGameBtn = document.getElementById("create-game") as HTMLButtonElement;
const gamesList = document.getElementById("games-list") as HTMLDivElement;
const gameCardTemplate = document.getElementById("game-card-template") as HTMLTemplateElement;

const joinGame = async (id: number): Promise<void> => {
  await fetch(`/api/games/${id}/join`, { method: "POST" });
};

const startGame = async (id: number): Promise<void> => {
  await fetch(`/api/games/${id}/start`, { method: "POST" });
};

const playCard = async (id: number): Promise<void> => {
  await fetch(`/api/games/${id}/play`, { method: "POST" });
};

const renderGame = (game: Game): void => {
  const clone = gameCardTemplate.content.cloneNode(true) as DocumentFragment;

  const idSpan = clone.querySelector("[data-game-id]") as HTMLSpanElement;
  const nameSpan = clone.querySelector("[data-game-name]") as HTMLSpanElement;
  const playersSpan = clone.querySelector("[data-game-players]") as HTMLSpanElement;
  const joinBtn = clone.querySelector("[data-join-btn]") as HTMLButtonElement;

  idSpan.textContent = String(game.id);
  nameSpan.textContent = game.name;
  playersSpan.textContent = `${game.players.length} players`;

  joinBtn.addEventListener("click", () => void joinGame(game.id));

  const card = clone.querySelector(".game-card") as HTMLDivElement;

  const buttonRow = document.createElement("div");
  buttonRow.style.display = "flex";
  buttonRow.style.gap = "8px"; // clean spacing
  buttonRow.style.marginTop = "8px";

  const startBtn = document.createElement("button");
  startBtn.textContent = game.started ? "Game Started" : "Start Game";
  startBtn.disabled = game.started === true;

  startBtn.classList.add("button", "button-small");

  startBtn.addEventListener("click", () => void startGame(game.id));

  const playBtn = document.createElement("button");
  playBtn.textContent = "Play Card";
  playBtn.disabled = !game.started;

  playBtn.classList.add("button", "button-small");

  playBtn.addEventListener("click", () => void playCard(game.id));

  buttonRow.appendChild(startBtn);
  buttonRow.appendChild(playBtn);

  const info = document.createElement("div");
  info.style.marginTop = "6px";

  if (game.discardPile && game.discardPile.length > 0) {
    const lastCard = game.discardPile[game.discardPile.length - 1];
    info.textContent = `Last played: ${lastCard}`;
  } else {
    info.textContent = "No cards played yet";
  }

  const deckInfo = document.createElement("div");

  if (game.deck) {
    deckInfo.textContent = `Cards left: ${game.deck.length}`;
  }

  card.appendChild(buttonRow);
  card.appendChild(info);
  card.appendChild(deckInfo);

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
    body: JSON.stringify({ name: `Game ${Date.now()}` }),
  });
};

const eventSource = new EventSource("/api/sse");

eventSource.onmessage = (event: MessageEvent): void => {
  const games = JSON.parse(event.data) as Game[];
  renderGames(games);
};

eventSource.onerror = (err): void => {
  console.error("SSE error:", err);
};

createGameBtn.addEventListener("click", () => void createGame());

// Initial load
void loadGames();