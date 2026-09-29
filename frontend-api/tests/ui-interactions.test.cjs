const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const page = fs.readFileSync(path.join(root, 'system_preview.html'), 'utf8');
const appPages = fs.readFileSync(path.join(root, 'app_pages.js'), 'utf8');

test('场景编辑器保留可发现的点击与长按替代操作', () => {
  for (const marker of ['trackControl', 'placement-hint', 'scene-trash', 'installLongPressDrag', 'installPlacedMove', 'installSoundScrollbar', '拖入删除', '方向键也可微调位置']) {
    assert.ok(page.includes(marker), `Missing editor interaction marker: ${marker}`);
  }
  assert.equal(page.includes('class="entity-remove"'), false, 'Placed entities must not render a corner remove button');
});

test('时长、未保存返回与播放退出路径保持明确', () => {
  assert.ok(page.includes('1–120 分钟'));
  assert.ok(page.includes('保存本次修改？'));
  assert.ok(appPages.includes("navigate('sceneView',false)"));
  assert.ok(appPages.includes('结束并返回编辑'));
});

test('儿童模式、PIN 与完成反馈具有稳定状态', () => {
  assert.ok(appPages.includes("pinMode:'verify'"));
  assert.ok(appPages.includes("pattern=\"[0-9]*\""));
  assert.ok(appPages.includes('本次反馈已经保存'));
  assert.ok(appPages.includes('每次播放会话只记录一份反馈'));
});
