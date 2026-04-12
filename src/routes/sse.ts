import { Router, Request, Response } from "express";

const router = Router();

// GET /api/sse
router.get("/", (req: Request, res: Response) => {
  // set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  // confirm connection open
  res.write("data: connected\n\n");

  // client disconnected
  req.on("close", () => {
    res.end();
  });
});

export default router;
