import { Router, Request, Response } from "express";

const router = Router();

// GET /api/sse
router.get("/", (req: Request, res: Response) => {
  // set SSE headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
  });
  res.flushHeaders();

  // confirm connection open
  res.write(": ok\n\n");

  // client disconnected
  req.on("close", () => {
    res.end();
  });
});

export default router;
