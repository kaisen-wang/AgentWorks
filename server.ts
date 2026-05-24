/**
 * AgentWorks 自定义 Server
 *
 * 在 Next.js 基础上增加 WebSocket 服务端，
 * 支持多客户端实时消息推送。
 *
 * 启动方式: npx tsx server.ts
 * 默认端口: 3000 (HTTP) + 3001 (WS)
 */

import { createServer } from "http";
import { parse } from "url";
import next from "next";

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

const WS_PORT = parseInt(process.env.WS_PORT || "3001", 10);

// WebSocket 接口（兼容 ws 库和 Node 内置）
interface WS {
  on(event: "message", cb: (data: Buffer) => void): void;
  on(event: "close", cb: () => void): void;
  on(event: "error", cb: (err: Error) => void): void;
  send(data: string): void;
}

interface WSServer {
  on(event: "connection", cb: (ws: WS, req: unknown) => void): void;
}

app.prepare().then(() => {
  // ============================================================
  // HTTP Server (Next.js)
  // ============================================================
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  const PORT = parseInt(process.env.PORT || "3000", 10);
  server.listen(PORT, () => {
    console.log(`> AgentWorks HTTP ready on http://localhost:${PORT}`);
  });

  // ============================================================
  // WebSocket Server
  // ============================================================
  let WebSocketServerClass: new (opts: { port: number }) => WSServer;

  try {
    // 尝试使用 ws 库
    const wsModule = require("ws");
    WebSocketServerClass = wsModule.WebSocketServer;
  } catch {
    // Node 22+ 内置 WebSocket
    const wsModule = require("node:ws");
    WebSocketServerClass = wsModule.WebSocketServer;
  }

  const wss = new WebSocketServerClass({ port: WS_PORT });

  // 客户端连接管理
  const clients = new Map<string, { ws: WS; chatIds: Set<string> }>();

  wss.on("connection", (ws, _req) => {
    const clientId = `client_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    clients.set(clientId, { ws, chatIds: new Set() });

    console.log(`[WS] 客户端连接: ${clientId} (总连接: ${clients.size})`);

    ws.on("message", (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString());

        switch (msg.type) {
          case "pong":
            ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
            break;

          case "chat_message": {
            const { chatId, message } = msg.payload as { chatId: string; message: unknown };
            const client = clients.get(clientId);
            if (client) client.chatIds.add(chatId);

            const broadcast = JSON.stringify({
              type: "chat_message",
              payload: { chatId, message },
              timestamp: Date.now(),
            });

            for (const [id, client] of clients) {
              if (id !== clientId && client.chatIds.has(chatId)) {
                try {
                  client.ws.send(broadcast);
                } catch {
                  clients.delete(id);
                }
              }
            }
            break;
          }

          case "subscribe": {
            const { chatId } = msg.payload as { chatId: string };
            const client = clients.get(clientId);
            if (client) client.chatIds.add(chatId);
            break;
          }

          default:
            for (const [id, client] of clients) {
              if (id !== clientId) {
                try {
                  client.ws.send(data.toString());
                } catch {
                  clients.delete(id);
                }
              }
            }
        }
      } catch (err) {
        console.error("[WS] 消息解析失败:", err);
      }
    });

    ws.on("close", () => {
      clients.delete(clientId);
      console.log(`[WS] 客户端断开: ${clientId} (总连接: ${clients.size})`);
    });

    ws.on("error", (err) => {
      console.error(`[WS] 客户端错误: ${clientId}`, err);
      clients.delete(clientId);
    });
  });

  console.log(`> AgentWorks WS ready on ws://localhost:${WS_PORT}`);
});
