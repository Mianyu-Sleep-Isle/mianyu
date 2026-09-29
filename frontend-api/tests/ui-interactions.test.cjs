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
  assert.match(page, /function showDragPreview\([^)]*\)\{clearTimeout\(placementHintTimer\);placementHintTimer=null;placementHintId=item.id;renderPlaced\(\)/, 'Long press must reuse the exact tap-hint position');
  assert.ok(page.includes('.drag-guide,.drag-overlay.active .drag-preview{display:none}'), 'The legacy movable ghost must stay hidden');
  assert.equal(page.includes('.drag-overlay.active .drag-chip{display:none}'), false, 'The small drag card must follow the finger until release');
  assert.ok(page.includes('sceneRect=dropZone.getBoundingClientRect(),overlayRect=app.getBoundingClientRect()'), 'Drag coordinates must use the visible app canvas');
  assert.ok(page.includes('function point(event){const rect=app.getBoundingClientRect()'), 'Long press must start the drag card at the pressed card position');
  assert.ok(page.includes('.drag-overlay{position:absolute;z-index:4;inset:0'), 'The drag card coordinate layer must cover the full phone canvas');
  assert.ok(page.includes("window.addEventListener('pointermove'"), 'Drag tracking must survive the sound sheet moving away');
  assert.ok(page.includes("window.addEventListener('pointerup',finish,true)"), 'Drop completion must be observed across the whole window');
  assert.ok(page.includes('function sceneDropPoint(clientX,clientY)'), 'The visible scene must expose one shared drop hit test');
  assert.ok(page.includes('existingIndex=placed.findIndex(entry=>entry.id===item.id)'), 'Re-dropping a sound must reposition its existing entity instead of stacking duplicates');
  assert.ok(page.includes('showToast(`${item.name}位置已更新`)'), 'Repositioning an existing entity must give explicit feedback');
  assert.ok(page.includes('function suppressNextClick(){skipNextClick=true;clearTimeout(skipClickTimer);skipClickTimer=setTimeout(()=>{skipNextClick=false},360)}'), 'Suppressed drag clicks must expire instead of blocking a later sound card');
  assert.equal(page.includes('state.timer=null;skipNextClick=true'), false, 'Horizontal sound-list scrolling must not leave the next card click blocked');
  assert.equal(page.includes('建议放在这里'), false, 'Placement guidance should use only the visual ghost without a text label');
  assert.equal(page.includes('.placement-hint span{'), false, 'Removed placement hint text must not leave dead label styling');
  assert.ok(page.includes("A02:{w:'min(56vw,230px)',h:'min(41vh,230px)',x:68,y:35"), 'Rain-window entity should fit the background window');
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
