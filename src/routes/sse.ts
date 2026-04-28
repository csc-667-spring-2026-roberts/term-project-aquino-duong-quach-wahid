import { Router, Request, Response } from "express";

type SSEClient = {
  id: string;
  room: string;
  res: Response;
  keepalive: NodeJS.Timeout;
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

function removeClient(id: string): void {
  const client = clients.get(id);
  if (client) {
    clearInterval(client.keepalive);
  }
  clients.delete(id);
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

  const keepalive = setInterval(() => {
    try {
      res.write(":ping\n\n");
    } catch {
      clearInterval(keepalive);
    }
  }, 25_000);

  const client: SSEClient = {
    id: clientId,
    room,
    res,
    keepalive,
  };

  clients.set(clientId, client);

  sendEvent(res, "connected", {
    clientId,
    room,
    message: `Connected to room ${room}`,
  });

  // confirm connection open
  res.write(": ok\n\n");

  // client disconnected
  req.on("close", () => {
    removeClient(clientId);
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

// broadcast unnamed event
const broadcastAll = (data: unknown): void => {
  const message = `data: ${JSON.stringify(data)}\n\n`;
  for (const [, { res }] of clients) {
    res.write(message);
  }
};

export { broadcast, broadcastAll };
export default router;
