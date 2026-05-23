"use client";

/**
 * WebSocket 集成 Hook
 *
 * 将 ChatWebSocket 与 React 组件和 Zustand store 连接。
 * 在 ChatWindow 中使用，实现消息实时推送。
 */

import { useEffect, useRef, useCallback, useState } from "react";
import { useAppStore } from "@/stores/appStore";
import { ChatWebSocket, onPushEvent, emitPushEvent } from "./ChatWebSocket";
import type { WSConnectionState, PushEvent } from "./ChatWebSocket";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "";

/**
 * useWebSocket - WebSocket 连接管理 Hook
 *
 * 自动连接/断开 WebSocket，监听推送事件并更新 store。
 * 当 NEXT_PUBLIC_WS_URL 未配置时，降级为本地推送模式。
 */
export function useWebSocket() {
  const wsRef = useRef<ChatWebSocket | null>(null);
  const [connectionState, setConnectionState] = useState<WSConnectionState>("disconnected");
  const sendMessage = useAppStore((s) => s.sendMessage);

  // 注册推送事件监听器
  useEffect(() => {
    const unsubscribe = onPushEvent((event: PushEvent) => {
      // 处理推送事件，更新 store
      if (event.chatId) {
        switch (event.event) {
          case "new_message":
            // 新消息已由 sendMessage 处理，此处可触发通知
            break;
          case "task_status_changed":
            // 任务状态变更通知
            break;
          case "urgent_report":
            // 紧急上报 - 可触发浏览器通知
            if (typeof Notification !== "undefined" && Notification.permission === "granted") {
              new Notification("AgentWorks 紧急上报", {
                body: String(event.data),
                tag: "urgent-report",
              });
            }
            break;
        }
      }
    });

    return unsubscribe;
  }, []);

  // WebSocket 连接管理
  useEffect(() => {
    if (!WS_URL) return; // 未配置 WS URL，使用本地模式

    const ws = new ChatWebSocket(WS_URL, {
      onMessage: (msg) => {
        // 处理来自服务端的实时消息
        if (msg.type === "chat_message" && msg.payload) {
          const payload = msg.payload as { chatId: string; message: unknown };
          // 消息已由发送方写入 store，此处处理其他客户端的消息
        }
      },
      onStateChange: (state) => {
        setConnectionState(state);
      },
      onError: (error) => {
        console.error("[WS] 连接错误:", error);
      },
    });

    ws.connect();
    wsRef.current = ws;

    return () => {
      ws.disconnect();
      wsRef.current = null;
    };
  }, []);

  const sendWSMessage = useCallback((chatId: string, content: string) => {
    if (wsRef.current && wsRef.current.getState() === "connected") {
      // 通过 WebSocket 发送
      const store = useAppStore.getState();
      const msg = store.sendMessage(chatId, "text", "user", content);
      wsRef.current.sendChatMessage(chatId, msg);
    }
    // 本地模式下，sendMessage 由 ChatInput 直接调用
  }, []);

  return {
    connectionState,
    sendWSMessage,
    isConnected: connectionState === "connected",
  };
}
