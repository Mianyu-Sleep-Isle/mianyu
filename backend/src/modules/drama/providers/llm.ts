import { ProviderError } from './types.ts';

export interface LlmConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  fetchImpl?: typeof fetch;
}

interface ChatResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

function endpoint(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, '')}/chat/completions`;
}

export function stripFence(text: string): string {
  const trimmed = text.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  return fenced?.[1]?.trim() ?? trimmed;
}

export async function completeStructured(config: LlmConfig, input: {
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
  schemaName: string;
  schema: Record<string, unknown>;
  messages: Array<{ role: string; content: string }>;
}): Promise<unknown> {
  const first = await requestModel(config, input, true);
  const parsed = tryParse(first);
  if (parsed !== undefined) return parsed;
  const repaired = await requestModel(config, {
    ...input,
    temperature: 0,
    messages: [
      { role: 'system', content: '把下面文本修复成合法 JSON，不要添加字段。' },
      { role: 'user', content: first.slice(0, 4000) },
    ],
    schemaName: 'repair',
    schema: { type: 'object' },
  }, false);
  const repairedParsed = tryParse(repaired);
  if (repairedParsed !== undefined) return repairedParsed;
  const again = await requestModel(config, input, true);
  const againParsed = tryParse(again);
  if (againParsed !== undefined) return againParsed;
  throw new ProviderError('MODEL_OUTPUT_INVALID', 'AI 输出格式异常');
}

function tryParse(text: string): unknown | undefined {
  try {
    return JSON.parse(stripFence(text)) as unknown;
  } catch {
    return undefined;
  }
}

async function requestModel(config: LlmConfig, input: {
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
  schemaName: string;
  schema: Record<string, unknown>;
  messages: Array<{ role: string; content: string }>;
}, structured: boolean): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.timeoutMs);
  const body: Record<string, unknown> = {
    model: config.model,
    temperature: input.temperature,
    max_tokens: input.maxTokens,
    chat_template_kwargs: { enable_thinking: false },
    messages: input.messages,
  };
  if (structured) {
    body.response_format = { type: 'json_schema', json_schema: { name: input.schemaName, strict: true, schema: input.schema } };
  } else {
    body.response_format = { type: 'json_object' };
  }
  try {
    const fetchImpl = config.fetchImpl ?? fetch;
    let response = await fetchImpl(endpoint(config.baseUrl), {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (response.status === 400) {
      const failure = await response.text();
      if (/response_format|chat_template_kwargs/.test(failure)) {
        delete body.response_format;
        delete body.chat_template_kwargs;
        response = await fetchImpl(endpoint(config.baseUrl), {
          method: 'POST',
          headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
      } else {
        throw new ProviderError('LLM_UNAVAILABLE', '语言模型暂时不可用');
      }
    }
    if (!response.ok) throw new ProviderError('LLM_UNAVAILABLE', '语言模型暂时不可用');
    const payload = await response.json() as ChatResponse;
    const content = payload.choices?.[0]?.message?.content ?? '';
    if (!content.trim()) throw new ProviderError('MODEL_OUTPUT_INVALID', 'AI 输出格式异常');
    return content;
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    if ((error as Error).name === 'AbortError') throw new ProviderError('LLM_UNAVAILABLE', '语言模型暂时不可用');
    throw new ProviderError('LLM_UNAVAILABLE', '语言模型暂时不可用');
  } finally {
    clearTimeout(timer);
  }
}

export function resolveLlmAvailability(input: { mode: 'fake' | 'real'; gpuBusy: boolean; textBusy: boolean; healthOk: boolean }): 'ready' | 'busy' | 'down' {
  if (input.mode === 'fake') return 'ready';
  if (input.gpuBusy || input.textBusy) return 'busy';
  return input.healthOk ? 'ready' : 'down';
}
