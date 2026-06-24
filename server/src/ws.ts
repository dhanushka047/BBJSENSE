import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";

interface ClientSubscription {
  ws: WebSocket;
  topics: Set<string>;
}

const clients = new Set<ClientSubscription>();

export function initWebSocket(server: Server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    // Only handle WebSocket upgrades on /ws path
    const url = new URL(request.url || "", `http://${request.headers.host}`);
    if (url.pathname === "/ws") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on("connection", (ws: WebSocket) => {
    console.log("[WS] Client connected");
    const clientSub: ClientSubscription = { ws, topics: new Set() };
    clients.add(clientSub);

    ws.on("message", (message: string) => {
      try {
        const data = JSON.parse(message);
        if (data.action === "subscribe" && typeof data.topic === "string") {
          clientSub.topics.add(data.topic);
          console.log(`[WS] Client subscribed to topic: ${data.topic}`);
          ws.send(JSON.stringify({ event: "subscribed", topic: data.topic }));
        } else if (data.action === "unsubscribe" && typeof data.topic === "string") {
          clientSub.topics.delete(data.topic);
          console.log(`[WS] Client unsubscribed from topic: ${data.topic}`);
          ws.send(JSON.stringify({ event: "unsubscribed", topic: data.topic }));
        }
      } catch (err) {
        console.error("[WS] Error parsing message:", err);
      }
    });

    ws.on("close", () => {
      console.log("[WS] Client disconnected");
      clients.delete(clientSub);
    });

    ws.on("error", (err) => {
      console.error("[WS] Connection error:", err);
      clients.delete(clientSub);
    });
  });
}

/**
 * Broadcasts an event to all clients subscribed to a specific topic
 */
export function broadcast(topic: string, eventType: "INSERT" | "UPDATE" | "DELETE", data: any) {
  const payload = JSON.stringify({
    topic,
    event: eventType,
    payload: data,
  });

  let count = 0;
  for (const client of clients) {
    if (client.topics.has(topic) && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(payload);
      count++;
    }
  }
  if (count > 0) {
    console.log(`[WS] Broadcasted event ${eventType} to ${count} clients on topic: ${topic}`);
  }
}
