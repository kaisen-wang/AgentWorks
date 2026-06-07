/**
 * 文件上传 API 端点
 * POST /api/chat/upload
 *
 * 接受 multipart/form-data，保存文件到本地磁盘，
 * 返回文件元信息（id, url, filename, size, mimeType）。
 */

import { NextRequest, NextResponse } from "next/server";
import { saveFile } from "@/lib/storage/fileStorage";

// 文件大小限制：50MB
const MAX_FILE_SIZE = 50 * 1024 * 1024;

// 允许的 MIME 类型
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml",
  "application/pdf",
  "text/plain", "text/csv", "text/markdown", "application/json",
  "application/zip",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "未提供文件，请使用 form data 的 file 字段上传" },
        { status: 400 }
      );
    }

    // 检查文件大小
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `文件大小超过限制（最大 ${MAX_FILE_SIZE / 1024 / 1024}MB）` },
        { status: 413 }
      );
    }

    // 检查 MIME 类型
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: `不支持的文件类型: ${file.type}` },
        { status: 415 }
      );
    }

    // 读取文件内容
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 保存到本地磁盘
    const uploaded = saveFile(buffer, file.name, file.type);

    return NextResponse.json({
      success: true,
      file: {
        id: uploaded.id,
        filename: uploaded.filename,
        mimeType: uploaded.mimeType,
        size: uploaded.size,
        url: uploaded.url,
        uploadedAt: uploaded.uploadedAt,
      },
    });
  } catch (err) {
    console.error("文件上传失败:", err);
    return NextResponse.json(
      { error: "文件上传失败" },
      { status: 500 }
    );
  }
}
