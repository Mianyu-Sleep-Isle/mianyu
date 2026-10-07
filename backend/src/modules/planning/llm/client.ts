// Minimal DashScope (OpenAI-compatible) HTTP client.
// 后端不依赖 npm 'openai' 包，直接用 Node 22+ 内置 fetch + AbortController 即可。
// 接口简洁：本目录只导出 `completeChat`，够 planning 模块用。

export interface DashScopeConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  timeoutMs: number;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionRequest {
  model?: string;
  messages: ChatMessage[];
  max_tokens?: number;
  temperature?: number;
  // OpenAI 兼容模式支持 response_format 让模型返回 JSON
  response_format?: { type: 'json_object' | 'text' };
}

export interface ChatCompletionResponse {
  id?: string;
  model?: string;
  choices: Array<{ message: { role: 'assistant'; content: string }; finish_reason?: string }>;
  usage?: { total_tokens: number; prompt_tokens: number; completion_tokens: number };
}

export class DashScopeError extends Error {
  constructor(message: string, readonly status: number, readonly body?: string) {
    super(message);
  }
}

export function loadDashScopeConfig(env: NodeJS.ProcessEnv = process.env): DashScopeConfig | null {
  const apiKey = env.DASHSCOPE_API_KEY?.trim();
  if (!apiKey) return null;
  return {
    apiKey,
    baseUrl: env.DASHSCOPE_BASE_URL?.trim() || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: env.DASHSCOPE_MODEL?.trim() || 'qwen-plus',
    timeoutMs: Number(env.LLM_TIMEOUT_MS?.trim() || '8000'),
  };
}

export async function completeChat(config: DashScopeConfig, request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
  const url = `${config.baseUrl.replace(/\/$/, '')}/chat/completions`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: request.model ?? config.model, ...request, messages: request.messages }),
      signal: controller.signal,
    });
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      throw new DashScopeError(`LLM request exceeded ${config.timeoutMs}ms`, 504);
    }
    throw new DashScopeError(`LLM network error: ${(error as Error).message}`, 502);
  } finally {
    clearTimeout(timer);
  }
  const text = await response.text();
  if (!response.ok) {
    throw new DashScopeError(`LLM request failed: ${response.status} ${response.statusText}`, response.status, text.slice(0, 500));
  }
  try {
    return JSON.parse(text) as ChatCompletionResponse;
  } catch (error) {
    throw new DashScopeError(`LLM response is not JSON: ${(error as Error).message}`, 502, text.slice(0, 500));
  }
}

// 提取模型回复内容，response.choices[0].message.content 已经是字符串。
export function extractContent(response: ChatCompletionResponse): string {
  const choice = response.choices?.[0];
  if (!choice) throw new DashScopeError('LLM returned no choices', 502);
  return choice.message.content ?? '';
}