import { Router, Request, Response } from "express";

type SSEClient = {
  id: string;
  res: Response;
  keepalive: NodeJS.Timeout;
};

const clients = new Map<string, SSEClient>();

function send(res: Response, data: unknown) {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

export function broadcastAll(data: unknown): void {
  for (const client of clients.values()) {
    send(client.res, data);
  }
}

const router = Router();

router.get("/", (req: Request, res: Response) => {
  const clientId = crypto.randomUUID();

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  res.flushHeaders();

  res.write("data: []\n\n");

  const keepalive = setInterval(() => {
    try {
      res.write(":ping\n\n");
    } catch {
      clearInterval(keepalive);
    }
  }, 25000);

  clients.set(clientId, {
    id: clientId,
    res,
    keepalive,
  });

  req.on("close", () => {
    clearInterval(keepalive);
    clients.delete(clientId);
    res.end();
  });
});

export default router;