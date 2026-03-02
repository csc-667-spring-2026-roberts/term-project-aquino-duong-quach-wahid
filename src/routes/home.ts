import { Router } from "express";

const router = Router();

router.get("/", (_request, response) => {
  response.send("Hello world from within a route!");
});

router.get("/:id", (request, response) => {
  const { id } = request.params;
  response.send(`Hello from page id ${id}`);
});

export default router;
