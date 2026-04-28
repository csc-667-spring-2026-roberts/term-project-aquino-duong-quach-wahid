import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";

import livereload from "livereload";
import connectLiveReload from "connect-livereload";

import db from "./db/connection.js";
import homeRoutes from "./routes/home.js";
import dbRoutes from "./routes/db.js";
import loggingMiddleware from "./middleware/logging.js";
import testRoutes from "./routes/test.js";
import authRoutes from "./routes/auth.js";
import lobbyRoutes from "./routes/lobby.js";
import sseRoutes from "./routes/sse.js";
import gamesRoutes from "./routes/games.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "..", "src", "views"));

app.set("trust proxy", 1);

app.use(
  session({
    store: new (connectPgSimple(session))({
      pgPromise: db,
    }),
    secret: process.env.SESSION_SECRET || "dev-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
    },
  }),
);

app.use(express.static(path.join(__dirname, "..", "public")));

app.use(loggingMiddleware);

if (process.env.NODE_ENV !== "production") {
  const liveReloadServer = livereload.createServer();
  liveReloadServer.watch(path.join(__dirname, "..", "public"));
  liveReloadServer.watch(path.join(__dirname, "views"));
  app.use(connectLiveReload());
  liveReloadServer.server.once("connection", () => {
    setTimeout(() => {
      liveReloadServer.refresh("/");
    }, 100);
  });
}

app.use("/auth", authRoutes);
app.use("/lobby", lobbyRoutes);
app.use("/db", dbRoutes);
app.use("/", homeRoutes);
app.use("/test", testRoutes);
app.use("/api/sse", sseRoutes);
app.use("/api/games", gamesRoutes);


app.listen(PORT, () => {
  console.log(`Server started on port ${String(PORT)} at ${new Date().toLocaleTimeString()}`);
});

