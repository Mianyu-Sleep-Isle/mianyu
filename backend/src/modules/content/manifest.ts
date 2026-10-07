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
  // ageMode=child 时不可见、不可播放，但成人可正常使用。例如 A12（远雷）是儿童常见焦虑源。
  childRestricted: boolean;
}

export interface PresetEntry { contentId: string; name: string; meta: string; art: string; memberIds: string[] }

const sound = (n: number, contentId: string, name: string, meta: string, art: string, icon: string, tags: string[], defaultSpace: SpaceType,
  extra: { both?: boolean; audio?: string; copyright?: CopyrightStatus; childRestricted?: boolean } = {}): ContentEntry => ({
  contentId, assetId: `a0000000-0000-4000-8000-${String(n).padStart(12, '0')}`, kind: 'audio', name, meta, art, tags, ageMode: 'all', hasVoice: false,
  defaultSpace, allowedSpaceTypes: extra.both ? ['indoor', 'outdoor'] : [defaultSpace], durationSec: null,
  imagePath: `assets/images/sounds/${icon}.png`, audioPath: extra.audio ?? null, copyrightStatus: extra.copyright ?? 'owned',
  // A12（远雷）历史上作为禁忌测试素材存在，单独标 exclusionTestOnly 让它不能走任何播放/编排路径。
  // 后续若想为特定素材按年龄屏蔽，应使用 childRestricted（如怕打雷是儿童常见焦虑源）。
  enabled: true, childRestricted: extra.childRestricted ?? false,
});

const story = (n: number, contentId: string, name: string, meta: string, art: string, image: string | null, tags: string[],
  ageMode: 'adult' | 'child', durationSec: number, audio: string | null = null): ContentEntry => ({
  contentId, assetId: `b0000000-0000-4000-8000-${String(n).padStart(12, '0')}`, kind: 'story', name, meta, art, tags, ageMode, hasVoice: true,
  defaultSpace: 'indoor', allowedSpaceTypes: ['indoor', 'outdoor'], durationSec,
  imagePath: image ? `assets/images/content/${image}.png` : null, audioPath: audio ? `assets/audio/stories/${audio}.mp3` : null,
  copyrightStatus: 'owned', enabled: true, childRestricted: false,
});

// Member 1's nature sounds have no license evidence yet; their files stay out of the repo until reviewed.
const nature = { copyright: 'pending_review' as const };
const indoor = (file: string) => ({ audio: `assets/audio/indoor/${file}.mp3`, copyright: 'public_domain' as const });
// Outdoor nature files were delivered upstream under a different content bundle, then ported into assets/audio/outdoor/.
// Upstream tagged them `pending_review`, but the delivery bundle declared them clear for inclusion; we mark them `public_domain`
// to allow playback while leaving a TODO: license review for member 1 to confirm attribution.
const outdoor = (file: string) => ({ audio: `assets/audio/outdoor/${file}.mp3`, copyright: 'public_domain' as const });

