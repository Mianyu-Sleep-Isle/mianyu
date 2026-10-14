import type { DramaStage } from './state-machine.ts';
import { hanCount } from './review.ts';

export const PROMPT_VERSIONS = {
  chat: 'drama-chat-v1.0.0',
  brief: 'drama-brief-v1.0.0',
  story: 'drama-story-v1.0.0',
  review: 'drama-review-v1.0.0',
  board: 'drama-board-v1.0.0',
} as const;

export const STYLE_PREFIX: Record<string, string> = {
  watercolor: 'soft watercolor picture book, warm paper texture, gentle light',
  paper_cut: 'layered paper-cut night scene, indigo and amber, soft paper edges',
  soft_anime: 'soft anime illustration, rounded shapes, pastel night colors',
  oil_pastel: 'oil pastel drawing, muted colors, visible gentle strokes, cozy',
};

export const BASE_NEGATIVE = 'text, watermark, logo, nsfw, nude, blood, gore, weapon, horror, scary, monster, deformed hands';

export const CAMERA_CYCLE = ['static', 'zoom_in', 'pan', 'static', 'zoom_out', 'static', 'zoom_in', 'pan'] as const;

export function targetChars(durationSec: number): number {
  return Math.min(600, Math.max(300, durationSec * 4));
}

export function chatSystemPrompt(): string {
  return [
    '你是「眠屿」的睡前故事向导。你只帮用户确定一个低刺激睡前故事的设定，不讲完整故事，不提供医疗、诊断或治疗建议。',
    '规则：',
    '1. reply 不超过 80 个汉字，每次只问一个问题，不用感叹号。',
    '2. 优先补齐 theme、mood、setting。能看出主角就填 protagonist。',
    '3. mood 只能是 calm、warm、healing、dreamy；visual_style 只能是 watercolor、paper_cut、soft_anime、oil_pastel。不能确定就填 null。',
    '4. forbidden_elements 只记录用户明确拒绝的事物。',
    '5. 用户若说出真实姓名、学校、住址或电话，不要写入任何字段，用「小朋友」「学校」「家里」代替。',
    '6. suggestions 给 0 到 3 个不超过 8 个字的快捷回复。',
    '7. 不要输出故事正文。',
    '只输出 JSON。',
  ].join('\n');
}

export function briefSystemPrompt(): string {
  return [
    '把对话整理成睡前故事摘要。不要复述对话。真实姓名、学校、住址、电话换成虚构说法，并在 privacy_replacements 里用一句不超过 20 字的话说明替换了哪一类信息，不要写出原文。',
    '用户没提及时：visual_style 用 watercolor，duration_sec 用 120，shot_count 用 6，voice_id 用 default。',
    'theme、setting、protagonist 必须是具体短语。mood 必须是 calm、warm、healing、dreamy 之一。',
    '只输出 JSON。',
  ].join('\n');
}

export function storySystemPrompt(): string {
  return [
    '你是睡前故事作者。根据摘要写一个低刺激故事。',
    '字数以用户消息里的 target_chars 为准，允许上下浮动 10%，且必须落在 300 到 600 个汉字之间。',
    '不要追逐、冲突、惊吓、反转或悬念结尾。不要出现摘要 forbidden_elements 里的事物。不要医疗建议。',
    '结尾是主角安静地睡着。title 不超过 20 字，summary 不超过 80 字。',
    '只输出 JSON：{"title":"","summary":"","narration":""}',
  ].join('\n');
}

export function reviewSystemPrompt(): string {
  return [
    '你审核睡前故事。只根据用户消息里的 story 和 forbidden_elements 判断。',
    '任一情况 approved=false：暴力、血腥、色情、自伤、恐怖、惊吓、追逐、悬念结尾、出现 forbidden_elements、医疗承诺。',
    'reasons 用不超过 20 字的中文短句。risk_tags 只能从 violence、sexual、self_harm、horror、suspense、privacy、medical、forbidden 里选。',
    'rewrite_advice 用一句中文说明怎么改写。',
    '只输出 JSON：{"approved":false,"reasons":[],"risk_tags":[],"rewrite_advice":""}',
  ].join('\n');
}

export function boardSystemPrompt(): string {
  return [
    '你是分镜导演。把已审核故事拆成用户指定数量的镜头，不新增加危险内容。',
    '每个镜头的 narration_text 使用中文，连起来覆盖全文。',
    'image_prompt 和 negative_prompt 使用英文。image_prompt 描述一个静止画面，不要文字、对白或镜头术语堆砌。',
    'camera_motion 只能是 static、zoom_in、zoom_out、pan。transition 固定填 fade。',
    'duration_sec 由你分配，每镜 8 到 25 秒。',
    '只输出 JSON：{"shots":[{"narration_text":"","image_prompt":"","negative_prompt":"","duration_sec":12,"transition":"fade","camera_motion":"static"}]}',
  ].join('\n');
}

const STAGE_ERROR: Record<DramaStage, { code: string; message: string }> = {
  generating_story: { code: 'MODEL_OUTPUT_INVALID', message: 'AI 输出格式异常' },
  reviewing: { code: 'MODEL_OUTPUT_INVALID', message: 'AI 输出格式异常' },
  generating_storyboard: { code: 'MODEL_OUTPUT_INVALID', message: 'AI 输出格式异常' },
  generating_character_reference: { code: 'IMAGE_GENERATION_FAILED', message: '画面生成失败' },
  generating_images: { code: 'IMAGE_GENERATION_FAILED', message: '画面生成失败' },
  synthesizing_voice: { code: 'TTS_GENERATION_FAILED', message: '旁白生成失败' },
  composing_video: { code: 'VIDEO_COMPOSITION_FAILED', message: '视频合成失败' },
};

export function stageError(stage: DramaStage): { code: string; message: string; retryable: boolean } {
  const mapped = STAGE_ERROR[stage];
  return { ...mapped, retryable: mapped.code !== 'STORY_REVIEW_REJECTED' };
}

export function ensureHanLength(text: string, min = 360, max = 420): string {
  const pad = '细雨轻轻落着，主角在暖光里呼吸变慢，然后安心睡着。';
  let out = text;
  while (hanCount(out) < min) out += pad;
  if (hanCount(out) <= max) return out;
  const chars = [...out];
  let kept = '';
  let count = 0;
  for (const char of chars) {
    const next = hanCount(char);
    if (count + next > max) break;
    kept += char;
    count += next;
  }
  return kept;
}
