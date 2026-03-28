import type { BaseProvider, ProviderResult } from './common.js';

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  output: unknown;
  error?: string;
}

export interface AgentMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: ToolCall[];
  toolResult?: ToolResult;
  timestamp?: string;
}

export interface AgentUsage {
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
}

export interface AgentResponse {
  message: AgentMessage;
  toolCalls?: ToolCall[];
  finished: boolean;
  usage?: AgentUsage;
}

export interface AgentSessionOptions {
  sessionId: string;
  systemPrompt?: string;
  allowedTools?: string[];
  context?: Record<string, unknown>;
  temperature?: number;
}

export interface AgentEngine extends BaseProvider {
  createSession(options: AgentSessionOptions): Promise<ProviderResult<string>>;
  chat(sessionId: string, message: AgentMessage): Promise<ProviderResult<AgentResponse>>;
  submitToolResult(sessionId: string, result: ToolResult): Promise<ProviderResult<AgentMessage>>;
  destroySession(sessionId: string): Promise<ProviderResult<void>>;
}
