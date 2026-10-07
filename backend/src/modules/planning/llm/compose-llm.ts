// LLM 驱动的方案合成：从 intent + candidates 调 DashScope，返回 SleepPlan。
// 该模块是规则引擎 (`rule-engine.ts`) 的可替换等价物；二者产出的 PlanTrack 形态一致。
//
// 设计原则：
// - LLM 只负责"选内容 + 写理由"。最终的 tracks 字段类型、durationSec、loopMode 由本模块决定。
// - LLM 输出经 schema 校验，不合规直接抛 `LlmUnavailableError` → service.ts 的 fallback 链会切到规则引擎。

import { randomUUID } from 'node:crypto';
import { completeChat, extractContent, loadDashScopeConfig, type ChatCompletionResponse, type DashScopeConfig } from './client.ts';
import { buildUserMessage, parsePlanResponse, type IntentForPrompt, type LlmPlanResponse } from './prompt.ts';
import { PlanningError, type AgeMode, type ContentCandidate, type PlanTrack, type SleepPlan, type StructuredIntent } from '../types.ts';

export interface ComposeLlmArgs {
  userId: string;
  ageMode: AgeMode;
  intent: StructuredIntent;
  candidates: ContentCandidate[];
  /** 用户原始自然语言输入（如有），LLM 用来补全规则引擎未识别的意图。 */
  freeText?: string | null | undefined;
  /** 可选注入：测试或生产覆盖配置（如 mock client）。 */
  config?: DashScopeConfig;
  /** 可选注入：单元测试可以替换 fetch 调用。 */
  completeFn?: (config: DashScopeConfig, body: any) => Promise<ChatCompletionResponse>;
  /** 可选注入：当前时间，便于测试稳定。 */
  now?: string;
}

/** LLM 调用/解析失败时抛出，service.ts 据此降级到规则引擎。 */
export class LlmUnavailableError extends Error {
  constructor(message: string, readonly cause?: unknown) { super(message); }
}

export function isLlmAvailable(env: NodeJS.ProcessEnv = process.env): boolean {
  return loadDashScopeConfig(env) !== null;
}

const SYSTEM_PROMPT = `你是"眠屿"助眠 App 的方案策划师。
你的任务：根据用户意图和可用素材清单，挑选 1～3 条素材组成今晚的睡前方案，并写一段 1～2 句、温和、面向用户的方案理由（中文）。

## 规则（务必遵守）

1. 必须只从"可用素材清单"中挑选，不能凭空生成 contentId。
2. 必须遵守用户的 avoidTags：选中的素材 tags 不能包含 avoidTags 中的任何标签（大小写不敏感）。
3. 必须遵守 voicePreference：
   - 'avoid'：不要故事、不要有 voice 的内容；只能选 audio。
   - 'wanted'：可以选 1 条 story（hasVoice=true），其余选 audio。
   - 'either'：自由搭配。
4. 必须遵守 ageMode：
   - 'child'（儿童模式）：不要选成人专属内容（hasVoice=true 且 ageMode='adult' 的故事）；不要选 childRestricted=true 的素材。
   - 'adult'：不限制。
5. 必须遵守用户显式选中的 selectedContentIds：用户明确选择的素材必须出现在 tracks 中（如果合规）。
6. tracks 数量：1～3 条。durationSec 是总时长（秒），audio 素材循环播放不算时长。
7. story 选择：如果选了 story，整段播放完即结束，不要把 story 重复算进 durationSec；其余 audio 用作背景。
8. volume：audio 取 0.3～0.5，breath 取 0.5～0.6，story 取 0.6～0.7。
9. reason：用第二人称写（"你..."），1～2 句话，不超过 60 字。不要提及规则或 LLM。

## 输出格式（严格 JSON，不要任何额外文字）

{
  "reason": "<温和的 1～2 句中文解释>",
  "tracks": [
    { "contentId": "A01", "volume": 0.4 }
  ]
}

仅返回 JSON，不要 markdown 代码块包裹。`;