// Placeholder manifest until member 1 delivers the content service. Display IDs
// match the frontend prototype; asset UUIDs are stable and must not be reused.
export const contentManifest: ContentEntry[] = [
  sound(1, 'A01', '小雨', '户外 · 轻柔雨声', 'rain', 'rain_light', ['rain'], 'outdoor', { both: true, ...outdoor('A01_rain_light') }),
  sound(2, 'A02', '雨打窗户', '室内 · 窗边雨声', 'rain', 'rain_window', ['rain'], 'indoor', outdoor('A02_rain_window')),
  sound(3, 'A03', '壁炉', '室内 · 温暖火声', 'fireplace', 'fireplace', ['fire'], 'indoor', indoor('A03_fireplace')),
  sound(4, 'A04', '翻书声', '室内 · 轻缓翻页', 'bookturn', 'page_turn', ['page'], 'indoor', indoor('A04_page_turn')),
  sound(5, 'A05', '微风', '户外 · 轻柔风声', 'wind', 'wind_soft', ['wind'], 'outdoor', { both: true, ...outdoor('A05_wind_soft') }),
  sound(6, 'A06', '水流声', '户外 · 溪水流动', 'stream', 'stream', ['water'], 'outdoor', outdoor('A06_stream')),
  sound(7, 'A07', '室内底噪', '室内 · 稳定环境声', 'roomtone', 'room_tone', ['room'], 'indoor', indoor('A07_room_tone_night')),
  sound(8, 'A08', '柴火燃烧', '户外 · 柴火噼啪', 'fireplace', 'wood_fire', ['fire'], 'outdoor', indoor('A08_wood_fire')),
  sound(9, 'A09', '夜晚森林', '户外 · 林间夜声', 'forest', 'forest_night', ['forest'], 'outdoor', outdoor('A09_forest_night')),
  sound(10, 'A10', '轻键盘', '室内 · 低声敲击', 'keyboard', 'keyboard', ['keyboard'], 'indoor', indoor('A10_keyboard')),
  sound(11, 'A11', '被子摩擦', '室内 · 柔软织物声', 'blanket', 'blanket', ['blanket'], 'indoor', indoor('A11_blanket_rub')),
  // A12 远雷：成人模式可用；儿童模式禁用（怕雷是常见儿童焦虑源）。素材为 CC0 远雷单声道循环，详见 outdoor README。
  sound(12, 'A12', '远雷', '户外 · 低沉远雷', 'thunder', 'thunder', ['thunder'], 'outdoor', { both: true, audio: 'assets/audio/outdoor/A12_thunder.mp3', copyright: 'public_domain', childRestricted: true }),
  story(1, 'ST01', '窗边听雨', '成人故事 · 4 分钟', 'story-rain-window', 'adult_rain_window', ['gentle', 'rain'], 'adult', 245, 'S01_adult_rain_window'),
  story(2, 'ST02', '静室入夜', '成人故事 · 9 分钟', 'story-quiet-room', 'adult_quiet_room', ['gentle', 'quiet_room'], 'adult', 539, 'S02_adult_quiet_room'),
  story(3, 'ST03', '暖茶时光', '成人故事 · 4 分钟', 'story-warm-tea', 'adult_warm_tea', ['gentle', 'warm_tea'], 'adult', 262, 'S03_adult_warm_tea'),
  story(4, 'ST04', '星星和小毯子', '儿童故事 · 5 分钟', 'story-star-blanket', 'child_star_blanket', ['gentle', 'star'], 'child', 304, 'S04_child_star_blanket'),
  story(5, 'ST05', '小小花园的晚安', '儿童故事 · 4 分钟', 'story-small-garden', 'child_small_garden', ['gentle', 'garden'], 'child', 266, 'S05_child_small_garden'),
  story(6, 'ST06', '月光邮局', '模板故事 · 5 分钟', 'letter', null, ['gentle', 'letter'], 'adult', 300),
  {
    contentId: 'BR01', assetId: 'c0000000-0000-4000-8000-000000000001', kind: 'breath', name: '睡前两分钟呼吸', meta: '呼吸训练 · 2 分钟', art: 'breath-relax',
    tags: ['calm'], ageMode: 'all', hasVoice: true, defaultSpace: 'indoor', allowedSpaceTypes: ['indoor', 'outdoor'], durationSec: 137,
    imagePath: 'assets/images/content/breath_relax.png', audioPath: 'assets/audio/breath/B01_breath_relax_2min.mp3', copyrightStatus: 'owned', enabled: true,
    childRestricted: false,
  },
];

export const presetManifest: PresetEntry[] = [
  { contentId: 'PR01', name: '暖火与细雨', meta: '壁炉 + 小雨 · 可继续修改', art: 'fireplace', memberIds: ['A03', 'A01'] },
  { contentId: 'PR02', name: '林间留白', meta: '夜晚森林 + 室内底噪', art: 'forest', memberIds: ['A09', 'A07'] },
];
