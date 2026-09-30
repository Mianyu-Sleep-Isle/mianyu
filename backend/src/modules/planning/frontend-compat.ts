import { z } from 'zod';
import type { ComposePlanRequest, SleepPlan } from './types.ts';

const legacyPlanSchema = z.object({
  emotion: z.enum(['calm', 'annoyed', 'tired', 'unspecified']).default('unspecified'),
  voice_preference: z.enum(['want', 'avoid', 'unspecified']).default('unspecified'),
  available_minutes: z.union([z.literal(10), z.literal(15), z.literal(20), z.literal(30), z.literal(45), z.literal(60)]).default(30),
  forbidden_tags: z.array(z.string().trim().min(1).max(64)).max(20).default([]),
  preset_sentence: z.string().trim().min(1).max(500).optional(),
  age_mode: z.enum(['adult', 'child']).optional(),
});

const tagAliases: Record<string, string> = {
  '水声': 'rain', '雨声': 'rain', '小雨': 'rain',
  '风声': 'wind', '人声': 'voice', '雷声': 'thunder', '打雷': 'thunder', '远雷': 'thunder',
};

const trackNames: Record<string, string> = {
  A01: '小雨', A03: '壁炉', A04: '翻书声', A07: '室内底噪', A10: '轻键盘', A12: '远雷',
  S01: '睡前故事', S02: '儿童晚安故事', B01: '两分钟缓慢呼吸',
};

export function fromFrontendIntent(input: unknown): ComposePlanRequest {
  const value = legacyPlanSchema.parse(input);
  const sentence = value.preset_sentence;
  return {
    inputMode: sentence ? 'sentence' : 'choices',
    mood: value.emotion === 'unspecified' ? 'calm' : value.emotion,
    voicePreference: value.voice_preference === 'want' ? 'wanted' : value.voice_preference === 'avoid' ? 'avoid' : 'either',
    avoidTags: [...new Set(value.forbidden_tags.map((tag) => tagAliases[tag] ?? tag.toLowerCase()))],
    durationSec: value.available_minutes * 60,
    selectedContentIds: [],
    ...(sentence ? { freeText: sentence } : {}),
  };
}

// The current frontend adapter reads the snake_case aliases. The canonical fields
// remain present so the newer local integration can consume the same response.
export function toFrontendPlan(plan: SleepPlan) {
  return {
    ...plan,
    id: plan.planId,
    type: plan.planType,
    duration_minutes: plan.durationSec / 60,
    fade_out_minutes: plan.fadeOutSec / 60,
    tracks: plan.tracks.map((track) => ({
      ...track,
      asset_id: track.contentId,
      name: trackNames[track.contentId] ?? track.contentId,
    })),
  };
}
