import { z } from 'zod';

export const ageModeSchema = z.enum(['adult', 'child']);
export const voicePreferenceSchema = z.enum(['want', 'avoid', 'unspecified']);
export const anonymousUserSchema = z.object({ age_mode: ageModeSchema.default('adult') });
export const feedbackSchema = z.object({
  session_id: z.string().min(1).max(100),
  fall_asleep_ease: z.enum(['easy', 'normal', 'difficult', 'unknown']),
  sound_comfort: z.enum(['comfortable', 'acceptable', 'uncomfortable']),
  voice_next_time: voicePreferenceSchema,
  story_effect_rating: z.number().int().min(1).max(5).optional(),
  disliked_content: z.string().max(500).optional(),
  note: z.string().max(500).optional(),
  forbidden_sound_tags: z.array(z.string().min(1).max(80)).max(30).default([]),
  story_themes: z.array(z.string().min(1).max(80)).max(30).default([]),
  breath_templates: z.array(z.string().min(1).max(80)).max(30).default([]),
  scenes: z.array(z.string().min(1).max(100)).max(30).default([])
});
export const archivePeriodSchema = z.enum(['7d', '30d']);

export type FeedbackInput = z.infer<typeof feedbackSchema>;
export type VoicePreference = z.infer<typeof voicePreferenceSchema>;

export interface SessionFact {
  id: string;
  userId: string;
  endedAt: string;
  source: 'module4' | 'development';
}

export interface SessionFactsPort {
  latestCompleted(userId: string): Promise<SessionFact | null>;
  isCompletedForUser(sessionId: string, userId: string): Promise<boolean>;
}
