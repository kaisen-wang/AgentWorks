/**
 * 文件下载/访问 API 端点
 * GET /api/chat/files/[id]
 *
 * 根据文件 ID 读取本地磁盘上的文件并返回。
 * 图片类型直接返回内容（浏览器可内联显示），
 * 其他类型返回 Content-Disposition: attachment 触发下载。
 */

import { NextRequest, NextResponse } from "next/server";
import { readFile } from "@/lib/storage/fileStorage";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const result = readFile(id);

    if (!result) {
      return NextResponse.json(
        { error: "文件不存在" },
        { status: 404 }
      );
    }

    const { buffer, info } = result;
    const isImage = info.mimeType.startsWith("image/");

    // 构建响应头
    const headers: Record<string, string> = {
      "Content-Type": info.mimeType,
      "Content-Length": String(buffer.length),
      "Cache-Control": "public, max-age=31536000, immutable",
    };

    // 非图片类型触发下载
    if (!isImage) {
      headers["Content-Disposition"] = `attachment; filename="${encodeURIComponent(info.filename)}"`;
    }

    return new NextResponse(new Uint8Array(buffer), { status: 200, headers });
  } catch (err) {
    console.error("文件读取失败:", err);
    return NextResponse.json(
      { error: "文件读取失败" },
      { status: 500 }
    );
  }
}

/**
 * 删除文件
 * DELETE /api/chat/files/[id]
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const { deleteFile } = await import("@/lib/storage/fileStorage");
    const deleted = deleteFile(id);

    if (!deleted) {
      return NextResponse.json(
        { error: "文件不存在" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("文件删除失败:", err);
    return NextResponse.json(
      { error: "文件删除失败" },
      { status: 500 }
    );
  }
}
