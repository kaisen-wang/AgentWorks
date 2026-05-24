/**
 * NotificationService - 通知服务
 *
 * 支持短信摘要和推送通知的真实发送。
 * 通过环境变量配置外部服务：
 * - SMS_GATEWAY_URL: 短信网关 URL（通用 HTTP 网关，如 Twilio / 阿里云短信 / 自建网关）
 * - SMS_GATEWAY_SECRET: 短信网关签名密钥
 * - SMS_RECIPIENT: 短信接收号码
 *
 * 当未配置外部服务时，降级为系统消息（不丢失信息）。
 */

/** 短信发送结果 */
export interface SmsResult {
  success: boolean;
  messageId?: string;
  error?: string;
  fallback: boolean; // 是否降级到系统消息
}

/** 通知载荷 */
export interface NotificationPayload {
  title: string;
  body: string;
  urgency?: "normal" | "urgent";
  metadata?: Record<string, unknown>;
}

/**
 * 发送短信摘要
 *
 * 支持两种模式：
 * 1. 配置了 SMS_GATEWAY_URL 时，真正调用外部短信 API
 * 2. 未配置时，返回 fallback=true，由调用方降级为系统消息
 */
export async function sendSmsSummary(payload: NotificationPayload): Promise<SmsResult> {
  const gatewayUrl = process.env.SMS_GATEWAY_URL || (typeof window !== "undefined" ? "" : "");
  const gatewaySecret = process.env.SMS_GATEWAY_SECRET || "";
  const recipient = process.env.SMS_RECIPIENT || "";

  // 未配置短信网关，降级
  if (!gatewayUrl) {
    return {
      success: true,
      fallback: true,
      messageId: `fallback_${Date.now()}`,
    };
  }

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // 签名
    if (gatewaySecret) {
      try {
        const crypto = require("crypto");
        const body = JSON.stringify({
          recipient,
          title: payload.title,
          body: payload.body,
          urgency: payload.urgency || "normal",
        });
        const signature = crypto
          .createHmac("sha256", gatewaySecret)
          .update(body)
          .digest("hex");
        headers["X-Signature"] = signature;
      } catch {
        // crypto 不可用时跳过签名
      }
    }

    const response = await fetch(gatewayUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        recipient,
        title: payload.title,
        body: payload.body,
        urgency: payload.urgency || "normal",
        timestamp: Date.now(),
        source: "agentworks",
        metadata: payload.metadata,
      }),
    });

    if (response.ok) {
      const data = await response.json().catch(() => ({}));
      return {
        success: true,
        fallback: false,
        messageId: data.messageId || data.id || `sms_${Date.now()}`,
      };
    }

    return {
      success: false,
      fallback: false,
      error: `HTTP ${response.status}: ${response.statusText}`,
    };
  } catch (err) {
    return {
      success: false,
      fallback: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * 发送推送通知（浏览器 Notification API）
 *
 * 用于紧急上报等场景，在浏览器端弹出系统通知。
 */
export function sendBrowserNotification(payload: NotificationPayload): boolean {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return false;
  }

  if (Notification.permission === "granted") {
    new Notification(payload.title, {
      body: payload.body,
      tag: payload.urgency === "urgent" ? "urgent" : "normal",
    });
    return true;
  }

  // 权限未授予，请求权限（异步，不等待结果）
  if (Notification.permission !== "denied") {
    Notification.requestPermission();
  }

  return false;
}
