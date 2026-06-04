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
          case "new_message": {
            // 新消息已由 sendMessage 处理，此处可触发通知（免打扰模式不通知）
            const chat = useAppStore.getState().chats[event.chatId];
            if (!chat?.muted && typeof Notification !== "undefined" && Notification.permission === "granted") {
              const msgData = event.data as { senderId?: string; content?: string };
              if (msgData?.content && msgData.senderId !== "user") {
                new Notification("新消息", { body: msgData.content.slice(0, 80), tag: "new-msg" });
              }
            }
            break;
          }
          case "member_added": {
            // 成员加入通知
            const member = event.data as { id: string; name: string };
            if (member?.name) {
              if (typeof Notification !== "undefined" && Notification.permission === "granted") {
                new Notification("成员加入", { body: `${member.name} 加入了群聊`, tag: "member-added" });
              }
            }
            break;
          }
          case "member_removed": {
            // 成员移除通知
            if (typeof Notification !== "undefined" && Notification.permission === "granted") {
              new Notification("成员离开", { body: "有成员离开了群聊", tag: "member-removed" });
            }
            break;
          }
          case "member_role_changed": {
            // 角色变更通知
            const data = event.data as { memberId: string; role: string };
            if (data?.role) {
              if (typeof Notification !== "undefined" && Notification.permission === "granted") {
                new Notification("角色变更", { body: `成员角色变更为 ${data.role}`, tag: "role-changed" });
              }
            }
            break;
          }
          case "mention_all": {
            // @all 全员提及通知
            const mentionData = event.data as { chatId: string; senderId: string; content: string };
            if (typeof Notification !== "undefined" && Notification.permission === "granted") {
              new Notification("全员提及", {
                body: mentionData?.content || "有人@了所有人",
                tag: "mention-all",
              });
            }
            break;
          }
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
          // 其他客户端发送的消息，写入 store
          const store = useAppStore.getState();
          const existingMessages = store.messages[payload.chatId] || [];
          const msgData = payload.message as { id?: string };
          // 避免重复：如果消息已存在则跳过
          if (msgData?.id && !existingMessages.some((m) => m.id === msgData.id)) {
            // 触发推送事件，让 UI 更新
            emitPushEvent("new_message", payload.message, payload.chatId);
          }
        }
      },
      onStateChange: (state) => {
        setConnectionState(state);
      },
      onError: () => {
        // WebSocket 连接失败时静默处理，重连机制会自动重试
        // 仅在首次连接失败时提示
        if (connectionState === "connecting") {
          console.warn("[WS] WebSocket 服务不可用，已降级为本地模式。配置 NEXT_PUBLIC_WS_URL 并启动 WS 服务可启用实时推送。");
        }
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
