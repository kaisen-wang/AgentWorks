/**
 * 文件存储服务 - 本地磁盘存储
 *
 * 将上传的文件保存到 data/uploads/ 目录，
 * 返回文件 ID 和访问路径。
 */

import path from "path";
import fs from "fs";
import crypto from "crypto";

const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");

/** 确保上传目录存在 */
function ensureUploadDir(): void {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
}

/** 上传文件元信息 */
export interface UploadedFile {
  id: string;           // 文件唯一 ID
  filename: string;     // 原始文件名
  mimeType: string;     // MIME 类型
  size: number;         // 文件大小（字节）
  path: string;         // 存储路径（相对 data/uploads/）
  url: string;          // 访问 URL
  uploadedAt: number;   // 上传时间戳
}

/**
 * 保存文件到本地磁盘
 * @param buffer 文件内容
 * @param filename 原始文件名
 * @param mimeType MIME 类型
 * @returns 文件元信息
 */
export function saveFile(
  buffer: Buffer,
  filename: string,
  mimeType: string
): UploadedFile {
  ensureUploadDir();

  const id = crypto.randomUUID();
  const ext = path.extname(filename) || mimeToExt(mimeType);
  const storedName = `${id}${ext}`;
  const filePath = path.join(UPLOAD_DIR, storedName);

  fs.writeFileSync(filePath, buffer);

  return {
    id,
    filename,
    mimeType,
    size: buffer.length,
    path: storedName,
    url: `/api/chat/files/${id}`,
    uploadedAt: Date.now(),
  };
}

/**
 * 读取文件
 * @param fileId 文件 ID
 * @returns 文件内容和元信息，或 null
 */
export function readFile(
  fileId: string
): { buffer: Buffer; info: UploadedFile } | null {
  ensureUploadDir();

  // 查找以 fileId 开头的文件
  const files = fs.readdirSync(UPLOAD_DIR);
  const matched = files.find((f) => f.startsWith(fileId));

  if (!matched) return null;

  const filePath = path.join(UPLOAD_DIR, matched);
  const buffer = fs.readFileSync(filePath);
  const ext = path.extname(matched);

  return {
    buffer,
    info: {
      id: fileId,
      filename: matched,
      mimeType: extToMime(ext),
      size: buffer.length,
      path: matched,
      url: `/api/chat/files/${fileId}`,
      uploadedAt: fs.statSync(filePath).mtimeMs,
    },
  };
}

/**
 * 删除文件
 * @param fileId 文件 ID
 */
export function deleteFile(fileId: string): boolean {
  ensureUploadDir();

  const files = fs.readdirSync(UPLOAD_DIR);
  const matched = files.find((f) => f.startsWith(fileId));

  if (!matched) return false;

  fs.unlinkSync(path.join(UPLOAD_DIR, matched));
  return true;
}

/** MIME 类型到扩展名映射 */
function mimeToExt(mimeType: string): string {
  const map: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "image/svg+xml": ".svg",
    "application/pdf": ".pdf",
    "text/plain": ".txt",
    "text/csv": ".csv",
    "application/json": ".json",
    "application/zip": ".zip",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
  };
  return map[mimeType] || ".bin";
}

/** 扩展名到 MIME 类型映射 */
function extToMime(ext: string): string {
  const map: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".pdf": "application/pdf",
    ".txt": "text/plain",
    ".csv": "text/csv",
    ".json": "application/json",
    ".zip": "application/zip",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls": "application/vnd.ms-excel",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".ppt": "application/vnd.ms-powerpoint",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  };
  return map[ext] || "application/octet-stream";
}
