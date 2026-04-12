import { Router, Request, Response } from "express";

type SSEClient = {
  id: string;
  room: string;
  res: Response;
};

function sendEvent(res: Response, event: string, data: unknown): void {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

const clients = new Map<string, SSEClient>();

function broadcast(room: string, event: string, data: unknown): void {
  for (const client of clients.values()) {
    if (client.room === room) {
      sendEvent(client.res, event, data);
    }
  }
}

const router = Router();

// GET /api/sse
router.get("/", (req: Request, res: Response) => {
  const room = typeof req.query.room === "string" ? req.query.room : "lobby";
  const clientId = crypto.randomUUID();
  // set SSE headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  res.flushHeaders();

  const client: SSEClient = {
    id: clientId,
    room,
    res,
  };

  clients.set(clientId, client);

  const heartbeat = setInterval(() => {
    res.write(": heartbeat\n\n");
  }, 25000);

  sendEvent(res, "connected", {
    clientId,
    room,
    message: `Connected to room ${room}`,
  });

  // confirm connection open
  res.write(": ok\n\n");

  // client disconnected
  req.on("close", () => {
    clearInterval(heartbeat);
    clients.delete(clientId);
    res.end();
  });
});

router.post("/broadcast", (req: Request, res: Response) => {
  const room = typeof req.body.room === "string" ? req.body.room : "lobby";
  const message = typeof req.body.message === "string" ? req.body.message : "New update";

  const payload = {
    room,
    message,
    timestamp: new Date().toISOString(),
  };

  broadcast(room, "state:update", payload);

  res.status(200).json({
    ok: true,
    room,
    payload,
  });
});

export default router;
