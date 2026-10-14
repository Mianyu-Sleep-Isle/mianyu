import { execFile } from 'node:child_process';
import { existsSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { ProviderError } from './types.ts';

const exec = promisify(execFile);

export function formatTimestamp(seconds: number): string {
  const total = Math.max(0, Math.round(seconds * 1000));
  const hours = Math.floor(total / 3_600_000);
  const minutes = Math.floor((total % 3_600_000) / 60_000);
  const secs = Math.floor((total % 60_000) / 1000);
  const millis = total % 1000;
  const pad = (value: number, size = 2) => String(value).padStart(size, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(secs)}.${pad(millis, 3)}`;
}

export function webvtt(shots: Array<{ narrationText: string; startSec: number; durationSec: number }>): string {
  const cues = shots.map((shot, index) => {
    const start = formatTimestamp(shot.startSec);
    const end = formatTimestamp(shot.startSec + shot.durationSec);
    return `${index + 1}\n${start} --> ${end}\n${shot.narrationText}`;
  });
  return `WEBVTT\n\n${cues.join('\n\n')}\n`;
}

export function srt(shots: Array<{ narrationText: string; startSec: number; durationSec: number }>): string {
  const cues = shots.map((shot, index) => {
    const start = formatTimestamp(shot.startSec).replace('.', ',');
    const end = formatTimestamp(shot.startSec + shot.durationSec).replace('.', ',');
    return `${index + 1}\n${start} --> ${end}\n${shot.narrationText}`;
  });
  return `${cues.join('\n\n')}\n`;
}

export function zoomExpression(motion: string, frames: number): { z: string; x: string; y: string } {
  const centerX = 'iw/2-(iw/zoom/2)';
  const centerY = 'ih/2-(ih/zoom/2)';
  if (motion === 'zoom_in') return { z: 'min(1.08,1+0.0006*on)', x: centerX, y: centerY };
  if (motion === 'zoom_out') return { z: 'max(1,1.08-0.0006*on)', x: centerX, y: centerY };
  if (motion === 'pan') return { z: '1.05', x: `(iw-iw/zoom)*on/${Math.max(1, frames)}`, y: centerY };
  return { z: '1', x: centerX, y: centerY };
}

export function encodeArgs(): string[] {
  return ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p', '-r', '30', '-c:a', 'aac', '-b:a', '128k', '-ac', '2', '-ar', '44100', '-movflags', '+faststart'];
}

export function clipFilter(motion: string, durationSec: number): string {
  const frames = Math.max(1, Math.round(durationSec * 30));
  const zoom = zoomExpression(motion, frames);
  const fadeOut = Math.max(0, durationSec - 0.4);
  return [
    'scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280',
    `zoompan=z='${zoom.z}':x='${zoom.x}':y='${zoom.y}':d=${frames}:s=720x1280:fps=30`,
    `fade=t=in:st=0:d=0.4,fade=t=out:st=${fadeOut.toFixed(3)}:d=0.4`,
    'format=yuv420p',
  ].join(',');
}

export async function assertFfmpeg(ffmpegPath: string): Promise<boolean> {
  try {
    await exec(ffmpegPath, ['-version']);
    return true;
  } catch {
    return false;
  }
}

export function subtitleFontReady(fontPath: string): boolean {
  return existsSync(fontPath);
}

export async function composeWithFfmpeg(ffmpegPath: string, input: {
  jobDir: string;
  shots: Array<{ order: number; durationSec: number; cameraMotion: string; narrationText: string }>;
  fontPath?: string;
}): Promise<{ durationSec: number; sizeBytes: number }> {
  if (!await assertFfmpeg(ffmpegPath)) throw new ProviderError('VIDEO_COMPOSITION_FAILED', '视频合成失败');
  let cursor = 0;
  const cues = input.shots.map((shot) => {
    const cue = { narrationText: shot.narrationText, startSec: cursor, durationSec: shot.durationSec };
    cursor += shot.durationSec;
    return cue;
  });
  writeFileSync(path.join(input.jobDir, 'subtitles.vtt'), webvtt(cues), 'utf8');
  writeFileSync(path.join(input.jobDir, 'subtitles.srt'), srt(cues), 'utf8');
  const burn = input.fontPath && subtitleFontReady(input.fontPath)
    ? `,subtitles='${path.join(input.jobDir, 'subtitles.srt').replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'")}' :force_style='FontName=Noto Sans SC,FontSize=18,Alignment=2,MarginV=40'`
    : '';
  if (!burn) console.error('subtitle_font_missing');
  const clips: string[] = [];
  let durationSec = 0;
  for (const shot of input.shots) {
    const order = String(shot.order).padStart(3, '0');
    const clip = path.join(input.jobDir, `clip-${order}.mp4`);
    const image = path.join(input.jobDir, `shot-${order}.jpg`);
    const audio = path.join(input.jobDir, `voice-${order}.wav`);
    await exec(ffmpegPath, ['-y', '-loop', '1', '-i', image, '-i', audio, '-vf', `${clipFilter(shot.cameraMotion, shot.durationSec)}${burn}`, '-t', String(shot.durationSec), ...encodeArgs(), clip], { windowsHide: true });
    clips.push(clip);
    durationSec += shot.durationSec;
  }
  const list = path.join(input.jobDir, 'concat.txt');
  writeFileSync(list, clips.map((clip) => `file '${clip.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n'));
  const finalPath = path.join(input.jobDir, 'final.mp4');
  await exec(ffmpegPath, ['-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', finalPath], { windowsHide: true });
  const probed = await probeDuration(finalPath);
  return { durationSec: probed ?? durationSec, sizeBytes: statSync(finalPath).size };
}

async function probeDuration(file: string): Promise<number | null> {
  try {
    const { stdout } = await exec('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { windowsHide: true, encoding: 'utf8' });
    const value = Number(String(stdout).trim());
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}
