import { z } from 'zod';

const uniqueStrings = z.array(z.string().trim().min(1).max(64)).max(20).transform((items) => [...new Set(items)]);
const allowedDurations = [600, 900, 1200, 1800, 2700, 3600] as const;

export const composePlanSchema = z.object({
  inputMode: z.enum(['choices', 'sentence']),
  mood: z.enum(['calm', 'annoyed', 'tired']),
  voicePreference: z.enum(['wanted', 'either', 'avoid']),
  avoidTags: uniqueStrings.default([]),
  durationSec: z.number().int().refine((value) => allowedDurations.includes(value as typeof allowedDurations[number]), '不支持的方案时长'),
  selectedContentIds: uniqueStrings.default([]),
  freeText: z.string().trim().min(1).max(500).nullable().optional(),
}).superRefine((value, ctx) => {
  if (value.inputMode === 'sentence' && !value.freeText) ctx.addIssue({ code: 'custom', path: ['freeText'], message: '说一句模式需要输入内容' });
  if (value.inputMode === 'choices' && value.freeText) ctx.addIssue({ code: 'custom', path: ['freeText'], message: '点选模式不能携带自由文本' });
});
