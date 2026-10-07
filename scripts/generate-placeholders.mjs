// 用 SVG 生成前端引用的占位图。SVG 文件以 .svg 保存，前端引用统一改为 .svg。
// 设计原则：每个占位图都带主题色 + 标签，让界面"看起来有内容"。
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = 'E:/助眠/mianyu-integration-all-branches/mianyu-integration-all-branches';
const ASSETS = ['images/brand', 'images/scenes', 'images/sounds', 'images/content'];
const PROTO_DIRS = ['', 'generated_support_v2'];

// 主题色板（夜蓝暖橙方向，从 CSS 推断）
const PALETTE = {
  nightSky: '#0b1f3f',
  deepBlue: '#102a52',
  twilight: '#1a3a72',
  warmOrb: '#f8c98a',
  textLight: '#cbd6ed',
  textMuted: '#7a8bb0',
};

function svg(w, h, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="g" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${PALETTE.twilight}"/><stop offset="1" stop-color="${PALETTE.nightSky}"/></linearGradient></defs><rect width="${w}" height="${h}" fill="url(#g)"/>${body}</svg>`;
}

function label(text, w, h, extra = '') {
  const fs = Math.max(11, Math.round(Math.min(w, h) / 7));
  const lines = text.split('\n');
  const lineH = fs * 1.4;
  const totalH = lineH * lines.length;
  const startY = (h - totalH) / 2 + fs;
  return lines.map((l, i) => `<text x="${w / 2}" y="${startY + i * lineH}" fill="${PALETTE.textLight}" font-family="system-ui, -apple-system, sans-serif" font-size="${fs}" text-anchor="middle" font-weight="500">${l}</text>`).join('') + extra;
}

const FILES = {
  // brand
  'assets/images/brand/app_icon.svg': [256, 256, (w, h) => {
    // 圆形品牌图标
    return svg(w, h, `
      <circle cx="${w / 2}" cy="${h / 2}" r="${w * 0.42}" fill="${PALETTE.warmOrb}" opacity="0.92"/>
      <circle cx="${w / 2}" cy="${h / 2}" r="${w * 0.42}" fill="none" stroke="${PALETTE.deepBlue}" stroke-width="4"/>
      <path d="M${w * 0.5} ${h * 0.32} a ${w * 0.18} ${h * 0.18} 0 1 0 0.01 0 z" fill="${PALETTE.nightSky}"/>
      <text x="${w / 2}" y="${h * 0.78}" fill="${PALETTE.deepBlue}" font-family="system-ui" font-size="${w * 0.14}" text-anchor="middle" font-weight="700">眠屿</text>
    `);
  }],
  'assets/images/brand/app_icon_circle.svg': [256, 256, (w, h) => {
    return svg(w, h, `
      <circle cx="${w / 2}" cy="${h / 2}" r="${w * 0.45}" fill="${PALETTE.deepBlue}"/>
      <circle cx="${w / 2}" cy="${h / 2}" r="${w * 0.45}" fill="none" stroke="${PALETTE.warmOrb}" stroke-width="3"/>
      <circle cx="${w / 2}" cy="${h * 0.42}" r="${w * 0.18}" fill="${PALETTE.warmOrb}" opacity="0.85"/>
    `);
  }],

  // scenes (背景图，宽屏)
  'assets/images/scenes/bedroom.svg': [390, 844, (w, h) => svg(w, h, `
    <rect width="${w}" height="${h}" fill="${PALETTE.nightSky}"/>
    <rect x="0" y="${h * 0.6}" width="${w}" height="${h * 0.4}" fill="${PALETTE.deepBlue}" opacity="0.7"/>
    <rect x="${w * 0.1}" y="${h * 0.55}" width="${w * 0.8}" height="${h * 0.25}" fill="${PALETTE.twilight}" opacity="0.8"/>
    <circle cx="${w * 0.75}" cy="${h * 0.25}" r="${w * 0.12}" fill="${PALETTE.warmOrb}" opacity="0.6"/>
    <rect x="${w * 0.3}" y="${h * 0.7}" width="${w * 0.4}" height="${h * 0.05}" fill="${PALETTE.warmOrb}" opacity="0.4"/>
    ${label('我的睡前小屋', w, h)}
  `)],
  'assets/images/scenes/rain_courtyard.svg': [390, 844, (w, h) => svg(w, h, `
    <rect width="${w}" height="${h}" fill="${PALETTE.nightSky}"/>
    <rect x="0" y="${h * 0.7}" width="${w}" height="${h * 0.3}" fill="${PALETTE.deepBlue}"/>
    ${Array.from({ length: 30 }).map(() => `<line x1="${Math.random() * w}" y1="0" x2="${Math.random() * w}" y2="${h * 0.5}" stroke="${PALETTE.textMuted}" stroke-width="1" opacity="0.5"/>`).join('')}
    <circle cx="${w * 0.3}" cy="${h * 0.18}" r="${w * 0.05}" fill="${PALETTE.warmOrb}" opacity="0.7"/>
    ${label('雨夜小院', w, h)}
  `)],

  // sounds（沿用 icons 风格：圆 + 标签）
  'assets/images/sounds/fireplace.svg': [120, 120, (w, h) => svg(w, h, `
    <circle cx="${w / 2}" cy="${h * 0.55}" r="${w * 0.32}" fill="#ff7a3a" opacity="0.75"/>
    <path d="M${w * 0.5} ${h * 0.3} q-5 12 0 22 q5 -10 0 -22 z" fill="#ffd28a"/>
    ${label('壁炉', w, h * 0.95)}
  `)],
  'assets/images/sounds/rain_light.svg': [120, 120, (w, h) => svg(w, h, `
    ${Array.from({ length: 18 }).map((_, i) => `<line x1="${20 + (i % 6) * 14}" y1="${15 + Math.floor(i / 6) * 22}" x2="${14 + (i % 6) * 14}" y2="${28 + Math.floor(i / 6) * 22}" stroke="#7eb3ff" stroke-width="2" stroke-linecap="round" opacity="0.8"/>`).join('')}
    ${label('小雨', w, h * 0.95)}
  `)],
  'assets/images/sounds/forest_night.svg': [120, 120, (w, h) => svg(w, h, `
    <circle cx="${w * 0.7}" cy="${h * 0.25}" r="10" fill="${PALETTE.warmOrb}"/>
    <path d="M${w * 0.2} ${h * 0.8} l${w * 0.15} -${h * 0.55} l${w * 0.15} ${h * 0.55} z" fill="#3a5d3e" opacity="0.85"/>
    <path d="M${w * 0.55} ${h * 0.8} l${w * 0.15} -${h * 0.6} l${w * 0.15} ${h * 0.6} z" fill="#466f4a" opacity="0.9"/>
    ${label('夜晚森林', w, h * 0.95)}
  `)],
  'assets/images/sounds/thunder.svg': [120, 120, (w, h) => svg(w, h, `
    <path d="M${w * 0.5} ${h * 0.2} l-${w * 0.15} ${h * 0.35} h${w * 0.12} l-${w * 0.1} ${h * 0.3} h${w * 0.18} l-${w * 0.18} ${h * 0.25} h${w * 0.12} l-${w * 0.05} ${h * 0.1}" fill="${PALETTE.warmOrb}" stroke="${PALETTE.nightSky}" stroke-width="2" stroke-linejoin="round"/>
    ${label('远雷', w, h * 0.95)}
  `)],
  'assets/images/sounds/page_turn.svg': [120, 120, (w, h) => svg(w, h, `
    <path d="M${w * 0.3} ${h * 0.25} h${w * 0.4} v${h * 0.5} h-${w * 0.4} z" fill="#e6dccf" stroke="#8a7a5a"/>
    <path d="M${w * 0.3} ${h * 0.25} h${w * 0.4} l${w * 0.08} -${w * 0.05} v${h * 0.55} l-${w * 0.08} -${w * 0.05}" fill="#f3ebd9" stroke="#8a7a5a"/>
    ${label('翻书声', w, h * 0.95)}
  `)],
  'assets/images/sounds/keyboard.svg': [120, 120, (w, h) => svg(w, h, `
    <rect x="${w * 0.15}" y="${h * 0.4}" width="${w * 0.7}" height="${h * 0.25}" rx="4" fill="#5a6b85" stroke="#2d3a55" stroke-width="2"/>
    ${Array.from({ length: 3 }).flatMap((_, r) => Array.from({ length: 4 }).map((_, c) => `<rect x="${w * 0.2 + c * w * 0.15}" y="${h * 0.43 + r * h * 0.06}" width="${w * 0.1}" height="${h * 0.04}" rx="2" fill="#cbd6ed"/>`)).join('')}
    ${label('轻键盘', w, h * 0.95)}
  `)],
  'assets/images/sounds/blanket.svg': [120, 120, (w, h) => svg(w, h, `
    <path d="M${w * 0.2} ${h * 0.35} q${w * 0.3} ${h * 0.15} ${w * 0.6} 0 v${h * 0.45} q-${w * 0.3} ${h * 0.1} -${w * 0.6} 0 z" fill="#b8967a" opacity="0.85"/>
    ${Array.from({ length: 5 }).map((_, i) => `<path d="M${w * 0.2 + i * w * 0.12} ${h * 0.4} q0 ${h * 0.05} ${w * 0.02} ${h * 0.3}" stroke="#8a6b54" stroke-width="1.5" fill="none" opacity="0.6"/>`).join('')}
    ${label('被子摩擦', w, h * 0.95)}
  `)],
  'assets/images/sounds/room_tone.svg': [120, 120, (w, h) => svg(w, h, `
    <rect x="${w * 0.25}" y="${h * 0.4}" width="${w * 0.5}" height="${h * 0.35}" fill="#6a7a9a" opacity="0.5"/>
    <rect x="${w * 0.3}" y="${h * 0.45}" width="${w * 0.4}" height="${h * 0.2}" fill="#a4b4d4" opacity="0.7"/>
    ${label('室内底噪', w, h * 0.95)}
  `)],
  'assets/images/sounds/wood_fire.svg': [120, 120, (w, h) => svg(w, h, `
    <rect x="${w * 0.3}" y="${h * 0.6}" width="${w * 0.4}" height="${h * 0.15}" fill="#6b4a2a"/>
    <circle cx="${w / 2}" cy="${h * 0.5}" r="${w * 0.18}" fill="#ff9447" opacity="0.8"/>
    ${label('柴火', w, h * 0.95)}
  `)],
  'assets/images/sounds/stream.svg': [120, 120, (w, h) => svg(w, h, `
    <path d="M${w * 0.2} ${h * 0.3} q${w * 0.15} ${h * 0.1} ${w * 0.3} 0 t${w * 0.3} 0 v${h * 0.5} q-${w * 0.15} -${h * 0.1} -${w * 0.3} 0 t-${w * 0.3} 0 z" fill="#7eb3ff" opacity="0.7"/>
    ${label('溪流', w, h * 0.95)}
  `)],
  'assets/images/sounds/wind_soft.svg': [120, 120, (w, h) => svg(w, h, `
    ${Array.from({ length: 4 }).map((_, i) => `<path d="M${w * 0.15} ${h * (0.3 + i * 0.15)} q${w * 0.2} -${h * 0.05} ${w * 0.4} 0 t${w * 0.25} 0" stroke="#a4b4d4" stroke-width="2" fill="none" opacity="0.6"/>`).join('')}
    ${label('微风', w, h * 0.95)}
  `)],
  'assets/images/sounds/rain_window.svg': [120, 120, (w, h) => svg(w, h, `
    <rect x="${w * 0.2}" y="${h * 0.2}" width="${w * 0.6}" height="${h * 0.6}" fill="#1a3a72" stroke="#5a6b85" stroke-width="2"/>
    ${Array.from({ length: 10 }).map(() => `<line x1="${w * 0.25 + Math.random() * w * 0.5}" y1="${h * 0.25}" x2="${w * 0.22 + Math.random() * w * 0.55}" y2="${h * 0.75}" stroke="#7eb3ff" stroke-width="1.5" opacity="0.7"/>`).join('')}
    ${label('窗边雨声', w, h * 0.95)}
  `)],

  // content（故事封面）
  'assets/images/content/adult_rain_window.svg': [240, 320, (w, h) => svg(w, h, `
    <rect width="${w}" height="${h}" fill="${PALETTE.nightSky}"/>
    <rect x="${w * 0.15}" y="${h * 0.25}" width="${w * 0.7}" height="${h * 0.5}" fill="${PALETTE.twilight}" stroke="${PALETTE.warmOrb}" stroke-width="2"/>
    ${Array.from({ length: 12 }).map(() => `<line x1="${w * 0.2 + Math.random() * w * 0.6}" y1="${h * 0.3}" x2="${w * 0.18 + Math.random() * w * 0.65}" y2="${h * 0.7}" stroke="${PALETTE.textMuted}" stroke-width="1.5"/>`).join('')}
    ${label('窗边听雨\n成人 · 4 分钟', w, h, '')}
  `)],
  'assets/images/content/adult_quiet_room.svg': [240, 320, (w, h) => svg(w, h, `
    <rect width="${w}" height="${h}" fill="${PALETTE.deepBlue}"/>
    <rect x="0" y="${h * 0.65}" width="${w}" height="${h * 0.35}" fill="${PALETTE.nightSky}"/>
    <circle cx="${w * 0.3}" cy="${h * 0.3}" r="${w * 0.08}" fill="${PALETTE.warmOrb}" opacity="0.8"/>
    ${label('静室入夜\n成人 · 9 分钟', w, h)}
  `)],
  'assets/images/content/adult_warm_tea.svg': [240, 320, (w, h) => svg(w, h, `
    <rect width="${w}" height="${h}" fill="${PALETTE.nightSky}"/>
    <path d="M${w * 0.35} ${h * 0.55} h${w * 0.3} v${h * 0.2} q-${w * 0.15} ${h * 0.08} -${w * 0.3} 0 z" fill="#c4906a" stroke="#8a5a3a"/>
    <path d="M${w * 0.65} ${h * 0.6} q${w * 0.08} 0 ${w * 0.08} ${h * 0.1} q0 ${h * 0.1} -${w * 0.08} ${h * 0.1}" fill="none" stroke="#8a5a3a" stroke-width="3"/>
    <path d="M${w * 0.5} ${h * 0.45} q-${w * 0.05} -${h * 0.1} 0 -${h * 0.2} q${w * 0.05} ${h * 0.1} 0 ${h * 0.2}" fill="${PALETTE.textMuted}" opacity="0.6"/>
    ${label('暖茶时光\n成人 · 4 分钟', w, h)}
  `)],
  'assets/images/content/child_star_blanket.svg': [240, 320, (w, h) => svg(w, h, `
    <rect width="${w}" height="${h}" fill="#2a3a72"/>
    ${Array.from({ length: 14 }).map(() => `<circle cx="${Math.random() * w}" cy="${Math.random() * h * 0.6}" r="${Math.random() * 2 + 1}" fill="${PALETTE.warmOrb}" opacity="0.8"/>`).join('')}
    <path d="M${w * 0.25} ${h * 0.65} q${w * 0.25} -${h * 0.05} ${w * 0.5} 0 v${h * 0.2} q-${w * 0.25} -${h * 0.05} -${w * 0.5} 0 z" fill="#a47864" opacity="0.85"/>
    ${label('星星和小毯子\n儿童 · 5 分钟', w, h)}
  `)],
  'assets/images/content/child_small_garden.svg': [240, 320, (w, h) => svg(w, h, `
    <rect width="${w}" height="${h}" fill="#3a5d3e"/>
    <circle cx="${w * 0.7}" cy="${h * 0.2}" r="${w * 0.1}" fill="${PALETTE.warmOrb}"/>
    <circle cx="${w * 0.25}" cy="${h * 0.35}" r="8" fill="#ff9aa8"/>
    <circle cx="${w * 0.4}" cy="${h * 0.4}" r="6" fill="#ffd28a"/>
    <circle cx="${w * 0.55}" cy="${h * 0.38}" r="5" fill="#c5a8e4"/>
    ${label('小小花园的晚安\n儿童 · 4 分钟', w, h)}
  `)],
  'assets/images/content/breath_relax.svg': [240, 320, (w, h) => svg(w, h, `
    <rect width="${w}" height="${h}" fill="${PALETTE.twilight}"/>
    <circle cx="${w / 2}" cy="${h / 2}" r="${w * 0.3}" fill="none" stroke="${PALETTE.warmOrb}" stroke-width="3" opacity="0.8"/>
    <circle cx="${w / 2}" cy="${h / 2}" r="${w * 0.15}" fill="${PALETTE.warmOrb}" opacity="0.4"/>
    ${label('睡前两分钟呼吸', w, h)}
  `)],

  // prototype_images（实际写到 public/prototype_images/ 下，对应 CSS url("prototype_images/...") 的相对路径）
  'public/prototype_images/home_atmosphere_cutout_v1.svg': [390, 600, (w, h) => svg(w, h, `
    <rect width="${w}" height="${h}" fill="${PALETTE.nightSky}"/>
    <circle cx="${w * 0.5}" cy="${h * 0.4}" r="${w * 0.5}" fill="${PALETTE.twilight}" opacity="0.6"/>
    ${Array.from({ length: 30 }).map(() => `<circle cx="${Math.random() * w}" cy="${Math.random() * h * 0.6}" r="${Math.random() * 2 + 0.5}" fill="${PALETTE.warmOrb}" opacity="0.7"/>`).join('')}
    <circle cx="${w * 0.3}" cy="${h * 0.2}" r="${w * 0.08}" fill="${PALETTE.warmOrb}" opacity="0.9"/>
  `)],
  'public/prototype_images/home_island_cutout_v1.svg': [390, 400, (w, h) => svg(w, h, `
    <rect width="${w}" height="${h}" fill="transparent"/>
    <ellipse cx="${w / 2}" cy="${h * 0.7}" rx="${w * 0.4}" ry="${h * 0.18}" fill="${PALETTE.deepBlue}"/>
    <path d="M${w * 0.25} ${h * 0.7} q${w * 0.25} -${h * 0.5} ${w * 0.5} 0 z" fill="${PALETTE.twilight}"/>
    <rect x="${w * 0.46}" y="${h * 0.5}" width="${w * 0.08}" height="${h * 0.2}" fill="${PALETTE.nightSky}" stroke="${PALETTE.warmOrb}" stroke-width="1.5"/>
  `)],
  'public/prototype_images/home_door_open_overlay_v1.svg': [120, 200, (w, h) => svg(w, h, `
    <rect width="${w}" height="${h}" fill="transparent"/>
    <rect x="${w * 0.2}" y="${h * 0.2}" width="${w * 0.6}" height="${h * 0.7}" fill="${PALETTE.warmOrb}" opacity="0.3"/>
  `)],
  'public/prototype_images/home_settings_clock_v1.svg': [120, 120, (w, h) => svg(w, h, `
    <circle cx="${w / 2}" cy="${h / 2}" r="${w * 0.4}" fill="${PALETTE.deepBlue}" stroke="${PALETTE.warmOrb}" stroke-width="2"/>
    <line x1="${w / 2}" y1="${h / 2}" x2="${w / 2}" y2="${h * 0.25}" stroke="${PALETTE.warmOrb}" stroke-width="3" stroke-linecap="round"/>
    <line x1="${w / 2}" y1="${h / 2}" x2="${w * 0.7}" y2="${h / 2}" stroke="${PALETTE.warmOrb}" stroke-width="3" stroke-linecap="round"/>
    <circle cx="${w / 2}" cy="${h / 2}" r="3" fill="${PALETTE.warmOrb}"/>
  `)],
  'public/prototype_images/paper_cut_night_landscape_v1.svg': [390, 700, (w, h) => svg(w, h, `
    <rect width="${w}" height="${h}" fill="${PALETTE.nightSky}"/>
    <path d="M0 ${h * 0.7} q${w * 0.25} -${h * 0.1} ${w * 0.5} 0 t${w * 0.5} 0 v${h * 0.3} h-${w} z" fill="${PALETTE.deepBlue}" opacity="0.7"/>
    <path d="M0 ${h * 0.85} q${w * 0.3} -${h * 0.08} ${w * 0.6} 0 t${w * 0.4} 0 v${h * 0.15} h-${w} z" fill="${PALETTE.twilight}" opacity="0.8"/>
    <circle cx="${w * 0.7}" cy="${h * 0.25}" r="${w * 0.08}" fill="${PALETTE.warmOrb}" opacity="0.7"/>
  `)],
  'public/prototype_images/paper_cut_constellation_header_v1.svg': [390, 400, (w, h) => svg(w, h, `
    <rect width="${w}" height="${h}" fill="${PALETTE.nightSky}"/>
    ${Array.from({ length: 40 }).map(() => `<circle cx="${Math.random() * w}" cy="${Math.random() * h}" r="${Math.random() * 1.5 + 0.5}" fill="${PALETTE.textLight}" opacity="${Math.random() * 0.5 + 0.3}"/>`).join('')}
    <line x1="${w * 0.2}" y1="${h * 0.3}" x2="${w * 0.35}" y2="${h * 0.45}" stroke="${PALETTE.warmOrb}" stroke-width="1" opacity="0.5"/>
    <line x1="${w * 0.35}" y1="${h * 0.45}" x2="${w * 0.5}" y2="${h * 0.35}" stroke="${PALETTE.warmOrb}" stroke-width="1" opacity="0.5"/>
    <line x1="${w * 0.5}" y1="${h * 0.35}" x2="${w * 0.65}" y2="${h * 0.5}" stroke="${PALETTE.warmOrb}" stroke-width="1" opacity="0.5"/>
  `)],
  'public/prototype_images/sound_atlas_outdoor_v1.svg': [390, 400, (w, h) => svg(w, h, `
    <rect width="${w}" height="${h}" fill="${PALETTE.twilight}"/>
    ${Array.from({ length: 15 }).map(() => `<line x1="${Math.random() * w}" y1="0" x2="${Math.random() * w}" y2="${h}" stroke="${PALETTE.textMuted}" stroke-width="1" opacity="0.4"/>`).join('')}
  `)],
  'public/prototype_images/sound_atlas_indoor_v1.svg': [390, 400, (w, h) => svg(w, h, `
    <rect width="${w}" height="${h}" fill="${PALETTE.deepBlue}"/>
    <circle cx="${w * 0.5}" cy="${h * 0.6}" r="${w * 0.25}" fill="${PALETTE.warmOrb}" opacity="0.3"/>
    <circle cx="${w * 0.5}" cy="${h * 0.6}" r="${w * 0.12}" fill="${PALETTE.warmOrb}" opacity="0.6"/>
  `)],
  'public/prototype_images/generated_support_v2/moon_horizon_cutout_v2.svg': [390, 300, (w, h) => svg(w, h, `
    <circle cx="${w * 0.3}" cy="${h * 0.5}" r="${w * 0.18}" fill="${PALETTE.warmOrb}" opacity="0.95"/>
    <circle cx="${w * 0.35}" cy="${h * 0.45}" r="${w * 0.16}" fill="${PALETTE.nightSky}" opacity="0.7"/>
    <path d="M0 ${h * 0.75} q${w * 0.3} -${h * 0.05} ${w * 0.6} 0 t${w * 0.4} 0 v${h * 0.25} h-${w} z" fill="${PALETTE.deepBlue}" opacity="0.7"/>
  `)],
  'public/prototype_images/generated_support_v2/constellation_cutout_v2.svg': [240, 300, (w, h) => svg(w, h, `
    <rect width="${w}" height="${h}" fill="transparent"/>
    ${Array.from({ length: 25 }).map(() => `<circle cx="${Math.random() * w}" cy="${Math.random() * h}" r="${Math.random() * 1.5 + 0.5}" fill="${PALETTE.warmOrb}" opacity="${Math.random() * 0.5 + 0.4}"/>`).join('')}
    <line x1="${w * 0.3}" y1="${h * 0.3}" x2="${w * 0.5}" y2="${h * 0.45}" stroke="${PALETTE.warmOrb}" stroke-width="1" opacity="0.6"/>
    <line x1="${w * 0.5}" y1="${h * 0.45}" x2="${w * 0.7}" y2="${h * 0.4}" stroke="${PALETTE.warmOrb}" stroke-width="1" opacity="0.6"/>
  `)],
  'public/prototype_images/generated_support_v2/points_cavern_cutout_v3.svg': [240, 240, (w, h) => svg(w, h, `
    <rect width="${w}" height="${h}" fill="${PALETTE.nightSky}"/>
    <ellipse cx="${w * 0.5}" cy="${h * 0.7}" rx="${w * 0.5}" ry="${h * 0.4}" fill="${PALETTE.twilight}"/>
    <circle cx="${w * 0.3}" cy="${h * 0.3}" r="${w * 0.06}" fill="${PALETTE.warmOrb}" opacity="0.8"/>
    <circle cx="${w * 0.65}" cy="${h * 0.25}" r="${w * 0.04}" fill="${PALETTE.warmOrb}" opacity="0.6"/>
  `)],
  'public/prototype_images/generated_support_v2/privacy_lotus_cutout_v2.svg': [240, 240, (w, h) => svg(w, h, `
    <rect width="${w}" height="${h}" fill="transparent"/>
    ${Array.from({ length: 8 }).map((_, i) => `<ellipse cx="${w / 2}" cy="${h * 0.6}" rx="${w * 0.05}" ry="${h * 0.3}" fill="${PALETTE.warmOrb}" opacity="${0.3 + i * 0.08}" transform="rotate(${i * 45} ${w / 2} ${h * 0.6})"/>`).join('')}
  `)],
  'public/prototype_images/generated_support_v2/onboarding_portal_cutout_v2.svg': [240, 240, (w, h) => svg(w, h, `
    <rect width="${w}" height="${h}" fill="transparent"/>
    <ellipse cx="${w / 2}" cy="${h / 2}" rx="${w * 0.4}" ry="${h * 0.4}" fill="none" stroke="${PALETTE.warmOrb}" stroke-width="2" opacity="0.6"/>
    <ellipse cx="${w / 2}" cy="${h / 2}" rx="${w * 0.25}" ry="${h * 0.25}" fill="none" stroke="${PALETTE.warmOrb}" stroke-width="2" opacity="0.8"/>
    <circle cx="${w / 2}" cy="${h / 2}" r="${w * 0.08}" fill="${PALETTE.warmOrb}" opacity="0.9"/>
  `)],
};

let count_ = 0;
let failed = [];
for (const [relPath, [w, h, generator]] of Object.entries(FILES)) {
  const fullPath = join(ROOT, relPath);
  try {
    mkdirSync(fullPath.replace(/[^/\\]+$/, ''), { recursive: true });
    writeFileSync(fullPath, generator(w, h), 'utf8');
    count_++;
  } catch (e) {
    failed.push({ path: fullPath, error: e.message });
  }
}
console.log(`generated ${count_} SVG files`);
console.log('ROOT =', ROOT);
const sample = join(ROOT, 'images/brand/app_icon.svg');
console.log('sample =', sample, 'exists?', existsSync(sample));
if (failed.length) {
  console.log('FAILED:');
  for (const f of failed) console.log(' -', f.path, ':', f.error);
}