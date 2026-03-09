import { Router } from "express";
import db from "../db/connection.js";

const router = Router();

router.get("/:id", async (request, response) => {
  const { id } = request.params;

  await db.none("INSERT INTO test_table (message) VALUES ($1)", [
    `Requested ${id} at ${new Date().toLocaleTimeString()}`,
  ]);

  const records = await db.any("SELECT * FROM test_table");

  response.json(records);
});

router.post("/", async (request, response) => {
  const { message } = request.body;

  await db.none("INSERT INTO test_table (message) VALUES ($1)", [message]);

  const records = await db.any("SELECT * FROM test_table");

  response.json(records);
});

export default router;
