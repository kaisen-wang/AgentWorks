/**
 * ChatRepository 单元测试
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { ChatRepository } from "./chatRepo";
import type { Chat, ChatMember, ChatType } from "@/types";
import { v4 as uuidv4 } from "uuid";

let db: Database.Database;
let repo: ChatRepository;

beforeEach(() => {
  db = new Database(":memory:");
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE conversations (
      conversation_id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      owner_id TEXT,
      project_id TEXT,
      members TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE messages (
      message_id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      sender_id TEXT NOT NULL,
      sender_type TEXT NOT NULL,
      message_type TEXT NOT NULL,
      content TEXT NOT NULL,
      reply_to TEXT,
      is_cross_department INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
  `);
  repo = new ChatRepository(db);
});

afterEach(() => {
  db.close();
});

function makeChat(overrides?: Partial<Chat>): Chat {
  return {
    id: uuidv4(),
    type: "group",
    name: "测试群聊",
    members: [
      { id: "user", name: "你", avatar: "user", role: "owner" },
      { id: "agent1", name: "Agent1", avatar: "bot", role: "member" },
    ],
    createdAt: Date.now(),
    ...overrides,
  };
}

describe("ChatRepository - 基础 CRUD", () => {
  it("创建和查找群聊", () => {
    const chat = makeChat();
    repo.create(chat);
    const found = repo.findById(chat.id);
    expect(found).toBeDefined();
    expect(found!.name).toBe("测试群聊");
    expect(found!.type).toBe("group");
    expect(found!.members).toHaveLength(2);
  });

  it("findAll 返回所有会话", () => {
    repo.create(makeChat({ name: "群1" }));
    repo.create(makeChat({ name: "群2" }));
    const all = repo.findAll();
    expect(all).toHaveLength(2);
  });

  it("更新群聊名称", () => {
    const chat = makeChat();
    repo.create(chat);
    const updated = { ...chat, name: "新名称" };
    repo.update(updated);
    const found = repo.findById(chat.id);
    expect(found!.name).toBe("新名称");
  });

  it("更新群聊描述", () => {
    const chat = makeChat();
    repo.create(chat);
    const updated = { ...chat, description: "新描述" };
    repo.update(updated);
    const found = repo.findById(chat.id);
    expect(found!.description).toBe("新描述");
  });

  it("删除群聊", () => {
    const chat = makeChat();
    repo.create(chat);
    repo.delete(chat.id);
    const found = repo.findById(chat.id);
    expect(found).toBeUndefined();
  });

  it("删除群聊同时删除关联消息", () => {
    const chat = makeChat();
    repo.create(chat);
    db.prepare("INSERT INTO messages VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
      "msg1", chat.id, "user", "user", "text", "hello", null, 0, Date.now()
    );
    repo.delete(chat.id);
    const msgs = db.prepare("SELECT * FROM messages WHERE conversation_id = ?").all(chat.id);
    expect(msgs).toHaveLength(0);
  });
});

describe("ChatRepository - 成员管理", () => {
  it("添加成员", () => {
    const chat = makeChat();
    repo.create(chat);
    const newMember: ChatMember = { id: "agent2", name: "Agent2", avatar: "specialist", role: "readonly" };
    repo.addMember(chat.id, newMember);
    const found = repo.findById(chat.id);
    expect(found!.members).toHaveLength(3);
    expect(found!.members[2].name).toBe("Agent2");
    expect(found!.members[2].role).toBe("readonly");
  });

  it("移除成员", () => {
    const chat = makeChat();
    repo.create(chat);
    repo.removeMember(chat.id, "agent1");
    const found = repo.findById(chat.id);
    expect(found!.members).toHaveLength(1);
    expect(found!.members[0].id).toBe("user");
  });

  it("添加成员到不存在的群聊不报错", () => {
    const member: ChatMember = { id: "agent2", name: "Agent2", avatar: "bot", role: "member" };
    expect(() => repo.addMember("non-existent", member)).not.toThrow();
  });

  it("从不存在的群聊移除成员不报错", () => {
    expect(() => repo.removeMember("non-existent", "agent1")).not.toThrow();
  });
});

describe("ChatRepository - 群名称保留", () => {
  it("自定义群名称不被成员名拼接覆盖", () => {
    const chat = makeChat({ name: "营销作战室" });
    repo.create(chat);
    const found = repo.findById(chat.id);
    expect(found!.name).toBe("营销作战室");
  });

  it("name 为空时回退到成员名拼接", () => {
    const chat = makeChat({ name: "" });
    repo.create(chat);
    const found = repo.findById(chat.id);
    // 空名称应回退到成员名拼接
    expect(found!.name).toContain("你");
  });
});

describe("ChatRepository - ownerId 持久化", () => {
  it("ownerId 正确存储和读取", () => {
    const chat = makeChat({ ownerId: "user" });
    repo.create(chat);
    const found = repo.findById(chat.id);
    expect(found!.ownerId).toBe("user");
  });
});

describe("ChatRepository - 单聊支持", () => {
  it("创建和查找单聊", () => {
    const chat = makeChat({
      type: "direct",
      name: "Agent1",
      members: [
        { id: "user", name: "你", avatar: "user", role: "owner" },
        { id: "agent1", name: "Agent1", avatar: "bot", role: "member" },
      ],
    });
    repo.create(chat);
    const found = repo.findById(chat.id);
    expect(found!.type).toBe("direct");
    expect(found!.members).toHaveLength(2);
  });
});
