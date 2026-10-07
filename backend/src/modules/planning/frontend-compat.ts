import { z } from 'zod';
import type { ComposePlanRequest, Mood, SleepPlan, VoicePreference } from './types.ts';

// OpenAPI SleepIntent.emotion values plus the earlier module 2 values, which stay accepted.
const emotions = ['excited', 'anxious', 'wants_company', 'calm', 'unspecified', 'annoyed', 'tired'] as const;
type Emotion = typeof emotions[number];
const allowedDurationSec = [600, 900, 1200, 1800, 2700, 3600];

const legacyPlanSchema = z.object({
  emotion: z.enum(emotions).default('unspecified'),
  voice_preference: z.enum(['want', 'avoid', 'unspecified']).default('unspecified'),
  available_minutes: z.number().int().min(1).max(180).default(30),
  forbidden_tags: z.array(z.string().trim().min(1).max(64)).max(20).default([]),
  preset_sentence: z.string().trim().min(1).max(500).optional(),
  age_mode: z.enum(['adult', 'child']).optional(),
});

const moodByEmotion: Record<Emotion, Mood> = {
  excited: 'annoyed', anxious: 'annoyed', annoyed: 'annoyed', tired: 'tired', wants_company: 'calm', calm: 'calm', unspecified: 'calm',
};

const tagAliases: Record<string, string> = {
  '水声': 'rain', '雨声': 'rain', '小雨': 'rain',
  '风声': 'wind', '人声': 'voice', '雷声': 'thunder', '打雷': 'thunder', '远雷': 'thunder',
};

const trackNames: Record<string, string> = {
  A01: '小雨', A03: '壁炉', A04: '翻书声', A07: '室内底噪', A10: '轻键盘', A12: '远雷',
  S01: '睡前故事', S02: '儿童晚安故事', B01: '两分钟缓慢呼吸',
};

const nearestDuration = (minutes: number) => allowedDurationSec.reduce((best, value) =>
  Math.abs(value - minutes * 60) < Math.abs(best - minutes * 60) ? value : best);

export function fromFrontendIntent(input: unknown): ComposePlanRequest {
  const value = legacyPlanSchema.parse(input);
  const sentence = value.preset_sentence;
  const voicePreference: VoicePreference = value.voice_preference === 'want' ? 'wanted' : value.voice_preference === 'avoid' ? 'avoid'
    : value.emotion === 'wants_company' ? 'wanted' : 'either';
  return {
    inputMode: sentence ? 'sentence' : 'choices',
    mood: moodByEmotion[value.emotion],
    voicePreference,
    avoidTags: [...new Set(value.forbidden_tags.map((tag) => tagAliases[tag] ?? tag.toLowerCase()))],
    durationSec: nearestDuration(value.available_minutes),
    selectedContentIds: [],
    ...(sentence ? { freeText: sentence } : {}),
  };
}

export type TrackNameResolver = (contentId: string) => string | undefined;

// The current frontend adapter reads the snake_case aliases. The canonical fields
// remain present so the newer local integration can consume the same response.
export function toFrontendPlan(plan: SleepPlan, trackName: TrackNameResolver = () => undefined) {
  return {
    ...plan,
    id: plan.planId,
    type: plan.planType,
    duration_minutes: plan.durationSec / 60,
    fade_out_minutes: plan.fadeOutSec / 60,
    tracks: plan.tracks.map((track) => ({
      ...track,
      asset_id: track.contentId,
      name: trackName(track.contentId) ?? trackNames[track.contentId] ?? track.contentId,
    })),
  };
}
