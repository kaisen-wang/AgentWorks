/**
 * NotificationService 测试
 *
 * 覆盖：
 * - 短信发送：未配置网关时降级
 * - 短信发送：配置网关后真正发送
 * - 短信发送：网关错误处理
 * - 浏览器通知：权限检查
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendSmsSummary, sendBrowserNotification } from "./NotificationService";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("NotificationService", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    // 清除环境变量
    delete process.env.SMS_GATEWAY_URL;
    delete process.env.SMS_GATEWAY_SECRET;
    delete process.env.SMS_RECIPIENT;
  });

  describe("sendSmsSummary", () => {
    it("未配置网关时返回 fallback=true", async () => {
      const result = await sendSmsSummary({
        title: "测试标题",
        body: "测试内容",
      });

      expect(result.success).toBe(true);
      expect(result.fallback).toBe(true);
      expect(result.messageId).toMatch(/^fallback_/);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("配置网关后真正发送 HTTP 请求", async () => {
      process.env.SMS_GATEWAY_URL = "https://sms.example.com/api/send";
      process.env.SMS_GATEWAY_SECRET = "test-secret";
      process.env.SMS_RECIPIENT = "+8613800138000";

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ messageId: "msg_123" }),
      });

      const result = await sendSmsSummary({
        title: "紧急任务",
        body: "需要立即处理",
        urgency: "urgent",
      });

      expect(result.success).toBe(true);
      expect(result.fallback).toBe(false);
      expect(result.messageId).toBe("msg_123");
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe("https://sms.example.com/api/send");
      expect(options.method).toBe("POST");
      expect(options.headers["Content-Type"]).toBe("application/json");
      expect(options.headers["X-Signature"]).toBeDefined();

      const body = JSON.parse(options.body);
      expect(body.recipient).toBe("+8613800138000");
      expect(body.title).toBe("紧急任务");
      expect(body.urgency).toBe("urgent");
      expect(body.source).toBe("agentworks");
    });

    it("网关返回非 2xx 时标记失败", async () => {
      process.env.SMS_GATEWAY_URL = "https://sms.example.com/api/send";
      process.env.SMS_RECIPIENT = "+8613800138000";

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      const result = await sendSmsSummary({
        title: "测试",
        body: "内容",
      });

      expect(result.success).toBe(false);
      expect(result.fallback).toBe(false);
      expect(result.error).toContain("HTTP 500");
    });

    it("网关请求异常时标记失败", async () => {
      process.env.SMS_GATEWAY_URL = "https://sms.example.com/api/send";
      process.env.SMS_RECIPIENT = "+8613800138000";

      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await sendSmsSummary({
        title: "测试",
        body: "内容",
      });

      expect(result.success).toBe(false);
      expect(result.fallback).toBe(false);
      expect(result.error).toBe("Network error");
    });

    it("无签名密钥时不添加签名头", async () => {
      process.env.SMS_GATEWAY_URL = "https://sms.example.com/api/send";
      process.env.SMS_RECIPIENT = "+8613800138000";
      // 不设置 SMS_GATEWAY_SECRET

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "sms_456" }),
      });

      const result = await sendSmsSummary({
        title: "测试",
        body: "内容",
      });

      expect(result.success).toBe(true);
      const options = mockFetch.mock.calls[0][1];
      expect(options.headers["X-Signature"]).toBeUndefined();
    });

    it("网关返回无 messageId 时自动生成", async () => {
      process.env.SMS_GATEWAY_URL = "https://sms.example.com/api/send";
      process.env.SMS_RECIPIENT = "+8613800138000";

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const result = await sendSmsSummary({
        title: "测试",
        body: "内容",
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toMatch(/^sms_/);
    });
  });

  describe("sendBrowserNotification", () => {
    it("非浏览器环境返回 false", () => {
      // Node.js 环境下 window 不存在
      const result = sendBrowserNotification({
        title: "测试",
        body: "内容",
      });
      expect(result).toBe(false);
    });
  });
});
