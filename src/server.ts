import express from "express";
import path from "path";
import { fileURLToPath } from "url";

import homeRoutes from "./routes/home.js";
import loggingMiddleware from "./middleware/logging.js";

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, "..", "public")));

app.use(loggingMiddleware);

app.use("/", homeRoutes);

app.listen(PORT, () => {
  console.log(`Server started on port ${String(PORT)} at ${new Date().toLocaleTimeString()}`);
});
