// 批量把 prototype_preview.html / prototype_preview_v2.html / mock-adapters.js
// 里所有 assets/images/{dir}/{name}.png 改成 .svg
import { readFileSync, writeFileSync } from 'node:fs';

const targets = [
  'E:/助眠/mianyu-integration-all-branches/mianyu-integration-all-branches/public/prototype_preview.html',
  'E:/助眠/mianyu-integration-all-branches/mianyu-integration-all-branches/public/prototype_preview_v2.html',
  'E:/助眠/mianyu-integration-all-branches/mianyu-integration-all-branches/public/frontend-api/mock-adapters.js',
];

for (const file of targets) {
  const before = readFileSync(file, 'utf8');
  const after = before.replace(/assets\/images\/([a-z]+)\/([a-z0-9_]+)\.png/gi, 'assets/images/$1/$2.svg');
  if (before === after) { console.log(`[no-change] ${file}`); continue; }
  writeFileSync(file, after, 'utf8');
  const changes = (before.match(/\.png/g) || []).length - (after.match(/\.png/g) || []).length;
  console.log(`[ok] ${file}: ${changes} png→svg`);
}