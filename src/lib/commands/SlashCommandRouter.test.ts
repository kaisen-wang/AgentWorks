/**
 * SlashCommandRouter 测试
 */

import { describe, it, expect } from "vitest";
import { parseSlashCommand } from "./SlashCommandRouter";

describe("parseSlashCommand", () => {
  it("解析 /help 命令", () => {
    const result = parseSlashCommand("/help");
    expect(result).not.toBeNull();
    expect(result!.type).toBe("help");
    expect(result!.args).toBe("");
  });

  it("解析 /new_task 命令", () => {
    const result = parseSlashCommand("/new_task @营销主管 发布新品");
    expect(result).not.toBeNull();
    expect(result!.type).toBe("new_task");
    expect(result!.args).toBe("@营销主管 发布新品");
  });

  it("解析 /queue 命令", () => {
    const result = parseSlashCommand("/queue 营销主管");
    expect(result).not.toBeNull();
    expect(result!.type).toBe("queue");
    expect(result!.args).toBe("营销主管");
  });

  it("解析 /project 命令", () => {
    const result = parseSlashCommand("/project 壁纸品牌");
    expect(result).not.toBeNull();
    expect(result!.type).toBe("project");
    expect(result!.args).toBe("壁纸品牌");
  });

  it("解析 /archive 命令", () => {
    const result = parseSlashCommand("/archive 赛博山景");
    expect(result).not.toBeNull();
    expect(result!.type).toBe("archive");
    expect(result!.args).toBe("赛博山景");
  });

  it("解析 /exempt 命令", () => {
    const result = parseSlashCommand("/exempt 营销主管 项目需要");
    expect(result).not.toBeNull();
    expect(result!.type).toBe("exempt");
    expect(result!.args).toBe("营销主管 项目需要");
  });

  it("解析 /urgent 命令", () => {
    const result = parseSlashCommand("/urgent");
    expect(result).not.toBeNull();
    expect(result!.type).toBe("urgent");
  });

  it("解析 /summary 命令", () => {
    const result = parseSlashCommand("/summary");
    expect(result).not.toBeNull();
    expect(result!.type).toBe("summary");
  });

  it("未知命令返回 unknown", () => {
    const result = parseSlashCommand("/unknown_cmd");
    expect(result).not.toBeNull();
    expect(result!.type).toBe("unknown");
  });

  it("非斜杠命令返回 null", () => {
    const result = parseSlashCommand("普通消息");
    expect(result).toBeNull();
  });

  it("/task 作为 /new_task 的别名", () => {
    const result = parseSlashCommand("/task @Agent 描述");
    expect(result).not.toBeNull();
    expect(result!.type).toBe("new_task");
  });

  it("解析 /create_group 命令", () => {
    const result = parseSlashCommand("/create_group 作战室 @Agent1 @Agent2");
    expect(result).not.toBeNull();
    expect(result!.type).toBe("create_group");
    expect(result!.args).toBe("作战室 @Agent1 @Agent2");
  });

  it("解析 /add_member 命令", () => {
    const result = parseSlashCommand("/add_member @Agent1");
    expect(result).not.toBeNull();
    expect(result!.type).toBe("add_member");
    expect(result!.args).toBe("@Agent1");
  });

  it("解析 /remove_member 命令", () => {
    const result = parseSlashCommand("/remove_member @Agent1");
    expect(result).not.toBeNull();
    expect(result!.type).toBe("remove_member");
    expect(result!.args).toBe("@Agent1");
  });

  it("解析 /members 命令", () => {
    const result = parseSlashCommand("/members");
    expect(result).not.toBeNull();
    expect(result!.type).toBe("members");
    expect(result!.args).toBe("");
  });
});
