/**
 * 配置管理实现
 */

import fs from 'fs/promises';
import path from 'path';
import type { SkillDefinition, ToolDefinition, ResourceScope } from '@/types';

/**
 * Skills 和 Tools 配置
 */
export interface SkillsToolsConfig {
  skills?: {
    global?: SkillDefinition[];
    private?: Record<string, SkillDefinition[]>; // agentId -> skills
  };
  tools?: {
    global?: ToolDefinition[];
    private?: Record<string, ToolDefinition[]>; // agentId -> tools
  };
  mcp?: {
    servers?: MCPServerConfig[];
  };
}

/**
 * MCP 服务器配置
 */
export interface MCPServerConfig {
  id: string;
  name: string;
  endpoint: string;
  authType?: 'bearer' | 'basic' | 'none';
  authConfig?: {
    token?: string;
    username?: string;
    password?: string;
  };
  timeout?: number;
}

/**
 * 配置管理器
 */
export class ConfigManager {
  private configPath: string;
  private config: SkillsToolsConfig | null = null;

  constructor(configPath: string) {
    this.configPath = configPath;
  }

  /**
   * 加载配置
   */
  async load(): Promise<SkillsToolsConfig> {
    try {
      // 检查文件是否存在
      const exists = await this.fileExists(this.configPath);
      if (!exists) {
        // 创建默认配置
        this.config = this.getDefaultConfig();
        await this.save(this.config);
        return this.config;
      }

      // 读取文件内容
      const content = await fs.readFile(this.configPath, 'utf-8');

      // 解析配置（支持 JSON 和 YAML）
      const config = this.parseConfig(content);

      // 验证配置
      const validation = this.validate(config);
      if (!validation.valid) {
        throw new Error(`Config validation failed: ${validation.errors.join(', ')}`);
      }

      // 解密敏感信息
      await this.decryptSecrets(config);

      this.config = config;
      return config;
    } catch (error: any) {
      throw new Error(`Failed to load config: ${error.message}`);
    }
  }

  /**
   * 保存配置
   */
  async save(config: SkillsToolsConfig): Promise<void> {
    try {
      // 加密敏感信息
      const encrypted = await this.encryptSecrets(config);

      // 序列化配置
      const content = JSON.stringify(encrypted, null, 2);

      // 确保目录存在
      const dir = path.dirname(this.configPath);
      await fs.mkdir(dir, { recursive: true });

      // 写入文件
      await fs.writeFile(this.configPath, content, 'utf-8');

      this.config = config;
    } catch (error: any) {
      throw new Error(`Failed to save config: ${error.message}`);
    }
  }

  /**
   * 获取当前配置
   */
  getConfig(): SkillsToolsConfig | null {
    return this.config;
  }

  /**
   * 更新配置
   */
  async updateConfig(updates: Partial<SkillsToolsConfig>): Promise<void> {
    if (!this.config) {
      await this.load();
    }

    const newConfig = {
      ...this.config,
      ...updates,
    };

    await this.save(newConfig);
  }

  /**
   * 添加 Skill 配置
   */
  async addSkill(
    skill: SkillDefinition,
    scope: ResourceScope,
    agentId?: string
  ): Promise<void> {
    if (!this.config) {
      await this.load();
    }

    if (!this.config!.skills) {
      this.config!.skills = {};
    }

    if (scope === 'global') {
      if (!this.config!.skills.global) {
        this.config!.skills.global = [];
      }
      this.config!.skills.global.push(skill);
    } else {
      if (!this.config!.skills.private) {
        this.config!.skills.private = {};
      }
      if (!agentId) {
        throw new Error('agentId is required for private scope');
      }
      if (!this.config!.skills.private[agentId]) {
        this.config!.skills.private[agentId] = [];
      }
      this.config!.skills.private[agentId].push(skill);
    }

    await this.save(this.config!);
  }

  /**
   * 添加 Tool 配置
   */
  async addTool(
    tool: ToolDefinition,
    scope: ResourceScope,
    agentId?: string
  ): Promise<void> {
    if (!this.config) {
      await this.load();
    }

    if (!this.config!.tools) {
      this.config!.tools = {};
    }

    if (scope === 'global') {
      if (!this.config!.tools.global) {
        this.config!.tools.global = [];
      }
      this.config!.tools.global.push(tool);
    } else {
      if (!this.config!.tools.private) {
        this.config!.tools.private = {};
      }
      if (!agentId) {
        throw new Error('agentId is required for private scope');
      }
      if (!this.config!.tools.private[agentId]) {
        this.config!.tools.private[agentId] = [];
      }
      this.config!.tools.private[agentId].push(tool);
    }

    await this.save(this.config!);
  }

  /**
   * 解析配置
   */
  private parseConfig(content: string): SkillsToolsConfig {
    // 简单 JSON 解析（可以扩展支持 YAML）
    return JSON.parse(content);
  }

  /**
   * 验证配置
   */
  private validate(config: SkillsToolsConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 验证 Skills
    if (config.skills?.global) {
      for (const skill of config.skills.global) {
        if (!skill.meta?.id) {
          errors.push('Global skill missing id');
        }
      }
    }

    if (config.skills?.private) {
      for (const [agentId, skills] of Object.entries(config.skills.private)) {
        for (const skill of skills) {
          if (!skill.meta?.id) {
            errors.push(`Private skill for agent ${agentId} missing id`);
          }
        }
      }
    }

    // 验证 Tools
    if (config.tools?.global) {
      for (const tool of config.tools.global) {
        if (!tool.meta?.id) {
          errors.push('Global tool missing id');
        }
      }
    }

    if (config.tools?.private) {
      for (const [agentId, tools] of Object.entries(config.tools.private)) {
        for (const tool of tools) {
          if (!tool.meta?.id) {
            errors.push(`Private tool for agent ${agentId} missing id`);
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * 解密敏感信息
   */
  private async decryptSecrets(config: SkillsToolsConfig): Promise<void> {
    // 这里可以实现解密逻辑
    // 暂时不做处理
  }

  /**
   * 加密敏感信息
   */
  private async encryptSecrets(config: SkillsToolsConfig): Promise<SkillsToolsConfig> {
    // 这里可以实现加密逻辑
    // 暂时不做处理
    return config;
  }

  /**
   * 获取默认配置
   */
  private getDefaultConfig(): SkillsToolsConfig {
    return {
      skills: {
        global: [],
        private: {},
      },
      tools: {
        global: [],
        private: {},
      },
      mcp: {
        servers: [],
      },
    };
  }

  /**
   * 检查文件是否存在
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * 从配置加载 Skills 和 Tools
 */
export async function loadFromConfig(
  configManager: ConfigManager,
  skillRegistry: any,
  toolRegistry: any
): Promise<void> {
  const config = await configManager.load();

  // 加载全局 Skills
  if (config.skills?.global) {
    for (const skill of config.skills.global) {
      await skillRegistry.register(skill, 'global');
    }
  }

  // 加载私有 Skills
  if (config.skills?.private) {
    for (const [agentId, skills] of Object.entries(config.skills.private)) {
      for (const skill of skills) {
        await skillRegistry.register(skill, 'private', agentId);
      }
    }
  }

  // 加载全局 Tools
  if (config.tools?.global) {
    for (const tool of config.tools.global) {
      await toolRegistry.register(tool, 'global');
    }
  }

  // 加载私有 Tools
  if (config.tools?.private) {
    for (const [agentId, tools] of Object.entries(config.tools.private)) {
      for (const tool of tools) {
        await toolRegistry.register(tool, 'private', agentId);
      }
    }
  }
}
