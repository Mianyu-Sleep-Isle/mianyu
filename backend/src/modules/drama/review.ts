export const BANNED_SUBSTRINGS = ['杀人', '血腥', '鬼魂', '尸体', '色情', '裸体', '自杀', '恐怖', '惊吓', '自残', '治愈失眠', '治疗失眠', '诊断'] as const;
export const CRISIS_SUBSTRINGS = ['自杀', '不想活', '伤害自己', '结束生命'] as const;

export function hanCount(text: string): number {
  return text.match(/\p{Script=Han}/gu)?.length ?? 0;
}

export function containsAny(text: string, words: readonly string[]): string | null {
  return words.find((word) => text.includes(word)) ?? null;
}

export function crisisHit(value: unknown): boolean {
  return containsAny(JSON.stringify(value ?? ''), CRISIS_SUBSTRINGS) !== null;
}

export interface ReviewResult {
  approved: boolean;
  reasons: string[];
  riskTags: string[];
  rewriteAdvice: string;
}

export function deterministicReview(input: {
  narration: string;
  prompts: string[];
  forbidden: string[];
  shotCount: number | null;
  actualShots: number | null;
}): ReviewResult {
  const reasons: string[] = [];
  const count = hanCount(input.narration);
  if (count < 300 || count > 600) reasons.push('故事长度不在范围内');
  if (input.shotCount !== null && input.actualShots !== null && input.shotCount !== input.actualShots) reasons.push('分镜数量不正确');
  const corpus = [input.narration, ...input.prompts].join('\n');
  if (containsAny(corpus, BANNED_SUBSTRINGS)) reasons.push('包含不适合睡前的内容');
  for (const item of input.forbidden) {
    if (item && corpus.includes(item)) reasons.push('包含用户明确拒绝的内容');
  }
  return {
    approved: reasons.length === 0,
    reasons,
    riskTags: reasons.length ? ['forbidden'] : [],
    rewriteAdvice: reasons[0] ?? '',
  };
}

export function fieldUnsafe(fields: Record<string, string>): string | null {
  for (const [field, value] of Object.entries(fields)) {
    if (containsAny(value, BANNED_SUBSTRINGS) || containsAny(value, CRISIS_SUBSTRINGS.filter((word) => word !== '自杀'))) return field;
    if (value.includes('自杀')) return field;
  }
  return null;
}
