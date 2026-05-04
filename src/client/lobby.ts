document.addEventListener("DOMContentLoaded", () => {
  const createGameBtn = document.getElementById("create-game") as HTMLButtonElement;
  const gamesList = document.getElementById("games-list") as HTMLDivElement;
  const template = document.getElementById("game-card-template") as HTMLTemplateElement;

  const joinGame = async (id: number) => {
    await fetch(`/api/games/${id}/join`, { method: "POST" });
  };

  const startGame = async (id: number) => {
    await fetch(`/api/games/${id}/start`, { method: "POST" });
  };

  const playCard = async (id: number) => {
    await fetch(`/api/games/${id}/play`, { method: "POST" });
  };

  const renderGame = (game: any) => {
    const clone = template.content.cloneNode(true) as DocumentFragment;

    const idSpan = clone.querySelector("[data-game-id]")!;
    const nameSpan = clone.querySelector("[data-game-name]")!;
    const playersSpan = clone.querySelector("[data-game-players]")!;
    const joinBtn = clone.querySelector("[data-join-btn]") as HTMLButtonElement;

    idSpan.textContent = game.id;
    nameSpan.textContent = game.name;
    playersSpan.textContent = `${game.players.length} players`;

    joinBtn.onclick = () => joinGame(game.id);

    const card = clone.querySelector(".game-card")!;

    const startBtn = document.createElement("button");
    startBtn.textContent = "Start";
    startBtn.onclick = () => startGame(game.id);

    const playBtn = document.createElement("button");
    playBtn.textContent = "Play";
    playBtn.onclick = () => playCard(game.id);

    card.appendChild(startBtn);
    card.appendChild(playBtn);

    gamesList.appendChild(clone);
  };

  const renderGames = (games: any[]) => {
    gamesList.innerHTML = "";
    games.forEach(renderGame);
  };

  const loadGames = async () => {
    const res = await fetch("/api/games");
    const games = await res.json();
    renderGames(games);
  };

  const createGame = async () => {
    await fetch("/api/games", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "UNO Game" }),
    });
  };

  const eventSource = new EventSource("/api/sse");

  eventSource.onmessage = (event) => {
    const games = JSON.parse(event.data);
    renderGames(games);
  };

  createGameBtn.onclick = createGame;

  loadGames();
});