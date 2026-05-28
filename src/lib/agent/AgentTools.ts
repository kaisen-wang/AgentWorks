/**
 * Agent工具定义和执行器
 * 
 * 为Agent提供可用的工具定义和执行逻辑
 */

import type { ToolDefinition } from "@/lib/llm/LLMService";

/**
 * 获取Agent可用的工具定义
 */
export function getAgentToolDefinitions(): ToolDefinition[] {
  return [
    {
      type: "function",
      function: {
        name: "write_file",
        description: "创建或覆盖文件。用于生成代码文件、配置文件等。",
        parameters: {
          type: "object",
          properties: {
            file_path: {
              type: "string",
              description: "文件的相对路径，如 'src/components/Button.tsx' 或 'output/game.html'",
            },
            content: {
              type: "string",
              description: "文件的完整内容",
            },
          },
          required: ["file_path", "content"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "read_file",
        description: "读取文件内容。用于查看现有代码或配置。",
        parameters: {
          type: "object",
          properties: {
            file_path: {
              type: "string",
              description: "要读取的文件路径",
            },
          },
          required: ["file_path"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "edit_file",
        description: "编辑文件的部分内容。用于修改现有代码。",
        parameters: {
          type: "object",
          properties: {
            file_path: {
              type: "string",
              description: "要编辑的文件路径",
            },
            old_content: {
              type: "string",
              description: "要替换的旧内容（必须精确匹配）",
            },
            new_content: {
              type: "string",
              description: "替换后的新内容",
            },
          },
          required: ["file_path", "old_content", "new_content"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "run_command",
        description: "执行shell命令。用于安装依赖、运行测试等。注意：只能执行安全的命令。",
        parameters: {
          type: "object",
          properties: {
            command: {
              type: "string",
              description: "要执行的命令，如 'npm install' 或 'npm run build'",
            },
          },
          required: ["command"],
        },
      },
    },
  ];
}

/**
 * 工具执行结果
 */
export interface ToolExecutionResult {
  success: boolean;
  output?: string;
  error?: string;
}

/**
 * 执行工具调用
 */
export async function executeToolCall(
  toolName: string,
  argumentsJson: string
): Promise<ToolExecutionResult> {
  try {
    const args = JSON.parse(argumentsJson);

    switch (toolName) {
      case "write_file":
        return await executeWriteFile(args.file_path, args.content);

      case "read_file":
        return await executeReadFile(args.file_path);

      case "edit_file":
        return await executeEditFile(args.file_path, args.old_content, args.new_content);

      case "run_command":
        return await executeRunCommand(args.command);

      default:
        return {
          success: false,
          error: `未知工具: ${toolName}`,
        };
    }
  } catch (error) {
    return {
      success: false,
      error: `工具执行失败: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * 执行写文件操作
 */
async function executeWriteFile(filePath: string, content: string): Promise<ToolExecutionResult> {
  try {
    // 使用相对路径，在项目的output目录下创建文件
    const fs = await import("fs/promises");
    const path = await import("path");

    // 确保output目录存在
    const outputDir = path.join(process.cwd(), "output");
    await fs.mkdir(outputDir, { recursive: true });

    // 写入文件
    const fullPath = path.join(outputDir, filePath);
    await fs.writeFile(fullPath, content, "utf-8");

    return {
      success: true,
      output: `文件已创建: output/${filePath}`,
    };
  } catch (error) {
    return {
      success: false,
      error: `写文件失败: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * 执行读文件操作
 */
async function executeReadFile(filePath: string): Promise<ToolExecutionResult> {
  try {
    const fs = await import("fs/promises");
    const path = await import("path");

    const fullPath = path.join(process.cwd(), filePath);
    const content = await fs.readFile(fullPath, "utf-8");

    return {
      success: true,
      output: content,
    };
  } catch (error) {
    return {
      success: false,
      error: `读文件失败: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * 执行编辑文件操作
 */
async function executeEditFile(
  filePath: string,
  oldContent: string,
  newContent: string
): Promise<ToolExecutionResult> {
  try {
    const fs = await import("fs/promises");
    const path = await import("path");

    const fullPath = path.join(process.cwd(), filePath);
    let content = await fs.readFile(fullPath, "utf-8");

    // 替换内容
    if (!content.includes(oldContent)) {
      return {
        success: false,
        error: "未找到要替换的内容",
      };
    }

    content = content.replace(oldContent, newContent);
    await fs.writeFile(fullPath, content, "utf-8");

    return {
      success: true,
      output: `文件已更新: ${filePath}`,
    };
  } catch (error) {
    return {
      success: false,
      error: `编辑文件失败: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * 执行命令（受限）
 */
async function executeRunCommand(command: string): Promise<ToolExecutionResult> {
  // 安全检查：只允许特定命令
  const allowedCommands = [
    "npm install",
    "npm run build",
    "npm run dev",
    "npm test",
    "npm run lint",
    "yarn install",
    "yarn build",
    "yarn dev",
    "yarn test",
  ];

  const isAllowed = allowedCommands.some((allowed) => command.startsWith(allowed));

  if (!isAllowed) {
    return {
      success: false,
      error: `命令不允许执行: ${command}。只允许: ${allowedCommands.join(", ")}`,
    };
  }

  try {
    const { exec } = await import("child_process");
    const { promisify } = await import("util");
    const execAsync = promisify(exec);

    const { stdout, stderr } = await execAsync(command, {
      cwd: process.cwd(),
      timeout: 30000, // 30秒超时
    });

    return {
      success: true,
      output: stdout || stderr || "命令执行成功",
    };
  } catch (error: any) {
    return {
      success: false,
      error: `命令执行失败: ${error.message}`,
    };
  }
}
