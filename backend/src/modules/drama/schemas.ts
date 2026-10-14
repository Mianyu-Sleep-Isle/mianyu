import { z } from 'zod';

export const visualStyle = z.enum(['watercolor', 'paper_cut', 'soft_anime', 'oil_pastel']);
export const mood = z.enum(['calm', 'warm', 'healing', 'dreamy']);

export const guideStateSchema = z.object({
  theme: z.string().max(40).nullable(),
  mood: mood.nullable(),
  setting: z.string().max(40).nullable(),
  protagonist: z.string().max(40).nullable(),
  visual_style: visualStyle.nullable(),
  forbidden_elements: z.array(z.string().max(20)).max(8),
  missing: z.array(z.enum(['theme', 'mood', 'setting'])).max(3),
});

export const chatSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().min(1).max(500),
  })).min(1).max(13),
  guide_state: guideStateSchema.nullable().optional(),
});

export const briefBodySchema = z.object({
  theme: z.string().min(1).max(40),
  mood,
  setting: z.string().min(1).max(40),
  protagonist: z.string().min(1).max(40),
  visual_style: visualStyle,
  duration_sec: z.union([z.literal(90), z.literal(120), z.literal(150)]),
  shot_count: z.union([z.literal(6), z.literal(7), z.literal(8)]),
  forbidden_elements: z.array(z.string().max(20)).max(8),
  voice_id: z.literal('default'),
  privacy_replacements: z.array(z.string().max(40)).max(4),
});

export const jobSchema = z.object({ brief: briefBodySchema });

export type ChatInput = z.infer<typeof chatSchema>;
export type BriefInput = z.infer<typeof briefBodySchema>;