export async function composeLlmPlan(args: ComposeLlmArgs): Promise<SleepPlan> {
  const config = args.config ?? loadDashScopeConfig();
  if (!config) throw new LlmUnavailableError('DASHSCOPE_API_KEY not configured');
  const complete = args.completeFn ?? ((cfg, body) => completeChat(cfg, body));

  const messages = [
    { role: 'system' as const, content: SYSTEM_PROMPT },
    { role: 'user' as const, content: buildUserMessage(args.ageMode, buildIntentPayload(args.intent, args.freeText), args.candidates) },
  ];

  let response: ChatCompletionResponse;
  try {
    response = await complete(config, {
      messages, max_tokens: 800, temperature: 0.4, response_format: { type: 'json_object' },
    });
  } catch (error) {
    throw new LlmUnavailableError(`LLM call failed: ${(error as Error).message}`, error);
  }

  const content = extractContent(response);
  let parsed: LlmPlanResponse;
  try {
    parsed = parsePlanResponse(content);
  } catch (error) {
    throw new LlmUnavailableError(`LLM response parse failed: ${(error as Error).message}`);
  }

  return assemblePlan(args, parsed, args.now);
}

function buildIntentPayload(intent: StructuredIntent, freeText?: string | null): IntentForPrompt {
  return {
    mood: intent.mood,
    voicePreference: intent.voicePreference,
    avoidTags: intent.avoidTags,
    durationSec: intent.durationSec,
    selectedContentIds: intent.selectedContentIds,
    freeText: freeText ?? null,
  };
}

function assemblePlan(args: ComposeLlmArgs, parsed: LlmPlanResponse, now?: string): SleepPlan {
  const candidateById = new Map(args.candidates.map((item) => [item.contentId, item]));
  const avoidSet = new Set(args.intent.avoidTags.map((tag) => tag.toLowerCase()));

  // 校验 LLM 输出的每条 track
  const validated: Array<{ contentId: string; volume: number; candidate: ContentCandidate }> = [];
  for (const track of parsed.tracks) {
    const candidate = candidateById.get(track.contentId);
    if (!candidate) throw new LlmUnavailableError(`LLM picked unknown contentId: ${track.contentId}`);
    if (!candidate.enabled) throw new LlmUnavailableError(`LLM picked disabled content ${track.contentId}`);
    if (args.ageMode === 'child' && candidate.ageMode === 'adult' && candidate.contentKind === 'story') {
      throw new LlmUnavailableError(`LLM picked adult story ${track.contentId} for child mode`);
    }
    if (args.intent.voicePreference === 'avoid' && (candidate.hasVoice || candidate.contentKind === 'story')) {
      throw new LlmUnavailableError(`LLM picked voice/story ${track.contentId} while user wants avoid`);
    }
    if (candidate.tags.some((tag) => avoidSet.has(tag.toLowerCase()))) {
      throw new LlmUnavailableError(`LLM picked forbidden-tag content ${track.contentId}`);
    }
    if (track.volume < 0 || track.volume > 1) {
      throw new LlmUnavailableError(`LLM returned invalid volume ${track.volume} for ${track.contentId}`);
    }
    validated.push({ contentId: track.contentId, volume: track.volume, candidate });
  }
  if (validated.length === 0) throw new LlmUnavailableError('LLM returned empty tracks');

  // 用户显式选中的素材必须出现
  for (const sid of args.intent.selectedContentIds) {
    if (!validated.find((track) => track.contentId === sid)) {
      throw new LlmUnavailableError(`LLM dropped user-selected content ${sid}`);
    }
  }

  // 装配 tracks
  const tracks: PlanTrack[] = validated.map((track, index) => ({
    trackId: randomUUID(),
    contentId: track.contentId,
    contentKind: track.candidate.contentKind,
    startOffsetSec: 0,
    volume: track.volume,
    loopMode: track.candidate.contentKind === 'audio' ? 'loop' : 'once',
    sequenceNo: index + 1,
  }));

  const hasStory = tracks.some((t) => t.contentKind === 'story');
  const hasBreath = tracks.some((t) => t.contentKind === 'breath');
  const planType = hasStory && tracks.length > 1 ? 'mix' : hasStory ? 'story' : hasBreath && tracks.length > 1 ? 'mix' : hasBreath ? 'breath' : 'soundscape';

  return {
    planId: randomUUID(),
    userId: args.userId,
    inputMode: args.intent.inputMode,
    mood: args.intent.mood,
    voicePreference: args.intent.voicePreference,
    avoidTags: args.intent.avoidTags,
    selectedContentIds: args.intent.selectedContentIds,
    status: 'draft',
    planType,
    durationSec: args.intent.durationSec,
    fadeOutSec: Math.min(300, args.intent.durationSec),
    reason: parsed.reason,
    source: 'llm',
    sourceLabel: '模型建议',
    tracks,
    createdAt: now ?? new Date().toISOString(),
    confirmedAt: null,
    startedSessionId: null,
  };
}