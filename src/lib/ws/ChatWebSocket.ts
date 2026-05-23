/**
 * WebSocket 实时通信层（Task 23）
 *
 * 提供：
 * - 客户端 WebSocket 连接管理
 * - 消息实时推送（新消息、任务状态变更、上报通知）
 * - 断线重连机制
 * - 消息发送确认与去重
 */

import type { ChatId, Message, MessageId } from "@/types";

// ============================================================
// 客户端 WebSocket 管理
// ============================================================

/** WebSocket 消息协议 */
export interface WSMessage {
  type: "chat_message" | "task_update" | "report_update" | "agent_status" | "pong" | "error";
  payload: unknown;
  messageId?: string; // 用于发送确认
  timestamp: number;
}

/** 连接状态 */
export type WSConnectionState = "connecting" | "connected" | "disconnected" | "reconnecting";

/** 事件回调 */
export interface WSEventHandlers {
  onMessage?: (msg: WSMessage) => void;
  onStateChange?: (state: WSConnectionState) => void;
  onError?: (error: Event) => void;
}

/** 重连配置 */
interface ReconnectConfig {
  maxRetries: number;
  baseDelay: number;  // ms
  maxDelay: number;   // ms
}

const DEFAULT_RECONNECT: ReconnectConfig = {
  maxRetries: 10,
  baseDelay: 1000,
  maxDelay: 30000,
};

/**
 * ChatWebSocket - 客户端 WebSocket 管理器
 *
 * 管理与后端的 WebSocket 长连接，支持断线重连和消息确认。
 */
export class ChatWebSocket {
  private ws: WebSocket | null = null;
  private url: string;
  private handlers: WSEventHandlers;
  private reconnectConfig: ReconnectConfig;
  private retryCount = 0;
  private state: WSConnectionState = "disconnected";
  private pendingAcks = new Set<string>(); // 等待确认的消息 ID
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  constructor(url: string, handlers: WSEventHandlers, reconnectConfig?: Partial<ReconnectConfig>) {
    this.url = url;
    this.handlers = handlers;
    this.reconnectConfig = { ...DEFAULT_RECONNECT, ...reconnectConfig };
  }

  /** 连接 */
  connect(): void {
    if (this.state === "connected" || this.state === "connecting") return;

    this.setState("connecting");

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.retryCount = 0;
        this.setState("connected");
        this.startHeartbeat();
      };

      this.ws.onmessage = (event) => {
        try {
          const msg: WSMessage = JSON.parse(event.data);
          this.handleMessage(msg);
        } catch {
          console.error("[WS] 解析消息失败:", event.data);
        }
      };

      this.ws.onclose = () => {
        this.stopHeartbeat();
        this.setState("disconnected");
        this.scheduleReconnect();
      };

      this.ws.onerror = (event) => {
        this.handlers.onError?.(event);
      };
    } catch (err) {
      this.setState("disconnected");
      this.scheduleReconnect();
    }
  }

  /** 断开连接 */
  disconnect(): void {
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.retryCount = this.reconnectConfig.maxRetries; // 阻止重连
    this.ws?.close();
    this.ws = null;
    this.setState("disconnected");
  }

  /** 发送消息 */
  send(msg: WSMessage): boolean {
    if (this.state !== "connected" || !this.ws) return false;

    try {
      this.ws.send(JSON.stringify(msg));
      if (msg.messageId) {
        this.pendingAcks.add(msg.messageId);
      }
      return true;
    } catch {
      return false;
    }
  }

  /** 发送聊天消息 */
  sendChatMessage(chatId: ChatId, message: Message): boolean {
    return this.send({
      type: "chat_message",
      payload: { chatId, message },
      messageId: message.id,
      timestamp: Date.now(),
    });
  }

  /** 获取连接状态 */
  getState(): WSConnectionState {
    return this.state;
  }

  /** 处理收到的消息 */
  private handleMessage(msg: WSMessage): void {
    switch (msg.type) {
      case "pong":
        // 心跳响应
        break;
      case "error":
        console.error("[WS] 服务端错误:", msg.payload);
        break;
      default:
        // 处理消息确认
        if (msg.messageId) {
          this.pendingAcks.delete(msg.messageId);
        }
        this.handlers.onMessage?.(msg);
    }
  }

  /** 安排重连 */
  private scheduleReconnect(): void {
    if (this.retryCount >= this.reconnectConfig.maxRetries) return;

    this.setState("reconnecting");
    const delay = Math.min(
      this.reconnectConfig.baseDelay * Math.pow(2, this.retryCount),
      this.reconnectConfig.maxDelay
    );
    this.retryCount++;

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  /** 启动心跳 */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.send({ type: "pong", payload: null, timestamp: Date.now() });
    }, 30000);
  }

  /** 停止心跳 */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /** 更新状态 */
  private setState(state: WSConnectionState): void {
    this.state = state;
    this.handlers.onStateChange?.(state);
  }
}

// ============================================================
// 消息推送服务（供 store/引擎调用）
// ============================================================

/** 推送事件类型 */
export type PushEventType =
  | "new_message"
  | "task_status_changed"
  | "report_created"
  | "report_resolved"
  | "agent_status_changed"
  | "budget_alert"
  | "urgent_report";

/** 推送事件 */
export interface PushEvent {
  event: PushEventType;
  chatId?: ChatId;
  data: unknown;
  timestamp: number;
}

/** 推送事件监听器 */
type PushListener = (event: PushEvent) => void;

const pushListeners: PushListener[] = [];

/** 注册推送监听器 */
export function onPushEvent(listener: PushListener): () => void {
  pushListeners.push(listener);
  return () => {
    const idx = pushListeners.indexOf(listener);
    if (idx >= 0) pushListeners.splice(idx, 1);
  };
}

/** 发送推送事件（供 store/引擎调用） */
export function emitPushEvent(event: PushEventType, data: unknown, chatId?: ChatId): void {
  const pushEvent: PushEvent = { event, chatId, data, timestamp: Date.now() };
  for (const listener of pushListeners) {
    try {
      listener(pushEvent);
    } catch (err) {
      console.error("[Push] 监听器错误:", err);
    }
  }
}
