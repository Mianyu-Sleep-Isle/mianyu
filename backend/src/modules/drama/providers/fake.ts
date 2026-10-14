import { copyFileSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { crc32, deflateSync } from 'node:zlib';
import type { BriefRecord } from '../repository.ts';
import { BASE_NEGATIVE, STYLE_PREFIX } from '../prompts.ts';
import { lighthouseTemplate, templateByTheme, type StoryTemplate } from '../templates.ts';
import { webvtt } from './ffmpeg.ts';
import { silentWav } from './tts.ts';
import type { BoardShotDraft, GpuSupervisor, GuideDraft, ImageProvider, LlmProvider, ReviewDraft, StoryDraft, TtsProvider, VideoComposer } from './types.ts';

const PNG = solidPng(8, 8, 196, 122, 44);
const JPEG = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBwgHBgcIBwcICwgJCQgICAsLCwsLCwwMDAwMDA0ODQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDf/AABEIAQABAAMBIgACEQEDEQH/xAAbAAACAwEBAQAAAAAAAAAAAAACAwABBAUGB//EADsQAAIBAwMCBAMGBQUAAAAAAAECAwAEEQUSITFBBhNRYXEigZGhscHR8BRCkqGxwdEzYvE0Q1Ni/8QAFQEBAQAAAAAAAAAAAAAAAAAAAgP/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwD9UAAAAA//2Q==', 'base64');

const MOODS: Array<[RegExp, BriefRecord['mood']]> = [[/平静/, 'calm'], [/温暖/, 'warm'], [/治愈/, 'healing'], [/梦幻/, 'dreamy']];
const ANIMALS: Array<[RegExp, string]> = [[/猫/, '一只猫'], [/狗/, '一只狗'], [/兔/, '一只兔子'], [/熊/, '一只熊'], [/狐狸/, '一只狐狸']];
const PLACES: Array<[RegExp, string]> = [[/灯塔/, '海边灯塔'], [/森林/, '森林'], [/海边/, '海边'], [/小屋/, '安静的小屋'], [/星空/, '星空下'], [/花园/, '花园']];

export interface DramaCalls {
  images: number;
  ttsTexts: string[];
  storyCalls: number;
  progress: number[];
}

export function createCalls(): DramaCalls {
  return { images: 0, ttsTexts: [], storyCalls: 0, progress: [] };
}

export function inferGuide(messages: Array<{ role: string; content: string }>): GuideDraft {
  const users = messages.filter((message) => message.role === 'user').map((message) => message.content.trim());
  const all = users.join('\n');
  const theme = users[0] ? [...users[0]].slice(0, 30).join('') : null;
  const mood = MOODS.find(([pattern]) => pattern.test(all))?.[1] ?? null;
  const setting = PLACES.find(([pattern]) => pattern.test(all))?.[1] ?? null;
  const protagonist = ANIMALS.find(([pattern]) => pattern.test(all))?.[1] ?? null;
  const forbidden = [...all.matchAll(/不要([^，。\s]{1,12})/g)].map((match) => match[1] ?? '').filter(Boolean);
  const missing = [theme ? null : '主题', mood ? null : '感觉', setting ? null : '地点'].filter((item): item is string => item !== null);
  const question = missing[0] === '地点' ? '故事发生在什么地方呢？' : missing[0] === '感觉' ? '希望听完是什么感觉？' : missing[0] === '主题' ? '想听一个关于什么的故事？' : '这些就够了，可以生成故事了。';
  const suggestions = missing[0] === '感觉' ? ['平静', '温暖', '梦幻'] : missing[0] === '地点' ? ['海边灯塔', '森林小屋', '星空下'] : [];
  return { reply: question, theme, mood, setting, protagonist, visual_style: null, forbidden_elements: forbidden, suggestions };
}

export function createFakeLlm(input: { unsafeStory: boolean; calls: DramaCalls }): LlmProvider {
  return {
    async chat(messages) {
      return inferGuide(messages);
    },
    async brief(messages) {
      const guide = inferGuide(messages);
      const template = templateByTheme(guide.theme ?? '');
      return {
        theme: guide.theme ?? template.title,
        mood: guide.mood ?? 'calm',
        setting: guide.setting ?? '安静的小屋',
        protagonist: guide.protagonist ?? '一个安静的角色',
        visual_style: guide.visual_style ?? 'watercolor',
        duration_sec: 120,
        shot_count: 6,
        forbidden_elements: guide.forbidden_elements,
        voice_id: 'default',
        privacy_replacements: [],
      };
    },
    async story(brief) {
      input.calls.storyCalls += 1;
      if (input.unsafeStory) return { title: '不合适的故事', summary: '这个故事不能使用。', narration: `${'杀人'.repeat(180)}结局很可怕。` };
      const template = templateByTheme(brief.theme);
      return { title: template.title, summary: template.summary, narration: template.narration };
    },
    async review(): Promise<ReviewDraft> {
      return { approved: true, reasons: [], risk_tags: [], rewrite_advice: '' };
    },
    async storyboard(narration, shotCount): Promise<BoardShotDraft[]> {
      return boardFromTemplate(templateByTheme(narration.includes('兔子') ? '小屋' : '灯塔'), shotCount);
    },
  };
}

export function boardFromTemplate(template: StoryTemplate, shotCount: number): BoardShotDraft[] {
  const shots = template.shots.map((shot) => ({
    narration_text: shot.narrationText,
    image_prompt: shot.imagePrompt,
    negative_prompt: 'dark alley',
    duration_sec: 20,
    transition: 'fade' as const,
    camera_motion: shot.cameraMotion,
  }));
  while (shots.length < shotCount) {
    const last = shots[shots.length - 1];
    if (!last) break;
    shots.push({ ...last });
  }
  return shots.slice(0, shotCount);
}

export function createFakeImages(calls: DramaCalls): ImageProvider {
  return {
    async character() {
      calls.images += 1;
      return PNG;
    },
    async shot() {
      calls.images += 1;
      return PNG;
    },
  };
}

export function createFakeTts(calls: DramaCalls): TtsProvider {
  return {
    async synthesize(text: string) {
      calls.ttsTexts.push(text);
      return silentWav(0.05);
    },
  };
}

export function createFakeComposer(tinyMp4: string): VideoComposer {
  return {
    async compose({ jobDir, shots }) {
      mkdirSync(jobDir, { recursive: true });
      copyFileSync(tinyMp4, path.join(jobDir, 'final.mp4'));
      const cue = shots[0]?.narrationText || '夜色很安静。';
      writeFileSync(path.join(jobDir, 'subtitles.vtt'), webvtt([{ narrationText: cue, startSec: 0, durationSec: 2 }]), 'utf8');
      return { durationSec: 2, sizeBytes: statSync(path.join(jobDir, 'final.mp4')).size };
    },
  };
}

export function createFakeGpu(): GpuSupervisor {
  return { async beginImages() {}, async endImages() {} };
}

export function writeStill(file: string, kind: 'png' | 'jpg'): void {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, kind === 'png' ? PNG : JPEG);
}

export function stylePrompt(style: string, protagonist: string, imagePrompt: string): string {
  const prefix = STYLE_PREFIX[style] ?? STYLE_PREFIX.watercolor;
  return `${prefix}, same character in every shot: ${protagonist}, consistent face, clothes and colors, ${imagePrompt}`;
}

export function negativePrompt(modelNegative: string, forbidden: string[]): string {
  return [modelNegative, BASE_NEGATIVE, ...forbidden].filter(Boolean).join(', ');
}

export function presetBytes(presetPath: string): Buffer {
  return exists(presetPath) ? readFileSync(presetPath) : PNG;
}

function solidPng(width: number, height: number, red: number, green: number, blue: number): Buffer {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const start = y * (width * 3 + 1);
    for (let x = 0; x < width; x += 1) {
      raw[start + 1 + x * 3] = red;
      raw[start + 2 + x * 3] = green;
      raw[start + 3 + x * 3] = blue;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length, 0);
    const checksum = Buffer.alloc(4);
    checksum.writeUInt32BE(crc32(body), 0);
    return Buffer.concat([length, body, checksum]);
  };
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function exists(file: string): boolean {
  try {
    return statSync(file).isFile();
  } catch {
    return false;
  }
}
