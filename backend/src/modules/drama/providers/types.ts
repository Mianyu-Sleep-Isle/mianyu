import type { BriefRecord } from '../repository.ts';
import type { DramaStage } from '../state-machine.ts';

export interface GuideDraft {
  reply: string;
  theme: string | null;
  mood: BriefRecord['mood'] | null;
  setting: string | null;
  protagonist: string | null;
  visual_style: BriefRecord['visual_style'] | null;
  forbidden_elements: string[];
  suggestions: string[];
}

export interface StoryDraft {
  title: string;
  summary: string;
  narration: string;
}

export interface ReviewDraft {
  approved: boolean;
  reasons: string[];
  risk_tags: string[];
  rewrite_advice: string;
}

export interface BoardShotDraft {
  narration_text: string;
  image_prompt: string;
  negative_prompt: string;
  duration_sec: number;
  transition: 'fade' | 'crossfade';
  camera_motion: 'static' | 'zoom_in' | 'zoom_out' | 'pan';
}

export interface LlmProvider {
  chat(messages: Array<{ role: 'user' | 'assistant'; content: string }>, guideHint: unknown): Promise<GuideDraft>;
  brief(messages: Array<{ role: 'user' | 'assistant'; content: string }>, guideHint: unknown): Promise<BriefRecord>;
  story(brief: BriefRecord, rewriteAdvice?: string): Promise<StoryDraft>;
  review(narration: string, forbidden: string[]): Promise<ReviewDraft>;
  storyboard(narration: string, shotCount: number, forbidden: string[]): Promise<BoardShotDraft[]>;
}

export interface ImageProvider {
  character(prompt: string, seed: number): Promise<Buffer>;
  shot(prompt: string, negative: string, seed: number, width: number, height: number): Promise<Buffer>;
}

export interface TtsProvider {
  synthesize(text: string): Promise<Buffer>;
}

export interface VideoComposer {
  compose(input: {
    jobDir: string;
    shots: Array<{ order: number; durationSec: number; cameraMotion: string; narrationText: string }>;
  }): Promise<{ durationSec: number; sizeBytes: number }>;
}

export interface GpuSupervisor {
  beginImages(jobId: string, stage: DramaStage): Promise<void>;
  endImages(): Promise<void>;
}

export class ProviderError extends Error {
  constructor(readonly code: string, message: string, readonly retryable = true, readonly injected = false) {
    super(message);
  }
}
