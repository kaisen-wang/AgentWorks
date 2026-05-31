/**
 * Agent工具定义和执行器
 * 
 * 为Agent提供可用的工具定义和执行逻辑
 * 
 * 注意：文件操作使用 Server Actions 在服务器端执行
 */

import type { ToolDefinition } from "@/lib/llm/LLMService";
import { writeFileContent, readFileContent } from "@/actions/file-actions";
import { executeCommand, executeSkillInstall } from "@/actions/command-actions";

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
    {
      type: "function",
      function: {
        name: "install_skill",
        description: "通过 URL 安装 Skill。支持 HTTP/HTTPS、本地文件路径和 Git 仓库。安装后 Skill 会自动注册到指定范围（全局或私有）。",
        parameters: {
          type: "object",
          properties: {
            url: {
              type: "string",
              description: "Skill 包的 URL，如 'https://example.com/skills/my-skill.tar.gz' 或 'file:///path/to/skill' 或 'git://github.com/user/skill.git'",
            },
            scope: {
              type: "string",
              enum: ["global", "private"],
              description: "安装范围：'global' 表示所有 Agent 可用，'private' 表示仅当前 Agent 可用。默认为 'private'",
            },
            agent_id: {
              type: "string",
              description: "执行安装的 Agent ID",
            },
            auto_install_dependencies: {
              type: "boolean",
              description: "是否自动安装缺失的依赖，默认为 true",
            },
          },
          required: ["url", "agent_id"],
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
  // [DEBUG] 打印工具执行入口
  console.log('[DEBUG][AgentTools] executeToolCall 入口:', {
    toolName,
    argsLength: argumentsJson.length,
    argsPreview: argumentsJson.slice(0, 300),
  });

  try {
    // 尝试解析 JSON，如果失败则提供详细错误信息
    let args;
    try {
      args = JSON.parse(argumentsJson);
    } catch (parseError) {
      const errorPos = parseError instanceof Error ? 
        parseError.message.match(/position (\d+)/)?.[1] : 'unknown';
      
      console.error('❌ [JSON Parse Error] 详细信息:');
      console.error('- 错误:', parseError instanceof Error ? parseError.message : String(parseError));
      console.error('- JSON 总长度:', argumentsJson.length);
      console.error('- 错误位置:', errorPos);
      console.error('- argumentsJson:', argumentsJson);
      
      return {
        success: false,
        error: `JSON解析失败: ${parseError instanceof Error ? parseError.message : String(parseError)}。JSON长度: ${argumentsJson.length}，错误位置: ${errorPos}`,
      };
    }

    // [DEBUG] 打印解析后的参数
    console.log('[DEBUG][AgentTools] JSON 解析成功:', {
      toolName,
      parsedArgs: args,
    });

    switch (toolName) {
      case "write_file":
        console.log('[DEBUG][AgentTools] 分发到 executeWriteFile:', { filePath: args.file_path, contentLength: args.content?.length });
        return await executeWriteFile(args.file_path, args.content);

      case "read_file":
        console.log('[DEBUG][AgentTools] 分发到 executeReadFile:', { filePath: args.file_path });
        return await executeReadFile(args.file_path);

      case "edit_file":
        console.log('[DEBUG][AgentTools] 分发到 executeEditFile:', { filePath: args.file_path, oldContentLength: args.old_content?.length, newContentLength: args.new_content?.length });
        return await executeEditFile(args.file_path, args.old_content, args.new_content);

      case "run_command":
        console.log('[DEBUG][AgentTools] 分发到 executeRunCommand:', { command: args.command });
        return await executeRunCommand(args.command);

      case "install_skill":
        console.log('[DEBUG][AgentTools] 分发到 executeInstallSkill:', { url: args.url, agentId: args.agent_id, scope: args.scope });
        return await executeInstallSkill(args.url, args.agent_id, args.scope, args.auto_install_dependencies);

      default:
        console.error('[DEBUG][AgentTools] 未知工具:', toolName);
        return {
          success: false,
          error: `未知工具: ${toolName}`,
        };
    }
  } catch (error) {
    console.error('[DEBUG][AgentTools] 工具执行异常:', {
      toolName,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
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
    // 使用 Server Action 写入文件到 output 目录
    const result = await writeFileContent(`output/${filePath}`, content);
    
    if (result.success) {
      return {
        success: true,
        output: `文件已创建: output/${filePath}`,
      };
    } else {
      return {
        success: false,
        error: result.error || "写文件失败",
      };
    }
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
    // 使用 Server Action 读取文件
    const result = await readFileContent(filePath);
    
    if (result.success) {
      return {
        success: true,
        output: result.data,
      };
    } else {
      return {
        success: false,
        error: result.error || "读文件失败",
      };
    }
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
    // 先读取文件
    const readResult = await readFileContent(filePath);
    
    if (!readResult.success) {
      return {
        success: false,
        error: readResult.error || "读取文件失败",
      };
    }
    
    let content = readResult.data!;
    
    // 替换内容
    if (!content.includes(oldContent)) {
      return {
        success: false,
        error: "未找到要替换的内容",
      };
    }
    
    content = content.replace(oldContent, newContent);
    
    // 写回文件
    const writeResult = await writeFileContent(filePath, content);
    
    if (writeResult.success) {
      return {
        success: true,
        output: `文件已更新: ${filePath}`,
      };
    } else {
      return {
        success: false,
        error: writeResult.error || "写入文件失败",
      };
    }
  } catch (error) {
    return {
      success: false,
      error: `编辑文件失败: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * 执行命令（通过 Server Action 在服务端执行）
 */
async function executeRunCommand(command: string): Promise<ToolExecutionResult> {
  return await executeCommand(command);
}

/**
 * 执行 Skill 安装（通过 Server Action 在服务端执行）
 */
async function executeInstallSkill(
  url: string,
  agentId: string,
  scope?: string,
  autoInstallDependencies?: boolean
): Promise<ToolExecutionResult> {
  return await executeSkillInstall(url, agentId, scope, autoInstallDependencies);
}
