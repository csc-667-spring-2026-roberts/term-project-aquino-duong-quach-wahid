// get elements
const createGameBtn = document.getElementById("create-game") as HTMLButtonElement;
const gamesList = document.getElementById("games-list") as HTMLDivElement;
const gameCardTemplate = document.getElementById("game-card-template") as HTMLTemplateElement;

// join a game
const joinGame = async (id: number) => {
  const res = await fetch(`/api/games/${id}/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    console.error("Failed to join game");
  }
};

// render one game
const renderGame = (game: { id: number; name: string; players: number[] }) => {
  const clone = gameCardTemplate.content.cloneNode(true) as DocumentFragment;
  const idSpan = clone.querySelector("[data-game-id]") as HTMLSpanElement;
  const nameSpan = clone.querySelector("[data-game-name]") as HTMLSpanElement;
  const playersSpan = clone.querySelector("[data-game-players]") as HTMLSpanElement;
  const joinBtn = clone.querySelector("[data-join-btn]") as HTMLButtonElement;
  idSpan.textContent = String(game.id);
  nameSpan.textContent = game.name;
  playersSpan.textContent = `${game.players.length} players`;
  joinBtn.addEventListener("click", () => { void joinGame(game.id); });
  gamesList.appendChild(clone);
};

// render all games
const renderGames = (games: { id: number; name: string; players: number[] }[]) => {
  gamesList.innerHTML = "";
  if (!games.length) {
    gamesList.innerHTML = "<p>No games yet.</p>";
    return;
  }
  games.forEach(renderGame);
};

// load games on start
const loadGames = async () => {
  const res = await fetch("/api/games");
  const games = await res.json() as { id: number; name: string; players: number[] }[];
  renderGames(games);
};

// create a game
const createGame = async () => {
  const res = await fetch("/api/games", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: `Game ${Date.now()}` }),
  });
  if (!res.ok) {
    console.error("Failed to create game");
  }
};

// connect to SSE
const eventSource = new EventSource("/api/sse");

// handle incoming events
eventSource.onmessage = (event) => {
  const games = JSON.parse(event.data) as { id: number; name: string; players: number[] }[];
  renderGames(games);
};

// handle errors
eventSource.onerror = (error) => {
  console.error(error);
};

// button click
createGameBtn?.addEventListener("click", createGame);

// initial load
void loadGames();
