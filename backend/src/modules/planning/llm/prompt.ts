// Prompt builder for LLM 方案合成。
// LLM 需要两份信息：
//   1. 可用素材清单（contentId / kind / tags / hasVoice / durationSec）
//   2. 用户意图（inputMode + 各字段 + freeText）
//   3. ageMode（成人/儿童）
// 输出结构化 JSON tracks，调用方负责落库。

import type { AgeMode, ContentCandidate } from '../types.ts';

export interface IntentForPrompt {
  mood: 'calm' | 'annoyed' | 'tired';
  voicePreference: 'wanted' | 'either' | 'avoid';
  avoidTags: string[];
  durationSec: number;
  selectedContentIds: string[];
  freeText?: string | null;
}

export interface LlmPlanResponse {
  reason: string;
  tracks: Array<{ contentId: string; volume: number }>;
  // 可选：LLM 可选择重新声明意图，但通常不需要
  parsedIntent?: {
    mood: IntentForPrompt['mood'];
    voicePreference: IntentForPrompt['voicePreference'];
    avoidTags: string[];
    selectedContentIds: string[];
  };
}

const SYSTEM_PROMPT = `你是"眠屿"助眠 App 的方案策划师。
你的任务：根据用户意图和可用素材清单，挑选 1～3 条素材组成今晚的睡前方案，并写一段 1～2 句、温和、面向用户的方案理由（中文）。

## 规则（务必遵守）

1. **必须**只从"可用素材清单"中挑选，不能凭空生成 contentId。
2. **必须**遵守用户的 avoidTags：
   - 选中的素材 tags 不能包含 avoidTags 中的任何标签（大小写不敏感）。
3. **必须**遵守 voicePreference：
   - 'avoid'：不要故事、不要有 voice 的内容；只能选 audio。
   - 'wanted'：可以选 1 条 story（hasVoice=true），其余选 audio。
   - 'either'：自由搭配。
4. **必须**遵守 ageMode：
   - 'child'（儿童模式）：不要选成人专属内容（hasVoice=true 且 ageMode='adult' 的故事）；不要选 childRestricted=true 的素材。
   - 'adult'：不限制。
5. **必须**遵守用户显式选中的 selectedContentIds：
   - 用户明确选择的素材必须出现在 tracks 中（如果合规）。
6. **用户原始自然语言**（freeText 字段）：
   - 即使该字段为空（null），也不要紧，按已结构化字段处理。
   - 如有内容，请用语义理解情绪/声音偏好/avoid 标签（如"想听海浪声"应理解成想要 A06 水流；"一个人有点闷"可推断 mood=annoyed、voicePreference=wanted）。
   - 不在 freeText 中出现"自杀"、"伤害自己"等危机词（如有请返回空 tracks 并在 reason 中温和建议联系可信任的人）。
6. **tracks 数量**：1～3 条。durationSec 是总时长（秒），audio 素材循环播放不算时长。
7. **story 选择**：如果选了 story，整段播放完即结束，不要把 story 重复算进 durationSec；其余 audio 用作背景。
8. **volume**：audio 取 0.3～0.5，breath 取 0.5～0.6，story 取 0.6～0.7。
9. **reason**：用第二人称写（"你..."），1～2 句话，不超过 60 字。不要提及规则或 LLM。

## 输出格式（严格 JSON，不要任何额外文字）

{
  "reason": "<温和的 1～2 句中文解释>",
  "tracks": [
    { "contentId": "A01", "volume": 0.4 }
  ]
}

仅返回 JSON，不要 markdown 代码块包裹。`;

export function buildUserMessage(ageMode: AgeMode, intent: IntentForPrompt, candidates: ContentCandidate[]): string {
  const candidateLines = candidates.map((item) => {
    const tags = item.tags.join(',');
    const voice = item.hasVoice ? 'has-voice' : 'silent';
    // durationSec 来自上游 ContentEntry（catalog.listCandidates 会附带），ContentCandidate 类型未声明但运行时存在
    const dur = (item as unknown as { durationSec?: number | null }).durationSec !== null && (item as unknown as { durationSec?: number | null }).durationSec !== undefined
      ? `${(item as unknown as { durationSec: number }).durationSec}s`
      : 'loop';
    const age = item.ageMode;
    return `- ${item.contentId} | kind=${item.contentKind} | tags=[${tags}] | voice=${voice} | duration=${dur} | ageMode=${age}`;
  }).join('\n');

  const freeText = intent.freeText?.trim();
  const payload = {
    ageMode,
    mood: intent.mood,
    voicePreference: intent.voicePreference,
    avoidTags: intent.avoidTags,
    durationSec: intent.durationSec,
    selectedContentIds: intent.selectedContentIds,
    freeText: freeText && freeText.length > 0 ? freeText : null,
  };

  return `## 年龄模式\n${ageMode}\n\n## 用户意图（JSON）\n\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\`\n\n## 可用素材清单\n${candidateLines}\n\n请根据以上信息返回方案。`;
}

export function parsePlanResponse(raw: string): LlmPlanResponse {
  // 防御性：模型可能输出 ```json ... ``` 包裹，或前后多余空白。
  const trimmed = raw.trim();
  const jsonStart = trimmed.indexOf('{');
  const jsonEnd = trimmed.lastIndexOf('}');
  if (jsonStart < 0 || jsonEnd < jsonStart) {
    throw new Error('LLM response does not contain JSON object');
  }
  const parsed = JSON.parse(trimmed.substring(jsonStart, jsonEnd + 1)) as LlmPlanResponse;
  if (typeof parsed !== 'object' || parsed === null) throw new Error('LLM response is not an object');
  if (typeof parsed.reason !== 'string') throw new Error('LLM response missing reason');
  if (!Array.isArray(parsed.tracks)) throw new Error('LLM response missing tracks array');
  for (const track of parsed.tracks) {
    if (typeof track.contentId !== 'string') throw new Error('LLM response track missing contentId');
    if (typeof track.volume !== 'number') throw new Error('LLM response track missing volume');
  }
  return parsed;
}