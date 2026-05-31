/**
 * Workflow API Route - Agent 执行的 API 端点
 *
 * 将 WorkflowEngine 的调用隔离在服务端，
 * 客户端通过 fetch 调用，避免 better-sqlite3 进入客户端 bundle。
 */

import { NextRequest, NextResponse } from 'next/server';
import { WorkflowEngine } from '@/lib/workflow/WorkflowEngine';

const workflowEngine = new WorkflowEngine();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, params } = body;

    switch (action) {
      case 'executeAgent': {
        const { agentId, message, chatId } = params;
        await workflowEngine.executeAgent(agentId, message, chatId);
        return NextResponse.json({ success: true });
      }

      case 'assignTask': {
        const { taskTitle, taskDescription, assigneeId, chatId, priority, deadline } = params;
        const result = await workflowEngine.assignTask(
          taskTitle, taskDescription, assigneeId, chatId, priority, deadline
        );
        return NextResponse.json({ success: true, data: result });
      }

      case 'runScript': {
        const { scriptId, chatId, replacements } = params;
        await workflowEngine.runScript(scriptId, chatId, replacements);
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error('[Workflow API] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal error' },
      { status: 500 }
    );
  }
}
