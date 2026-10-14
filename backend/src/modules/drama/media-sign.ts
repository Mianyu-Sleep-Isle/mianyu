import { createHmac, timingSafeEqual } from 'node:crypto';

export const MEDIA_FILE_NAME = /^(final\.mp4|cover\.jpg|subtitles\.vtt|character\.png|shot-\d{3}\.jpg|thumb-\d{3}\.jpg)$/;
export const MEDIA_JOB_ID = /^[A-Za-z0-9-]{1,80}$/;

export function mediaType(fileName: string): string {
  if (fileName === 'final.mp4') return 'video/mp4';
  if (fileName === 'subtitles.vtt') return 'text/vtt; charset=utf-8';
  if (fileName === 'character.png') return 'image/png';
  return 'image/jpeg';
}

export function signMedia(secret: string, jobId: string, fileName: string, exp: number): string {
  return createHmac('sha256', secret).update(`${jobId}/${fileName}:${exp}`).digest('hex');
}

export function mediaPath(jobId: string, fileName: string, exp: number, sig: string): string {
  return `/api/v1/drama/media/${jobId}/${fileName}?exp=${exp}&sig=${sig}`;
}

export function verifyMedia(secret: string, jobId: string, fileName: string, expRaw: string | undefined, sig: string | undefined): boolean {
  if (!MEDIA_JOB_ID.test(jobId) || !MEDIA_FILE_NAME.test(fileName) || !expRaw || !sig || !/^\d+$/.test(expRaw)) return false;
  const exp = Number(expRaw);
  if (!Number.isSafeInteger(exp) || exp < Math.floor(Date.now() / 1000)) return false;
  const expected = Buffer.from(signMedia(secret, jobId, fileName, exp));
  const actual = Buffer.from(sig);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
