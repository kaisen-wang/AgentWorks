/**
 * 群聊详情面板逻辑测试
 * 测试 GroupDetailPanel 涉及的 store 交互逻辑
 */
import { describe, it, expect, beforeEach } from "vitest";
import { useAppStore } from "@/stores/appStore";
import type { ChatMember } from "@/types";

// 重置 store
beforeEach(() => {
  const store = useAppStore.getState();
  // 清空会话和消息
  useAppStore.setState({ chats: {}, messages: {}, activeChatId: null });
});

describe("GroupDetailPanel 逻辑", () => {
  it("置顶切换", () => {
    const store = useAppStore.getState();
    const chat = store.createChat("group", "测试群", [
      { id: "user", name: "用户", avatar: "user", role: "owner" },
    ]);
    expect(chat.pinned).toBeFalsy();

    store.toggleChatPinned(chat.id);
    expect(useAppStore.getState().chats[chat.id].pinned).toBe(true);

    store.toggleChatPinned(chat.id);
    expect(useAppStore.getState().chats[chat.id].pinned).toBe(false);
  });

  it("免打扰切换", () => {
    const store = useAppStore.getState();
    const chat = store.createChat("group", "测试群", [
      { id: "user", name: "用户", avatar: "user", role: "owner" },
    ]);
    expect(chat.muted).toBeFalsy();

    store.toggleChatMuted(chat.id);
    expect(useAppStore.getState().chats[chat.id].muted).toBe(true);

    store.toggleChatMuted(chat.id);
    expect(useAppStore.getState().chats[chat.id].muted).toBe(false);
  });

  it("免打扰模式下不增加未读计数", () => {
    const store = useAppStore.getState();
    const chat = store.createChat("group", "测试群", [
      { id: "user", name: "用户", avatar: "user", role: "owner" },
      { id: "agent-1", name: "Agent1", avatar: "bot", role: "member" },
    ]);

    // 设置免打扰
    store.toggleChatMuted(chat.id);
    // 切换到其他会话
    useAppStore.setState({ activeChatId: "other-chat" });

    // Agent 发送消息
    store.sendMessage(chat.id, "text", "agent-1", "测试消息");

    // 免打扰模式下未读计数应为 0
    expect(useAppStore.getState().chats[chat.id].unreadCount).toBe(0);
  });

  it("非免打扰模式下增加未读计数", () => {
    const store = useAppStore.getState();
    const chat = store.createChat("group", "测试群", [
      { id: "user", name: "用户", avatar: "user", role: "owner" },
      { id: "agent-1", name: "Agent1", avatar: "bot", role: "member" },
    ]);

    // 切换到其他会话
    useAppStore.setState({ activeChatId: "other-chat" });

    // Agent 发送消息
    store.sendMessage(chat.id, "text", "agent-1", "测试消息");

    // 非免打扰模式下未读计数应为 1
    expect(useAppStore.getState().chats[chat.id].unreadCount).toBe(1);
  });

  it("消息撤回 - 2 分钟内可撤回", () => {
    const store = useAppStore.getState();
    const chat = store.createChat("group", "测试群", [
      { id: "user", name: "用户", avatar: "user", role: "owner" },
    ]);

    const msg = store.sendMessage(chat.id, "text", "user", "可撤回的消息");
    expect(msg.revoked).toBeFalsy();

    store.revokeMessage(chat.id, msg.id);

    const msgs = useAppStore.getState().messages[chat.id];
    const revokedMsg = msgs.find((m) => m.id === msg.id);
    expect(revokedMsg?.revoked).toBe(true);
    expect(revokedMsg?.content).toBe("此消息已撤回");
  });

  it("消息撤回 - 超过 2 分钟不可撤回", () => {
    const store = useAppStore.getState();
    const chat = store.createChat("group", "测试群", [
      { id: "user", name: "用户", avatar: "user", role: "owner" },
    ]);

    const msg = store.sendMessage(chat.id, "text", "user", "旧消息");

    // 手动将消息时间戳改为 3 分钟前
    useAppStore.setState({
      messages: {
        ...useAppStore.getState().messages,
        [chat.id]: useAppStore.getState().messages[chat.id].map((m) =>
          m.id === msg.id ? { ...m, timestamp: Date.now() - 3 * 60 * 1000 } : m
        ),
      },
    });

    store.revokeMessage(chat.id, msg.id);

    const msgs = useAppStore.getState().messages[chat.id];
    const targetMsg = msgs.find((m) => m.id === msg.id);
    expect(targetMsg?.revoked).toBeFalsy();
  });

  it("已撤回的消息不能再次撤回", () => {
    const store = useAppStore.getState();
    const chat = store.createChat("group", "测试群", [
      { id: "user", name: "用户", avatar: "user", role: "owner" },
    ]);

    const msg = store.sendMessage(chat.id, "text", "user", "消息");
    store.revokeMessage(chat.id, msg.id);

    // 再次撤回应无效
    store.revokeMessage(chat.id, msg.id);

    const msgs = useAppStore.getState().messages[chat.id];
    const revokedMsg = msgs.find((m) => m.id === msg.id);
    expect(revokedMsg?.revoked).toBe(true);
    expect(revokedMsg?.content).toBe("此消息已撤回");
  });

  it("群聊名称修改持久化", () => {
    const store = useAppStore.getState();
    const chat = store.createChat("group", "原名称", [
      { id: "user", name: "用户", avatar: "user", role: "owner" },
    ]);

    // 模拟 GroupDetailPanel 中的名称修改
    const updatedChat = { ...useAppStore.getState().chats[chat.id], name: "新名称" };
    useAppStore.setState({ chats: { ...useAppStore.getState().chats, [chat.id]: updatedChat } });

    expect(useAppStore.getState().chats[chat.id].name).toBe("新名称");
  });

  it("群聊描述修改持久化", () => {
    const store = useAppStore.getState();
    const chat = store.createChat("group", "测试群", [
      { id: "user", name: "用户", avatar: "user", role: "owner" },
    ]);

    const updatedChat = { ...useAppStore.getState().chats[chat.id], description: "新描述" };
    useAppStore.setState({ chats: { ...useAppStore.getState().chats, [chat.id]: updatedChat } });

    expect(useAppStore.getState().chats[chat.id].description).toBe("新描述");
  });

  it("解散群聊删除会话", () => {
    const store = useAppStore.getState();
    const chat = store.createChat("group", "待解散群", [
      { id: "user", name: "用户", avatar: "user", role: "owner" },
    ]);

    expect(useAppStore.getState().chats[chat.id]).toBeDefined();

    store.deleteChat(chat.id);

    expect(useAppStore.getState().chats[chat.id]).toBeUndefined();
  });
});
