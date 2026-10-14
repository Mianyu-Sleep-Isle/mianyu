import { readFileSync } from 'node:fs';
import type { BriefRecord } from '../repository.ts';
import { boardSystemPrompt, briefSystemPrompt, chatSystemPrompt, reviewSystemPrompt, storySystemPrompt, targetChars } from '../prompts.ts';
import { composeWithFfmpeg } from './ffmpeg.ts';
import { completeStructured, type LlmConfig } from './llm.ts';
import { patchWorkflow, renderWithComfy, type WorkflowNode } from './comfyui.ts';
import { synthesizeRemote } from './tts.ts';
import type { BoardShotDraft, GuideDraft, ImageProvider, LlmProvider, ReviewDraft, StoryDraft, TtsProvider, VideoComposer } from './types.ts';
import { ProviderError } from './types.ts';

const loose = { type: 'object', additionalProperties: true };
const moods = new Set(['calm', 'warm', 'healing', 'dreamy']);
const styles = new Set(['watercolor', 'paper_cut', 'soft_anime', 'oil_pastel']);
const cameras = new Set(['static', 'zoom_in', 'zoom_out', 'pan']);

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback;
}

export function createRealLlm(config: LlmConfig): LlmProvider {
  const ask = (input: { temperature: number; maxTokens: number; timeoutMs: number; name: string; system: string; user: string }) => completeStructured(config, {
    temperature: input.temperature,
    maxTokens: input.maxTokens,
    timeoutMs: input.timeoutMs,
    schemaName: input.name,
    schema: loose,
    messages: [{ role: 'system', content: input.system }, { role: 'user', content: input.user }],
  });
  return {
    async chat(messages): Promise<GuideDraft> {
      const raw = record(await ask({ temperature: 0.7, maxTokens: 400, timeoutMs: 50_000, name: 'drama_chat', system: chatSystemPrompt(), user: JSON.stringify({ messages }) }));
      const mood = text(raw.mood);
      const style = text(raw.visual_style);
      return {
        reply: text(raw.reply, '想听一个什么样的故事？').slice(0, 120),
        theme: text(raw.theme) || null,
        mood: moods.has(mood) ? mood as GuideDraft['mood'] : null,
        setting: text(raw.setting) || null,
        protagonist: text(raw.protagonist) || null,
        visual_style: styles.has(style) ? style as GuideDraft['visual_style'] : null,
        forbidden_elements: Array.isArray(raw.forbidden_elements) ? raw.forbidden_elements.map((item) => text(item)).filter(Boolean).slice(0, 8) : [],
        suggestions: Array.isArray(raw.suggestions) ? raw.suggestions.map((item) => text(item)).filter(Boolean).slice(0, 4) : [],
      };
    },
    async brief(messages): Promise<BriefRecord> {
      const raw = record(await ask({ temperature: 0.3, maxTokens: 800, timeoutMs: 70_000, name: 'drama_brief', system: briefSystemPrompt(), user: JSON.stringify({ messages }) }));
      const mood = text(raw.mood, 'calm');
      const style = text(raw.visual_style, 'watercolor');
      const duration = Number(raw.duration_sec);
      const shots = Number(raw.shot_count);
      return {
        theme: text(raw.theme),
        mood: moods.has(mood) ? mood as BriefRecord['mood'] : 'calm',
        setting: text(raw.setting),
        protagonist: text(raw.protagonist),
        visual_style: styles.has(style) ? style as BriefRecord['visual_style'] : 'watercolor',
        duration_sec: duration === 90 || duration === 150 ? duration : 120,
        shot_count: shots === 7 || shots === 8 ? shots : 6,
        forbidden_elements: Array.isArray(raw.forbidden_elements) ? raw.forbidden_elements.map((item) => text(item)).filter(Boolean).slice(0, 8) : [],
        voice_id: 'default',
        privacy_replacements: Array.isArray(raw.privacy_replacements) ? raw.privacy_replacements.map((item) => text(item)).filter(Boolean).slice(0, 4) : [],
      };
    },
    async story(brief, rewriteAdvice): Promise<StoryDraft> {
      const raw = record(await ask({
        temperature: 0.8, maxTokens: 2000, timeoutMs: 180_000, name: 'drama_story', system: storySystemPrompt(),
        user: JSON.stringify({ brief, target_chars: targetChars(brief.duration_sec), rewrite_advice: rewriteAdvice ?? '' }),
      }));
      const narration = text(raw.narration);
      if (!narration) throw new ProviderError('MODEL_OUTPUT_INVALID', 'AI 输出格式异常');
      return { title: text(raw.title, '睡前故事').slice(0, 20), summary: text(raw.summary).slice(0, 80), narration };
    },
    async review(narration, forbidden): Promise<ReviewDraft> {
      const raw = record(await ask({
        temperature: 0.1, maxTokens: 400, timeoutMs: 60_000, name: 'drama_review', system: reviewSystemPrompt(),
        user: JSON.stringify({ story: narration, forbidden_elements: forbidden }),
      }));
      return {
        approved: raw.approved === true,
        reasons: Array.isArray(raw.reasons) ? raw.reasons.map((item) => text(item)).filter(Boolean) : [],
        risk_tags: Array.isArray(raw.risk_tags) ? raw.risk_tags.map((item) => text(item)).filter(Boolean) : [],
        rewrite_advice: text(raw.rewrite_advice),
      };
    },
    async storyboard(narration, shotCount, forbidden): Promise<BoardShotDraft[]> {
      const raw = record(await ask({
        temperature: 0.4, maxTokens: 2000, timeoutMs: 90_000, name: 'drama_board', system: boardSystemPrompt(),
        user: JSON.stringify({ narration, shot_count: shotCount, forbidden_elements: forbidden }),
      }));
      const shots = Array.isArray(raw.shots) ? raw.shots : [];
      if (shots.length !== shotCount) throw new ProviderError('MODEL_OUTPUT_INVALID', 'AI 输出格式异常');
      return shots.map((item) => {
        const shot = record(item);
        const camera = text(shot.camera_motion, 'static');
        return {
          narration_text: text(shot.narration_text),
          image_prompt: text(shot.image_prompt),
          negative_prompt: text(shot.negative_prompt),
          duration_sec: Number(shot.duration_sec) || 12,
          transition: 'fade',
          camera_motion: cameras.has(camera) ? camera as BoardShotDraft['camera_motion'] : 'static',
        };
      });
    },
  };
}

export function createRealImages(input: { baseUrl: string; workflowPath: string; fetchImpl?: typeof fetch }): ImageProvider {
  const render = async (prompt: string, negative: string, seed: number, width: number, height: number, prefix: string) => {
    const workflow = JSON.parse(readFileSync(input.workflowPath, 'utf8')) as Record<string, WorkflowNode>;
    const patched = patchWorkflow(workflow, { positive: prompt, negative, seed, width, height, filenamePrefix: prefix });
    return renderWithComfy(input.baseUrl, patched, prefix, input.fetchImpl);
  };
  return {
    character: (prompt, seed) => render(prompt, 'text, watermark', seed, 1024, 1024, `drama-character-${seed}`),
    shot: (prompt, negative, seed, width, height) => render(prompt, negative, seed, width, height, `drama-shot-${seed}`),
  };
}

export function createRealTts(baseUrl: string, fetchImpl?: typeof fetch): TtsProvider {
  return { synthesize: (text) => synthesizeRemote(baseUrl, text, fetchImpl) };
}

export function createRealComposer(ffmpegPath: string, fontPath: string): VideoComposer {
  return { compose: (input) => composeWithFfmpeg(ffmpegPath, { ...input, fontPath }) };
}
