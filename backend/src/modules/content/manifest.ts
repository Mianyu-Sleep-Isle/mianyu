export type ContentKind = 'audio' | 'story' | 'breath';
export type SpaceType = 'indoor' | 'outdoor';
export type CopyrightStatus = 'owned' | 'licensed' | 'public_domain' | 'pending_review' | 'restricted' | 'expired';

export interface ContentEntry {
  contentId: string;
  assetId: string;
  kind: ContentKind;
  name: string;
  meta: string;
  art: string;
  tags: string[];
  ageMode: 'all' | 'adult' | 'child';
  hasVoice: boolean;
  defaultSpace: SpaceType;
  allowedSpaceTypes: SpaceType[];
  durationSec: number | null;
  imagePath: string | null;
  audioPath: string | null;
  copyrightStatus: CopyrightStatus;
  enabled: boolean;
}

export interface PresetEntry { contentId: string; name: string; meta: string; art: string; memberIds: string[] }

const sound = (n: number, contentId: string, name: string, meta: string, art: string, icon: string, tags: string[], defaultSpace: SpaceType,
  extra: { both?: boolean; audio?: string; copyright?: CopyrightStatus } = {}): ContentEntry => ({
  contentId, assetId: `a0000000-0000-4000-8000-${String(n).padStart(12, '0')}`, kind: 'audio', name, meta, art, tags, ageMode: 'all', hasVoice: false,
  defaultSpace, allowedSpaceTypes: extra.both ? ['indoor', 'outdoor'] : [defaultSpace], durationSec: null,
  imagePath: `assets/images/sounds/${icon}.png`, audioPath: extra.audio ?? null, copyrightStatus: extra.copyright ?? 'owned', enabled: true,
});

const story = (n: number, contentId: string, name: string, meta: string, art: string, image: string | null, tags: string[],
  ageMode: 'adult' | 'child', durationSec: number): ContentEntry => ({
  contentId, assetId: `b0000000-0000-4000-8000-${String(n).padStart(12, '0')}`, kind: 'story', name, meta, art, tags, ageMode, hasVoice: true,
  defaultSpace: 'indoor', allowedSpaceTypes: ['indoor', 'outdoor'], durationSec,
  imagePath: image ? `assets/images/content/${image}.png` : null, audioPath: null, copyrightStatus: 'owned', enabled: true,
});

// Placeholder manifest until member 1 delivers the content service. Display IDs
// match the frontend prototype; asset UUIDs are stable and must not be reused.
export const contentManifest: ContentEntry[] = [
  sound(1, 'A01', '小雨', '户外 · 轻柔雨声', 'rain', 'rain_light', ['rain'], 'outdoor', { both: true, copyright: 'licensed' }),
  sound(2, 'A02', '雨打窗户', '室内 · 窗边雨声', 'rain', 'rain_window', ['rain'], 'indoor', { copyright: 'licensed' }),
  sound(3, 'A03', '壁炉', '室内 · 温暖火声', 'fireplace', 'fireplace', ['fire'], 'indoor', { audio: 'assets/audio/indoor/A03_fireplace.mp3' }),
  sound(4, 'A04', '翻书声', '室内 · 轻缓翻页', 'bookturn', 'page_turn', ['page'], 'indoor', { audio: 'assets/audio/indoor/A04_page_turn.mp3' }),
  sound(5, 'A05', '微风', '户外 · 轻柔风声', 'wind', 'wind_soft', ['wind'], 'outdoor', { both: true }),
  sound(6, 'A06', '水流声', '户外 · 溪水流动', 'stream', 'stream', ['water'], 'outdoor'),
  sound(7, 'A07', '室内底噪', '室内 · 稳定环境声', 'roomtone', 'room_tone', ['room'], 'indoor', { audio: 'assets/audio/indoor/A07_room_tone_night.mp3' }),
  sound(8, 'A08', '柴火燃烧', '户外 · 柴火噼啪', 'fireplace', 'wood_fire', ['fire'], 'outdoor', { audio: 'assets/audio/indoor/A08_wood_fire.mp3' }),
  sound(9, 'A09', '夜晚森林', '户外 · 林间夜声', 'forest', 'forest_night', ['forest'], 'outdoor'),
  sound(10, 'A10', '轻键盘', '室内 · 低声敲击', 'keyboard', 'keyboard', ['keyboard'], 'indoor', { audio: 'assets/audio/indoor/A10_keyboard.mp3' }),
  sound(11, 'A11', '被子摩擦', '室内 · 柔软织物声', 'blanket', 'blanket', ['blanket'], 'indoor', { audio: 'assets/audio/indoor/A11_blanket_rub.mp3' }),
  sound(12, 'A12', '远雷', '户外 · 低沉远雷', 'thunder', 'thunder', ['thunder'], 'outdoor', { both: true, copyright: 'licensed' }),
  story(1, 'ST01', '窗边听雨', '成人故事 · 4 分钟', 'story-rain-window', 'adult_rain_window', ['gentle', 'rain'], 'adult', 240),
  story(2, 'ST02', '静室入夜', '成人故事 · 9 分钟', 'story-quiet-room', 'adult_quiet_room', ['gentle', 'quiet_room'], 'adult', 540),
  story(3, 'ST03', '暖茶时光', '成人故事 · 4 分钟', 'story-warm-tea', 'adult_warm_tea', ['gentle', 'warm_tea'], 'adult', 240),
  story(4, 'ST04', '星星和小毯子', '儿童故事 · 5 分钟', 'story-star-blanket', 'child_star_blanket', ['gentle', 'star'], 'child', 300),
  story(5, 'ST05', '小小花园的晚安', '儿童故事 · 4 分钟', 'story-small-garden', 'child_small_garden', ['gentle', 'garden'], 'child', 240),
  story(6, 'ST06', '月光邮局', '模板故事 · 5 分钟', 'letter', null, ['gentle', 'letter'], 'adult', 300),
  {
    contentId: 'BR01', assetId: 'c0000000-0000-4000-8000-000000000001', kind: 'breath', name: '睡前两分钟呼吸', meta: '呼吸训练 · 2 分钟', art: 'breath-relax',
    tags: ['calm'], ageMode: 'all', hasVoice: true, defaultSpace: 'indoor', allowedSpaceTypes: ['indoor', 'outdoor'], durationSec: 120,
    imagePath: 'assets/images/content/breath_relax.png', audioPath: null, copyrightStatus: 'owned', enabled: true,
  },
];

export const presetManifest: PresetEntry[] = [
  { contentId: 'PR01', name: '暖火与细雨', meta: '壁炉 + 小雨 · 可继续修改', art: 'fireplace', memberIds: ['A03', 'A01'] },
  { contentId: 'PR02', name: '林间留白', meta: '夜晚森林 + 室内底噪', art: 'forest', memberIds: ['A09', 'A07'] },
];
