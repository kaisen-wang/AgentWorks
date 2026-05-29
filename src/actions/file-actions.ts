/**
 * 文件操作 Server Actions
 * 
 * 所有文件系统操作必须在服务器端执行
 * 使用 "use server" 标记为 Server Actions
 */

"use server";

import { readFile, writeFile, access, mkdir } from "fs/promises";
import { join, resolve } from "path";
import { constants } from "fs";

/**
 * 读取文件内容
 */
export async function readFileContent(
  filePath: string,
  encoding: BufferEncoding = "utf-8"
): Promise<{ success: boolean; data?: string; error?: string }> {
  try {
    // 确保路径是相对于项目根目录
    const fullPath = resolve(process.cwd(), filePath);
    
    // 检查文件是否存在
    await access(fullPath, constants.R_OK);
    
    // 读取文件
    const content = await readFile(fullPath, encoding);
    
    return {
      success: true,
      data: content,
    };
  } catch (error) {
    return {
      success: false,
      error: `读取文件失败: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * 写入文件内容
 */
export async function writeFileContent(
  filePath: string,
  content: string,
  encoding: BufferEncoding = "utf-8"
): Promise<{ success: boolean; error?: string }> {
  try {
    // 确保路径是相对于项目根目录
    const fullPath = resolve(process.cwd(), filePath);
    
    // 确保目录存在
    const dirPath = join(fullPath, "..");
    await mkdir(dirPath, { recursive: true });
    
    // 写入文件
    await writeFile(fullPath, content, encoding);
    
    return {
      success: true,
    };
  } catch (error) {
    return {
      success: false,
      error: `写入文件失败: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * 检查文件是否存在
 */
export async function checkFileExists(
  filePath: string
): Promise<boolean> {
  try {
    const fullPath = resolve(process.cwd(), filePath);
    await access(fullPath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * 读取 JSON 配置文件
 */
export async function readJsonConfig<T = any>(
  filePath: string
): Promise<{ success: boolean; data?: T; error?: string }> {
  try {
    const result = await readFileContent(filePath);
    
    if (!result.success) {
      return {
        success: false,
        error: result.error,
      };
    }
    
    const data = JSON.parse(result.data!) as T;
    
    return {
      success: true,
      data,
    };
  } catch (error) {
    return {
      success: false,
      error: `解析 JSON 失败: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * 读取 Markdown 文件
 */
export async function readMarkdownFile(
  filePath: string
): Promise<{ success: boolean; data?: string; error?: string }> {
  return readFileContent(filePath, "utf-8");
}

/**
 * 获取项目根目录
 */
export async function getProjectRoot(): Promise<string> {
  return process.cwd();
}

/**
 * 读取 output 目录下的文件
 */
export async function readOutputFile(
  fileName: string
): Promise<{ success: boolean; data?: string; error?: string }> {
  return readFileContent(join("output", fileName));
}

/**
 * 写入文件到 output 目录
 */
export async function writeOutputFile(
  fileName: string,
  content: string
): Promise<{ success: boolean; error?: string }> {
  return writeFileContent(join("output", fileName), content);
}
