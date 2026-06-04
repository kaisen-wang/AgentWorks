/**
 * 文件存储服务单元测试
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import { saveFile, readFile, deleteFile } from "./fileStorage";

const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");

// 清理测试文件
beforeEach(() => {
  if (fs.existsSync(UPLOAD_DIR)) {
    const files = fs.readdirSync(UPLOAD_DIR);
    for (const f of files) {
      if (f.startsWith("test-")) {
        fs.unlinkSync(path.join(UPLOAD_DIR, f));
      }
    }
  }
});

afterEach(() => {
  if (fs.existsSync(UPLOAD_DIR)) {
    const files = fs.readdirSync(UPLOAD_DIR);
    for (const f of files) {
      if (f.startsWith("test-")) {
        fs.unlinkSync(path.join(UPLOAD_DIR, f));
      }
    }
  }
});

describe("fileStorage", () => {
  it("保存文件到本地磁盘", () => {
    const buffer = Buffer.from("hello world");
    const result = saveFile(buffer, "test-doc.txt", "text/plain");

    expect(result.id).toBeDefined();
    expect(result.filename).toBe("test-doc.txt");
    expect(result.mimeType).toBe("text/plain");
    expect(result.size).toBe(11);
    expect(result.url).toBe(`/api/chat/files/${result.id}`);
    expect(result.uploadedAt).toBeGreaterThan(0);

    // 验证文件确实存在
    const files = fs.readdirSync(UPLOAD_DIR);
    const exists = files.some((f) => f.startsWith(result.id));
    expect(exists).toBe(true);
  });

  it("保存图片文件", () => {
    const buffer = Buffer.from([0x89, 0x50, 0x4E, 0x47]); // PNG header
    const result = saveFile(buffer, "test-image.png", "image/png");

    expect(result.mimeType).toBe("image/png");
    expect(result.path).toMatch(/\.png$/);
  });

  it("读取已保存的文件", () => {
    const content = "test content for reading";
    const buffer = Buffer.from(content);
    const saved = saveFile(buffer, "test-read.txt", "text/plain");

    const result = readFile(saved.id);
    expect(result).not.toBeNull();
    expect(result!.buffer.toString()).toBe(content);
    expect(result!.info.id).toBe(saved.id);
  });

  it("读取不存在的文件返回 null", () => {
    const result = readFile("nonexistent-file-id");
    expect(result).toBeNull();
  });

  it("删除已保存的文件", () => {
    const buffer = Buffer.from("to be deleted");
    const saved = saveFile(buffer, "test-delete.txt", "text/plain");

    const deleted = deleteFile(saved.id);
    expect(deleted).toBe(true);

    // 验证文件已删除
    const result = readFile(saved.id);
    expect(result).toBeNull();
  });

  it("删除不存在的文件返回 false", () => {
    const deleted = deleteFile("nonexistent-file-id");
    expect(deleted).toBe(false);
  });

  it("保存 PDF 文件", () => {
    const buffer = Buffer.from("%PDF-1.4");
    const result = saveFile(buffer, "test-doc.pdf", "application/pdf");

    expect(result.path).toMatch(/\.pdf$/);
  });

  it("保存大文件", () => {
    // 1MB 文件
    const buffer = Buffer.alloc(1024 * 1024, "x");
    const result = saveFile(buffer, "test-large.bin", "application/octet-stream");

    expect(result.size).toBe(1024 * 1024);
  });

  it("文件 URL 格式正确", () => {
    const buffer = Buffer.from("url test");
    const result = saveFile(buffer, "test-url.txt", "text/plain");

    expect(result.url).toMatch(/^\/api\/chat\/files\/[0-9a-f-]+$/);
  });
});
