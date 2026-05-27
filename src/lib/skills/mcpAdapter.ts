/**
 * MCP 适配器实现
 * 实现 MCP 协议通信
 */

import type {
  MCPConfig,
  MCPToolInfo,
  MCPResourceInfo,
  JSONSchema,
  IMCPAdapter,
} from '@/types';

/**
 * MCP 连接类
 */
class MCPConnection {
  private endpoint: string;
  private authType?: string;
  private authConfig?: any;
  private timeout: number;
  private connected: boolean = false;

  constructor(config: MCPConfig) {
    this.endpoint = config.endpoint;
    this.authType = config.authType;
    this.authConfig = config.authConfig;
    this.timeout = config.timeout || 30000;
  }

  /**
   * 建立连接
   */
  async connect(): Promise<void> {
    // 这里应该实现实际的连接逻辑
    // 例如 WebSocket 或 HTTP 连接
    // 暂时模拟连接成功
    this.connected = true;
  }

  /**
   * 断开连接
   */
  async disconnect(): Promise<void> {
    this.connected = false;
  }

  /**
   * 发送请求
   */
  async sendRequest(method: string, params?: any): Promise<any> {
    if (!this.connected) {
      throw new Error('Not connected to MCP server');
    }

    // 构建请求头
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // 添加认证信息
    if (this.authType === 'bearer' && this.authConfig?.token) {
      headers['Authorization'] = `Bearer ${this.authConfig.token}`;
    } else if (this.authType === 'basic' && this.authConfig?.username && this.authConfig?.password) {
      const credentials = Buffer.from(
        `${this.authConfig.username}:${this.authConfig.password}`
      ).toString('base64');
      headers['Authorization'] = `Basic ${credentials}`;
    }

    // 发送 HTTP 请求
    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          jsonrpc: '2.0',
          method,
          params,
          id: Date.now(),
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();

      if (result.error) {
        throw new Error(result.error.message || 'MCP request failed');
      }

      return result.result;
    } catch (error: any) {
      throw new Error(`MCP request failed: ${error.message}`);
    }
  }

  /**
   * 检查连接状态
   */
  isConnected(): boolean {
    return this.connected;
  }
}

/**
 * MCP 适配器
 */
export class MCPAdapter implements IMCPAdapter {
  private connection: MCPConnection | null = null;
  private connectionPool: Map<string, MCPConnection> = new Map();
  private retryConfig: { maxRetries: number; retryDelay: number };

  constructor() {
    this.retryConfig = {
      maxRetries: 3,
      retryDelay: 1000,
    };
  }

  /**
   * 连接到 MCP 服务器
   */
  async connect(config: MCPConfig): Promise<void> {
    // 检查是否已连接
    if (this.connectionPool.has(config.endpoint)) {
      const existingConnection = this.connectionPool.get(config.endpoint)!;
      if (existingConnection.isConnected()) {
        this.connection = existingConnection;
        return;
      }
    }

    // 创建新连接
    const connection = new MCPConnection(config);

    // 设置重试
    let retries = 0;
    while (retries < (config.retryConfig?.maxRetries || this.retryConfig.maxRetries)) {
      try {
        await connection.connect();
        this.connection = connection;
        this.connectionPool.set(config.endpoint, connection);
        return;
      } catch (error: any) {
        retries++;
        if (retries >= (config.retryConfig?.maxRetries || this.retryConfig.maxRetries)) {
          throw new Error(`Failed to connect to MCP server after ${retries} retries: ${error.message}`);
        }

        // 指数退避
        const delay = (config.retryConfig?.retryDelay || this.retryConfig.retryDelay) * Math.pow(2, retries - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * 断开连接
   */
  async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.disconnect();
      this.connection = null;
    }
  }

  /**
   * 列出可用工具
   */
  async listTools(): Promise<MCPToolInfo[]> {
    if (!this.connection) {
      throw new Error('Not connected to MCP server');
    }

    try {
      const result = await this.connection.sendRequest('tools/list');

      return (result.tools || []).map((tool: any) => ({
        name: tool.name,
        description: tool.description || '',
        inputSchema: tool.inputSchema || { type: 'object' },
      }));
    } catch (error: any) {
      throw new Error(`Failed to list tools: ${error.message}`);
    }
  }

  /**
   * 调用工具
   */
  async callTool(toolName: string, params: Record<string, any>): Promise<any> {
    if (!this.connection) {
      throw new Error('Not connected to MCP server');
    }

    try {
      const result = await this.connection.sendRequest('tools/call', {
        name: toolName,
        arguments: params,
      });

      return result;
    } catch (error: any) {
      throw new Error(`Failed to call tool ${toolName}: ${error.message}`);
    }
  }

  /**
   * 列出可用资源
   */
  async listResources(): Promise<MCPResourceInfo[]> {
    if (!this.connection) {
      throw new Error('Not connected to MCP server');
    }

    try {
      const result = await this.connection.sendRequest('resources/list');

      return (result.resources || []).map((resource: any) => ({
        uri: resource.uri,
        name: resource.name,
        description: resource.description,
      }));
    } catch (error: any) {
      throw new Error(`Failed to list resources: ${error.message}`);
    }
  }

  /**
   * 读取资源
   */
  async readResource(uri: string): Promise<any> {
    if (!this.connection) {
      throw new Error('Not connected to MCP server');
    }

    try {
      const result = await this.connection.sendRequest('resources/read', {
        uri,
      });

      return result;
    } catch (error: any) {
      throw new Error(`Failed to read resource ${uri}: ${error.message}`);
    }
  }

  /**
   * 检查连接状态
   */
  isConnected(): boolean {
    return this.connection?.isConnected() || false;
  }

  /**
   * 获取连接池大小
   */
  getConnectionPoolSize(): number {
    return this.connectionPool.size;
  }

  /**
   * 清理连接池
   */
  async clearConnectionPool(): Promise<void> {
    for (const connection of this.connectionPool.values()) {
      await connection.disconnect();
    }
    this.connectionPool.clear();
    this.connection = null;
  }
}
