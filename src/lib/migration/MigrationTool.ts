/**
 * 数据迁移工具：localStorage -> SQLite
 */

import { getDb } from '@/lib/db/database';
import { AgentRepository } from '@/lib/db/agentRepo';
import { TaskRepository } from '@/lib/db/taskRepo';
import { ChatRepository } from '@/lib/db/chatRepo';
import { MessageRepository } from '@/lib/db/messageRepo';
import type { Agent, Task, Chat, Message, Project } from '@/types';

const STORAGE_KEY = 'agentworks-store';

/** localStorage 数据结构 */
interface LocalStorageData {
  agents?: Record<string, Agent>;
  projects?: Project[];
  chats?: Record<string, Chat>;
  messages?: Record<string, Message[]>;
  tasks?: Record<string, Task>;
  // 其他字段暂不迁移
}

/** 迁移结果 */
export interface MigrationResult {
  success: boolean;
  migrated: {
    agents: number;
    projects: number;
    chats: number;
    messages: number;
    tasks: number;
  };
  errors: string[];
}

/** 迁移状态 */
export interface MigrationStatus {
  hasLocalData: boolean;
  lastCheck: number;
  migrated?: MigrationResult;
}

/** MigrationTool 接口 */
export interface IMigrationTool {
  checkLocalStorage(): LocalStorageData | null;
  migrate(data: LocalStorageData): MigrationResult;
  verify(): boolean;
  cleanup(): void;
  rollback(): void;
}

export class MigrationTool implements IMigrationTool {
  private agentRepo: AgentRepository;
  private taskRepo: TaskRepository;
  private chatRepo: ChatRepository;
  private messageRepo: MessageRepository;

  constructor() {
    const db = getDb();
    this.agentRepo = new AgentRepository(db);
    this.taskRepo = new TaskRepository(db);
    this.chatRepo = new ChatRepository(db);
    this.messageRepo = new MessageRepository(db);
  }

  /**
   * 检查 localStorage 数据
   */
  checkLocalStorage(): LocalStorageData | null {
    try {
      if (typeof window === 'undefined') return null;
      
      const str = localStorage.getItem(STORAGE_KEY);
      if (!str) return null;

      const data = JSON.parse(str);
      
      // 检查是否有实际数据
      const hasData = 
        (data.agents && Object.keys(data.agents).length > 0) ||
        (data.projects && data.projects.length > 0) ||
        (data.chats && Object.keys(data.chats).length > 0) ||
        (data.messages && Object.keys(data.messages).length > 0) ||
        (data.tasks && Object.keys(data.tasks).length > 0);

      return hasData ? data : null;
    } catch (error) {
      console.error('检查 localStorage 失败:', error);
      return null;
    }
  }

  /**
   * 迁移数据到 SQLite
   */
  migrate(data: LocalStorageData): MigrationResult {
    const result: MigrationResult = {
      success: false,
      migrated: {
        agents: 0,
        projects: 0,
        chats: 0,
        messages: 0,
        tasks: 0,
      },
      errors: [],
    };

    const db = getDb();
    
    try {
      // 使用事务确保原子性
      const migrateAll = db.transaction(() => {
        // 1. 迁移 Agents
        if (data.agents) {
          for (const agent of Object.values(data.agents)) {
            try {
              this.agentRepo.create(agent);
              result.migrated.agents++;
            } catch (error) {
              result.errors.push(`Agent ${agent.id}: ${error}`);
            }
          }
        }

        // 2. 迁移 Projects
        if (data.projects) {
          const projectStmt = db.prepare(`
            INSERT INTO projects (project_id, name, created_at)
            VALUES (@id, @name, @createdAt)
          `);
          for (const project of data.projects) {
            try {
              projectStmt.run(project);
              result.migrated.projects++;
            } catch (error) {
              result.errors.push(`Project ${project.id}: ${error}`);
            }
          }
        }

        // 3. 迁移 Chats
        if (data.chats) {
          for (const chat of Object.values(data.chats)) {
            try {
              this.chatRepo.create(chat);
              result.migrated.chats++;
            } catch (error) {
              result.errors.push(`Chat ${chat.id}: ${error}`);
            }
          }
        }

        // 4. 迁移 Messages
        if (data.messages) {
          for (const messages of Object.values(data.messages)) {
            for (const message of messages) {
              try {
                this.messageRepo.create(message);
                result.migrated.messages++;
              } catch (error) {
                result.errors.push(`Message ${message.id}: ${error}`);
              }
            }
          }
        }

        // 5. 迁移 Tasks
        if (data.tasks) {
          for (const task of Object.values(data.tasks)) {
            try {
              this.taskRepo.create(task);
              result.migrated.tasks++;
            } catch (error) {
              result.errors.push(`Task ${task.id}: ${error}`);
            }
          }
        }
      });

      migrateAll();
      result.success = result.errors.length === 0;
    } catch (error) {
      result.errors.push(`迁移失败: ${error}`);
    }

    return result;
  }

  /**
   * 验证迁移数据完整性
   */
  verify(): boolean {
    try {
      const localData = this.checkLocalStorage();
      if (!localData) return true; // 无本地数据，验证通过

      const db = getDb();

      // 验证 Agents 数量
      if (localData.agents) {
        const localCount = Object.keys(localData.agents).length;
        const dbCount = db.prepare('SELECT COUNT(*) as count FROM agents').get() as { count: number };
        if (dbCount.count !== localCount) return false;
      }

      // 验证 Tasks 数量
      if (localData.tasks) {
        const localCount = Object.keys(localData.tasks).length;
        const dbCount = db.prepare('SELECT COUNT(*) as count FROM tasks').get() as { count: number };
        if (dbCount.count !== localCount) return false;
      }

      // 验证 Chats 数量
      if (localData.chats) {
        const localCount = Object.keys(localData.chats).length;
        const dbCount = db.prepare('SELECT COUNT(*) as count FROM conversations').get() as { count: number };
        if (dbCount.count !== localCount) return false;
      }

      return true;
    } catch (error) {
      console.error('验证失败:', error);
      return false;
    }
  }

  /**
   * 清空 localStorage
   */
  cleanup(): void {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(STORAGE_KEY);
        console.log('localStorage 已清空');
      }
    } catch (error) {
      console.error('清空 localStorage 失败:', error);
    }
  }

  /**
   * 回滚：从 SQLite 导出回 localStorage
   */
  rollback(): void {
    try {
      const agents = this.agentRepo.findAll();
      const tasks = this.taskRepo.findAll();
      const chats = this.chatRepo.findAll();

      // 构建消息映射
      const messages: Record<string, any[]> = {};
      for (const chat of chats) {
        messages[chat.id] = this.messageRepo.findByChat(chat.id);
      }

      // 构建 localStorage 数据
      const data: any = {
        agents: agents.reduce((acc, agent) => {
          acc[agent.id] = agent;
          return acc;
        }, {} as any),
        tasks: tasks.reduce((acc, task) => {
          acc[task.id] = task;
          return acc;
        }, {} as any),
        chats: chats.reduce((acc, chat) => {
          acc[chat.id] = chat;
          return acc;
        }, {} as any),
        messages,
      };

      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        console.log('已回滚到 localStorage');
      }
    } catch (error) {
      console.error('回滚失败:', error);
    }
  }
}
