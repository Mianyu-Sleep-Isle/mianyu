import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import express from 'express';
import { allowAsset, FAKE_DISPLAY_ASSET_IDS, FakeContentCatalog, FakePlanQuery, registerDisplayAssets } from './fakes.ts';
import { SceneRepository } from './repository.ts';
import { createSceneRouter } from './routes.ts';
import { SceneService } from './service.ts';
import { SceneError, type SceneAudioSource, type SceneSnapshot, type SceneSnapshotInput } from './types.ts';

const USER = 'user-1';
const OTHER = 'user-2';
const PLAN_ID = '11111111-1111-4111-8111-111111111111';
const PRESET_ID = '22222222-2222-4222-8222-222222222222';
const ASSET_A = '33333333-3333-4333-8333-333333333333';
const ASSET_B = '44444444-4444-4444-8444-444444444444';
const SOURCE_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const SOURCE_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2';
const MISSING = '99999999-9999-4999-8999-999999999999';

function openSceneDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../../../migrations/300_module3.sql', import.meta.url), 'utf8'));
  return db;
}

function countRows(db: DatabaseSync, sql: string, ...params: Array<string | number>): number {
  return Number((db.prepare(sql).get(...params) as { count: number }).count);
}

function assertSceneError(error: unknown, code: string, status: number): true {
  assert.ok(error instanceof SceneError);
  assert.equal(error.code, code);
  assert.equal(error.status, status);
  return true;
}

function source(sourceId: string, assetId: string, enabled = true): SceneAudioSource {
  return {
    sourceId,
    assetId,
    spaceType: sourceId === SOURCE_B ? 'outdoor' : 'indoor',
    volume: sourceId === SOURCE_B ? 1 : 0,
    loopMode: sourceId === SOURCE_B ? 'intermittent' : 'loop',
    fadeInSec: 0,
    fadeOutSec: 4,
    enabled,
  };
}

function snapshotInput(): SceneSnapshotInput {
  return {
    spaceType: 'indoor',
    environmentType: 'forest',
    reverbType: 'outdoor_open',
    sources: [source(SOURCE_B, ASSET_B, false), source(SOURCE_A, ASSET_A, true)],
    elements: [
      { clientElementId: 'tree', assetId: ASSET_B, sourceId: SOURCE_B, spaceType: 'outdoor', positionX: 1, positionY: 0, scale: 1.25, zOrder: 3 },
      { clientElementId: 'lamp', assetId: ASSET_A, sourceId: null, spaceType: 'indoor', positionX: 0, positionY: 1, scale: 0.5, zOrder: 0 },
    ],
  };
}

test('空草稿创建后可以按所有权读取', () => {
  const db = openSceneDb();
  try {
    const repo = new SceneRepository(db);
    const created = repo.createDraft(USER, {
      sourcePlanId: PLAN_ID,
      spaceType: 'outdoor',
      environmentType: 'bedroom',
      reverbType: 'indoor_soft',
    }, '2026-09-30T00:00:00.000Z');
    assert.equal(created.sceneConfigId, created.sceneFamilyId);
    assert.equal(created.configVersion, 1);
    assert.equal(created.previousVersionId, null);
    assert.equal(created.status, 'draft');
    assert.equal(created.sourcePlanId, PLAN_ID);
    assert.equal(created.presetSceneId, null);
    assert.equal(created.handedOffAt, null);
    assert.deepEqual(created.sources, []);
    assert.deepEqual(created.elements, []);
    assert.deepEqual(repo.getOwnedSnapshot(created.sceneConfigId, USER), created);
    const preset = repo.createDraft(USER, {
      presetSceneId: PRESET_ID,
      spaceType: 'indoor',
      environmentType: 'bedroom',
      reverbType: 'indoor_soft',
    }, '2026-09-30T00:01:00.000Z');
    assert.equal(preset.sourcePlanId, null);
    assert.equal(preset.presetSceneId, PRESET_ID);
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  } finally {
    db.close();
  }
});

test('完整快照保存后按稳定顺序恢复，替换不残留旧子项', () => {
  const db = openSceneDb();
  try {
    const repo = new SceneRepository(db);
    const created = repo.createDraft(USER, {
      sourcePlanId: PLAN_ID,
      spaceType: 'indoor',
      environmentType: 'bedroom',
      reverbType: 'indoor_soft',
    }, '2026-09-30T01:00:00.000Z');
    const saved = repo.replaceDraftSnapshot(created.sceneConfigId, USER, snapshotInput(), '2026-09-30T01:01:00.000Z');
    const reloaded = repo.getOwnedSnapshot(created.sceneConfigId, USER);
    assert.deepEqual(reloaded, saved);
    assert.deepEqual(saved.sources.map((item) => item.sourceId), [SOURCE_A, SOURCE_B]);
    assert.deepEqual(saved.elements.map((item) => item.clientElementId), ['lamp', 'tree']);
    assert.equal(saved.elements[1]?.sourceId, SOURCE_B);
    assert.equal(saved.elements[0]?.sourceId, null);
    assert.equal(saved.spaceType, 'indoor');
    assert.equal(saved.environmentType, 'forest');
    assert.equal(saved.createdAt, created.createdAt);
    assert.equal(saved.updatedAt, '2026-09-30T01:01:00.000Z');
    assert.equal(saved.status, 'draft');
    const replacement: SceneSnapshotInput = {
      spaceType: 'outdoor',
      environmentType: 'seaside',
      reverbType: 'outdoor_open',
      sources: [source(SOURCE_A, ASSET_A, true)],
      elements: [
        { clientElementId: 'shell', assetId: ASSET_A, sourceId: SOURCE_A, spaceType: 'outdoor', positionX: 0.25, positionY: 0.75, scale: 2, zOrder: 1 },
      ],
    };
    repo.replaceDraftSnapshot(created.sceneConfigId, USER, replacement, '2026-09-30T01:02:00.000Z');
    assert.deepEqual(
      (db.prepare('SELECT source_id FROM scene_audio_source WHERE scene_config_id=? ORDER BY source_id').all(created.sceneConfigId) as Array<{ source_id: string }>).map((row) => row.source_id),
      [SOURCE_A],
    );
    assert.deepEqual(
      (db.prepare('SELECT client_element_id FROM scene_element WHERE scene_config_id=?').all(created.sceneConfigId) as Array<{ client_element_id: string }>).map((row) => row.client_element_id),
      ['shell'],
    );
    assert.equal(countRows(db, 'SELECT count(*) AS count FROM scene_audio_source WHERE asset_id=?', ASSET_B), 0);
    assert.equal(countRows(db, 'SELECT count(*) AS count FROM scene_element WHERE client_element_id=?', 'tree'), 0);
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  } finally {
    db.close();
  }
});

test('插入失败后旧快照保持不变', () => {
  const db = openSceneDb();
  try {
    const repo = new SceneRepository(db);
    const created = repo.createDraft(USER, {
      spaceType: 'indoor', environmentType: 'bedroom', reverbType: 'indoor_soft',
    }, '2026-09-30T02:00:00.000Z');
    const saved = repo.replaceDraftSnapshot(created.sceneConfigId, USER, snapshotInput(), '2026-09-30T02:01:00.000Z');
    const broken: SceneSnapshotInput = {
      ...snapshotInput(),
      elements: [
        { clientElementId: 'ghost', assetId: ASSET_A, sourceId: MISSING, spaceType: 'indoor', positionX: 0.2, positionY: 0.2, scale: 1, zOrder: 1 },
      ],
    };
    assert.throws(() => repo.replaceDraftSnapshot(created.sceneConfigId, USER, broken, '2026-09-30T02:02:00.000Z'));
    assert.deepEqual(repo.getOwnedSnapshot(created.sceneConfigId, USER), saved);
    assert.equal(countRows(db, 'SELECT count(*) AS count FROM scene_element WHERE client_element_id=?', 'ghost'), 0);
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  } finally {
    db.close();
  }
});

test('其他人不能读取或修改场景', () => {
  const db = openSceneDb();
  try {
    const repo = new SceneRepository(db);
    const created = repo.createDraft(USER, {
      spaceType: 'indoor', environmentType: 'bedroom', reverbType: 'indoor_soft',
    }, '2026-09-30T03:00:00.000Z');
    const saved = repo.replaceDraftSnapshot(created.sceneConfigId, USER, snapshotInput(), '2026-09-30T03:01:00.000Z');
    assert.throws(() => repo.getOwnedSnapshot(created.sceneConfigId, OTHER), (error) => assertSceneError(error, 'SCENE_FORBIDDEN', 403));
    assert.throws(() => repo.replaceDraftSnapshot(created.sceneConfigId, OTHER, snapshotInput(), '2026-09-30T03:02:00.000Z'), (error) => assertSceneError(error, 'SCENE_FORBIDDEN', 403));
    assert.throws(() => repo.handOff(created.sceneConfigId, OTHER, '2026-09-30T03:03:00.000Z'), (error) => assertSceneError(error, 'SCENE_FORBIDDEN', 403));
    assert.throws(() => repo.copyAsNextVersion(created.sceneConfigId, OTHER, '2026-09-30T03:04:00.000Z'), (error) => assertSceneError(error, 'SCENE_FORBIDDEN', 403));
    assert.throws(() => repo.getOwnedSnapshot(MISSING, OTHER), (error) => assertSceneError(error, 'SCENE_NOT_FOUND', 404));
    assert.deepEqual(repo.getOwnedSnapshot(created.sceneConfigId, USER), saved);
  } finally {
    db.close();
  }
});

test('交接后不能保存，重复交接不更新时间', () => {
  const db = openSceneDb();
  try {
    const repo = new SceneRepository(db);
    const empty = repo.createDraft(USER, {
      spaceType: 'indoor', environmentType: 'bedroom', reverbType: 'indoor_soft',
    }, '2026-09-30T04:00:00.000Z');
    assert.throws(() => repo.handOff(empty.sceneConfigId, USER, '2026-09-30T04:01:00.000Z'), (error) => assertSceneError(error, 'SCENE_NO_ENABLED_SOURCE', 409));
    assert.equal(repo.getOwnedSnapshot(empty.sceneConfigId, USER).status, 'draft');
    const created = repo.createDraft(USER, {
      spaceType: 'indoor', environmentType: 'bedroom', reverbType: 'indoor_soft',
    }, '2026-09-30T04:02:00.000Z');
    repo.replaceDraftSnapshot(created.sceneConfigId, USER, {
      ...snapshotInput(),
      sources: [source(SOURCE_A, ASSET_A, false)],
      elements: [],
    }, '2026-09-30T04:03:00.000Z');
    assert.throws(() => repo.handOff(created.sceneConfigId, USER, '2026-09-30T04:04:00.000Z'), (error) => assertSceneError(error, 'SCENE_NO_ENABLED_SOURCE', 409));
    const ready = repo.replaceDraftSnapshot(created.sceneConfigId, USER, snapshotInput(), '2026-09-30T04:05:00.000Z');
    assert.throws(() => repo.getHandedOffSnapshot(created.sceneConfigId, USER), (error) => assertSceneError(error, 'SCENE_STATUS_CONFLICT', 409));
    const handed = repo.handOff(created.sceneConfigId, USER, '2026-09-30T04:06:00.000Z');
    assert.equal(handed.status, 'handed_off');
    assert.equal(handed.handedOffAt, '2026-09-30T04:06:00.000Z');
    assert.equal(handed.updatedAt, '2026-09-30T04:06:00.000Z');
    assert.deepEqual(handed.sources, ready.sources);
    assert.deepEqual(repo.getHandedOffSnapshot(created.sceneConfigId, USER), handed);
    assert.throws(() => repo.getHandedOffSnapshot(created.sceneConfigId, OTHER), (error) => assertSceneError(error, 'SCENE_FORBIDDEN', 403));
    const repeated = repo.handOff(created.sceneConfigId, USER, '2026-09-30T04:07:00.000Z');
    assert.deepEqual(repeated, handed);
    assert.throws(
      () => repo.replaceDraftSnapshot(created.sceneConfigId, USER, snapshotInput(), '2026-09-30T04:08:00.000Z'),
      (error) => assertSceneError(error, 'SCENE_ALREADY_HANDED_OFF', 409),
    );
    assert.deepEqual(repo.getOwnedSnapshot(created.sceneConfigId, USER), handed);
    const retired = repo.createDraft(USER, {
      spaceType: 'indoor', environmentType: 'bedroom', reverbType: 'indoor_soft',
    }, '2026-09-30T04:09:00.000Z');
    db.prepare("UPDATE scene_config SET status='retired' WHERE scene_config_id=?").run(retired.sceneConfigId);
    assert.throws(() => repo.handOff(retired.sceneConfigId, USER, '2026-09-30T04:10:00.000Z'), (error) => assertSceneError(error, 'SCENE_STATUS_CONFLICT', 409));
    assert.throws(
      () => repo.replaceDraftSnapshot(retired.sceneConfigId, USER, snapshotInput(), '2026-09-30T04:11:00.000Z'),
      (error) => assertSceneError(error, 'SCENE_STATUS_CONFLICT', 409),
    );
    assert.equal(repo.getOwnedSnapshot(retired.sceneConfigId, USER).status, 'retired');
  } finally {
    db.close();
  }
});

test('复制使用族内最大版本加一，新 UUID 保持绑定且旧版不变', () => {
  const db = openSceneDb();
  try {
    const repo = new SceneRepository(db);
    const created = repo.createDraft(USER, {
      presetSceneId: PRESET_ID,
      spaceType: 'indoor',
      environmentType: 'bedroom',
      reverbType: 'indoor_soft',
    }, '2026-09-30T05:00:00.000Z');
    repo.replaceDraftSnapshot(created.sceneConfigId, USER, snapshotInput(), '2026-09-30T05:01:00.000Z');
    const frozen = repo.handOff(created.sceneConfigId, USER, '2026-09-30T05:02:00.000Z');
    const copied = repo.copyAsNextVersion(created.sceneConfigId, USER, '2026-09-30T05:03:00.000Z');
    assertCopiedVersion(frozen, copied, 2);
    const forked = repo.copyAsNextVersion(created.sceneConfigId, USER, '2026-09-30T05:04:00.000Z');
    assertCopiedVersion(frozen, forked, 3);
    assert.equal(forked.previousVersionId, frozen.sceneConfigId);
    assert.notEqual(forked.sceneConfigId, copied.sceneConfigId);
    assert.notEqual(forked.sources[0]?.sourceId, copied.sources[0]?.sourceId);
    assert.notEqual(forked.elements[0]?.elementId, copied.elements[0]?.elementId);
    assert.deepEqual(repo.getOwnedSnapshot(created.sceneConfigId, USER), frozen);
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  } finally {
    db.close();
  }
});

function assertCopiedVersion(previous: SceneSnapshot, copied: SceneSnapshot, version: number): void {
  assert.equal(copied.configVersion, version);
  assert.equal(copied.sceneFamilyId, previous.sceneFamilyId);
  assert.equal(copied.previousVersionId, previous.sceneConfigId);
  assert.equal(copied.status, 'draft');
  assert.equal(copied.handedOffAt, null);
  assert.equal(copied.presetSceneId, previous.presetSceneId);
  assert.notEqual(copied.sceneConfigId, previous.sceneConfigId);
  assert.deepEqual(copied.sources.map((item) => item.assetId).sort(), previous.sources.map((item) => item.assetId).sort());
  assert.deepEqual(copied.elements.map((item) => item.clientElementId), previous.elements.map((item) => item.clientElementId));
  const previousSourceIds = new Set(previous.sources.map((item) => item.sourceId));
  const copiedSourceIds = new Set(copied.sources.map((item) => item.sourceId));
  for (const sourceId of copiedSourceIds) assert.equal(previousSourceIds.has(sourceId), false);
  const bound = copied.elements.find((item) => item.clientElementId === 'tree');
  const unbound = copied.elements.find((item) => item.clientElementId === 'lamp');
  const outdoor = copied.sources.find((item) => item.assetId === ASSET_B);
  assert.ok(bound && unbound && outdoor);
  assert.equal(bound.sourceId, outdoor.sourceId);
  assert.equal(unbound.sourceId, null);
  assert.equal(previousSourceIds.has(bound.elementId), false);
  assert.notEqual(bound.elementId, previous.elements.find((item) => item.clientElementId === 'tree')?.elementId);
}

test('删除用户数据只清理该用户的场景版本和子项', () => {
  const db = openSceneDb();
  try {
    db.exec('CREATE TABLE other_module_marker (marker_id TEXT PRIMARY KEY, user_id TEXT NOT NULL)');
    db.prepare('INSERT INTO other_module_marker (marker_id, user_id) VALUES (?, ?)').run('keep', USER);
    const repo = new SceneRepository(db);
    const owned = repo.createDraft(USER, {
      spaceType: 'indoor', environmentType: 'bedroom', reverbType: 'indoor_soft',
    }, '2026-09-30T06:00:00.000Z');
    repo.replaceDraftSnapshot(owned.sceneConfigId, USER, snapshotInput(), '2026-09-30T06:01:00.000Z');
    const copied = repo.copyAsNextVersion(owned.sceneConfigId, USER, '2026-09-30T06:02:00.000Z');
    const otherSourceId = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc3';
    const other = repo.createDraft(OTHER, {
      spaceType: 'outdoor', environmentType: 'forest', reverbType: 'outdoor_open',
    }, '2026-09-30T06:03:00.000Z');
    repo.replaceDraftSnapshot(other.sceneConfigId, OTHER, {
      spaceType: 'outdoor',
      environmentType: 'forest',
      reverbType: 'outdoor_open',
      sources: [{ sourceId: otherSourceId, assetId: ASSET_A, spaceType: 'outdoor', volume: 0.3, loopMode: 'once', fadeInSec: 1, fadeOutSec: 1, enabled: true }],
      elements: [{ clientElementId: 'other-tree', assetId: ASSET_A, sourceId: otherSourceId, spaceType: 'outdoor', positionX: 0.4, positionY: 0.4, scale: 1, zOrder: 0 }],
    }, '2026-09-30T06:04:00.000Z');
    const removed = repo.eraseUserData(USER);
    assert.equal(removed, 2);
    assert.throws(() => repo.getOwnedSnapshot(owned.sceneConfigId, USER), (error) => assertSceneError(error, 'SCENE_NOT_FOUND', 404));
    assert.throws(() => repo.getOwnedSnapshot(copied.sceneConfigId, USER), (error) => assertSceneError(error, 'SCENE_NOT_FOUND', 404));
    assert.equal(countRows(db, 'SELECT count(*) AS count FROM scene_config WHERE user_id=?', USER), 0);
    assert.equal(countRows(db, 'SELECT count(*) AS count FROM scene_audio_source WHERE scene_config_id=?', owned.sceneConfigId), 0);
    assert.equal(countRows(db, 'SELECT count(*) AS count FROM scene_element WHERE scene_config_id=?', copied.sceneConfigId), 0);
    const remaining = repo.getOwnedSnapshot(other.sceneConfigId, OTHER);
    assert.equal(remaining.sources.length, 1);
    assert.equal(remaining.elements.length, 1);
    assert.equal(remaining.sources[0]?.sourceId, otherSourceId);
    assert.equal(countRows(db, 'SELECT count(*) AS count FROM other_module_marker WHERE user_id=?', USER), 1);
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  } finally {
    db.close();
  }
});

function jsonHeaders(userId?: string, extra: Record<string, string> = {}): Record<string, string> {
  return { 'Content-Type': 'application/json', ...(userId ? { 'X-Mianyu-User-Id': userId } : {}), ...extra };
}

function assertData(body: unknown): SceneSnapshot {
  assert.ok(body && typeof body === 'object');
  assert.equal('error' in body, false);
  assert.ok('data' in body);
  return (body as { data: SceneSnapshot }).data;
}

function assertError(body: unknown, code: string): void {
  assert.ok(body && typeof body === 'object');
  assert.equal('data' in body, false);
  assert.ok('error' in body);
  const error = (body as { error: { code: string; message: string; requestId: string; details: unknown } }).error;
  assert.equal(error.code, code);
  assert.equal(typeof error.message, 'string');
  assert.match(error.requestId, /^[0-9a-f-]{36}$/i);
  assert.ok(Array.isArray(error.details));
}

function httpSnapshot(enabled = true): SceneSnapshotInput {
  return {
    spaceType: 'indoor',
    environmentType: 'bedroom',
    reverbType: 'indoor_soft',
    sources: [source(SOURCE_A, ASSET_A, enabled)],
    elements: [{
      clientElementId: 'A02',
      assetId: ASSET_B,
      sourceId: null,
      spaceType: 'outdoor',
      positionX: 0.72,
      positionY: 0.38,
      scale: 1,
      zOrder: 2,
    }],
  };
}

async function withSceneHttp(run: (ctx: {
  base: string;
  service: SceneService;
  catalog: FakeContentCatalog;
  plans: FakePlanQuery;
  db: DatabaseSync;
}) => Promise<void>): Promise<void> {
  const db = openSceneDb();
  const catalog = new FakeContentCatalog();
  const plans = new FakePlanQuery();
  allowAsset(catalog, ASSET_A, ['indoor', 'outdoor']);
  allowAsset(catalog, ASSET_B, ['indoor', 'outdoor']);
  registerDisplayAssets(catalog);
  const service = new SceneService(new SceneRepository(db), plans, catalog);
  const app = express();
  app.use(express.json({ limit: '32kb' }));
  app.use('/api/v1', createSceneRouter(service));
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise<void>((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    await run({ base: `http://127.0.0.1:${address.port}/api/v1`, service, catalog, plans, db });
  } finally {
    if (server.listening) {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
    db.close();
  }
}

test('HTTP 五个接口成功并返回 data', async () => {
  await withSceneHttp(async ({ base }) => {
    const createdResponse = await fetch(`${base}/scenes`, { method: 'POST', headers: jsonHeaders(USER), body: '{}' });
    assert.equal(createdResponse.status, 201);
    const created = assertData(await createdResponse.json());
    assert.equal(created.status, 'draft');
    assert.equal(created.sources.length, 0);
    const savedResponse = await fetch(`${base}/scenes/${created.sceneConfigId}`, {
      method: 'PUT', headers: jsonHeaders(USER), body: JSON.stringify(httpSnapshot()),
    });
    assert.equal(savedResponse.status, 200);
    const saved = assertData(await savedResponse.json());
    assert.equal(saved.status, 'draft');
    assert.equal(saved.spaceType, 'indoor');
    assert.equal(saved.elements[0]?.spaceType, 'outdoor');
    assert.equal(saved.elements[0]?.clientElementId, 'A02');
    const loadedResponse = await fetch(`${base}/scenes/${created.sceneConfigId}`, { headers: jsonHeaders(USER) });
    assert.equal(loadedResponse.status, 200);
    assert.deepEqual(assertData(await loadedResponse.json()), saved);
    const handedResponse = await fetch(`${base}/scenes/${created.sceneConfigId}/hand-off`, { method: 'POST', headers: jsonHeaders(USER) });
    assert.equal(handedResponse.status, 200);
    const handed = assertData(await handedResponse.json());
    assert.equal(handed.status, 'handed_off');
    assert.equal(typeof handed.handedOffAt, 'string');
    const copiedResponse = await fetch(`${base}/scenes/${created.sceneConfigId}/copy`, { method: 'POST', headers: jsonHeaders(USER) });
    assert.equal(copiedResponse.status, 201);
    const copied = assertData(await copiedResponse.json());
    assert.notEqual(copied.sceneConfigId, handed.sceneConfigId);
    assert.equal(copied.configVersion, 2);
    assert.equal(copied.previousVersionId, handed.sceneConfigId);
    assert.equal(copied.sceneFamilyId, handed.sceneFamilyId);
    assert.equal(copied.status, 'draft');
    assert.notEqual(copied.sources[0]?.sourceId, handed.sources[0]?.sourceId);
    assert.equal(copied.sources[0]?.assetId, handed.sources[0]?.assetId);
    assert.notEqual(copied.elements[0]?.elementId, handed.elements[0]?.elementId);
    const unchanged = assertData(await (await fetch(`${base}/scenes/${handed.sceneConfigId}`, { headers: jsonHeaders(USER) })).json());
    assert.equal(unchanged.handedOffAt, handed.handedOffAt);
    assert.equal(unchanged.status, 'handed_off');
  });
});

test('HTTP 拒绝缺身份、非法字段、越权和缺失资源', async () => {
  await withSceneHttp(async ({ base, catalog }) => {
    const missingIdentity = await fetch(`${base}/scenes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(missingIdentity.status, 401);
    assertError(await missingIdentity.json(), 'IDENTITY_REQUIRED');
    const badPath = await fetch(`${base}/scenes/not-a-uuid`, { headers: jsonHeaders(USER) });
    assert.equal(badPath.status, 400);
    assertError(await badPath.json(), 'INVALID_REQUEST');
    const created = assertData(await (await fetch(`${base}/scenes`, { method: 'POST', headers: jsonHeaders(USER), body: '{}' })).json());
    const element = httpSnapshot().elements[0];
    assert.ok(element);
    const invalidBodies = [
      { ...httpSnapshot(), sources: [{ ...source(SOURCE_A, ASSET_A), assetId: 'A01' }] },
      { ...httpSnapshot(), elements: [{ ...element, positionX: 1.2 }] },
      { ...httpSnapshot(), sources: [{ ...source(SOURCE_A, ASSET_A), loopMode: 'forever' }] },
      { ...httpSnapshot(), visualSpecs: { width: 12 } },
      { sourcePlanId: PLAN_ID, presetSceneId: PRESET_ID },
    ];
    for (const body of invalidBodies) {
      const method = 'sourcePlanId' in body ? 'POST' : 'PUT';
      const path = method === 'POST' ? `${base}/scenes` : `${base}/scenes/${created.sceneConfigId}`;
      const response = await fetch(path, { method, headers: jsonHeaders(USER), body: JSON.stringify(body) });
      assert.equal(response.status, 400);
      assertError(await response.json(), 'INVALID_REQUEST');
    }
    assert.equal(catalog.assets.get(ASSET_A)?.playable, true);
    const forbiddenGet = await fetch(`${base}/scenes/${created.sceneConfigId}`, { headers: jsonHeaders(OTHER) });
    assert.equal(forbiddenGet.status, 403);
    assertError(await forbiddenGet.json(), 'SCENE_FORBIDDEN');
    const forbiddenSave = await fetch(`${base}/scenes/${created.sceneConfigId}`, {
      method: 'PUT', headers: jsonHeaders(OTHER), body: JSON.stringify(httpSnapshot()),
    });
    assert.equal(forbiddenSave.status, 403);
    assertError(await forbiddenSave.json(), 'SCENE_FORBIDDEN');
    const forbiddenCopy = await fetch(`${base}/scenes/${created.sceneConfigId}/copy`, { method: 'POST', headers: jsonHeaders(OTHER) });
    assert.equal(forbiddenCopy.status, 403);
    assertError(await forbiddenCopy.json(), 'SCENE_FORBIDDEN');
    const missing = await fetch(`${base}/scenes/${MISSING}`, { headers: jsonHeaders(USER) });
    assert.equal(missing.status, 404);
    assertError(await missing.json(), 'SCENE_NOT_FOUND');
    catalog.failMessage = 'disk-secret-token';
    const broken = await fetch(`${base}/scenes/${created.sceneConfigId}`, {
      method: 'PUT', headers: jsonHeaders(USER), body: JSON.stringify(httpSnapshot()),
    });
    assert.equal(broken.status, 500);
    const brokenBody: unknown = await broken.json();
    assertError(brokenBody, 'INTERNAL_ERROR');
    assert.equal(JSON.stringify(brokenBody).includes('disk-secret-token'), false);
  });
});

test('HTTP 交接冲突、素材规则、方案映射和幂等创建', async () => {
  await withSceneHttp(async ({ base, service, catalog, plans, db }) => {
    const created = assertData(await (await fetch(`${base}/scenes`, { method: 'POST', headers: jsonHeaders(USER), body: '{}' })).json());
    assert.throws(
      () => service.getSceneSnapshot(created.sceneConfigId, USER),
      (error: unknown) => assertSceneError(error, 'SCENE_STATUS_CONFLICT', 409),
    );
    const ownerRead = await fetch(`${base}/scenes/${created.sceneConfigId}`, { headers: jsonHeaders(USER) });
    assert.equal(ownerRead.status, 200);
    assert.equal(assertData(await ownerRead.json()).status, 'draft');
    const outdoorOnly = '55555555-5555-4555-8555-555555555555';
    allowAsset(catalog, outdoorOnly, ['outdoor']);
    const incompatible = await fetch(`${base}/scenes/${created.sceneConfigId}`, {
      method: 'PUT',
      headers: jsonHeaders(USER),
      body: JSON.stringify({
        ...httpSnapshot(),
        elements: [],
        sources: [{ ...source(SOURCE_A, outdoorOnly), spaceType: 'indoor' }],
      }),
    });
    assert.equal(incompatible.status, 409);
    assertError(await incompatible.json(), 'SCENE_SPACE_INCOMPATIBLE');
    const unavailableAsset = catalog.assets.get(ASSET_A);
    assert.ok(unavailableAsset);
    unavailableAsset.playable = false;
    const unavailable = await fetch(`${base}/scenes/${created.sceneConfigId}`, {
      method: 'PUT', headers: jsonHeaders(USER), body: JSON.stringify({ ...httpSnapshot(), elements: [] }),
    });
    assert.equal(unavailable.status, 409);
    assertError(await unavailable.json(), 'SCENE_ASSET_UNAVAILABLE');
    assert.equal(assertData(await (await fetch(`${base}/scenes/${created.sceneConfigId}`, { headers: jsonHeaders(USER) })).json()).sources.length, 0);
    unavailableAsset.playable = true;
    const disabled = await fetch(`${base}/scenes/${created.sceneConfigId}`, {
      method: 'PUT',
      headers: jsonHeaders(USER),
      body: JSON.stringify({ ...httpSnapshot(false), elements: [] }),
    });
    assert.equal(disabled.status, 200);
    const blocked = await fetch(`${base}/scenes/${created.sceneConfigId}/hand-off`, { method: 'POST', headers: jsonHeaders(USER) });
    assert.equal(blocked.status, 409);
    assertError(await blocked.json(), 'SCENE_NO_ENABLED_SOURCE');
    assert.equal(assertData(await (await fetch(`${base}/scenes/${created.sceneConfigId}`, { headers: jsonHeaders(USER) })).json()).status, 'draft');
    const ready = await fetch(`${base}/scenes/${created.sceneConfigId}`, {
      method: 'PUT', headers: jsonHeaders(USER), body: JSON.stringify(httpSnapshot()),
    });
    assert.equal(ready.status, 200);
    const handed = assertData(await (await fetch(`${base}/scenes/${created.sceneConfigId}/hand-off`, { method: 'POST', headers: jsonHeaders(USER) })).json());
    unavailableAsset.playable = false;
    const repeated = assertData(await (await fetch(`${base}/scenes/${created.sceneConfigId}/hand-off`, { method: 'POST', headers: jsonHeaders(USER) })).json());
    assert.equal(repeated.handedOffAt, handed.handedOffAt);
    assert.equal(repeated.updatedAt, handed.updatedAt);
    const frozenWrite = await fetch(`${base}/scenes/${created.sceneConfigId}`, {
      method: 'PUT', headers: jsonHeaders(USER), body: JSON.stringify(httpSnapshot()),
    });
    assert.equal(frozenWrite.status, 409);
    assertError(await frozenWrite.json(), 'SCENE_ALREADY_HANDED_OFF');
    assert.deepEqual(service.getSceneSnapshot(created.sceneConfigId, USER), handed);
    plans.plans.set(PLAN_ID, {
      planId: PLAN_ID,
      userId: USER,
      tracks: [{ contentId: 'A01', volume: 0.4, loopMode: 'loop' }],
    });
    const fromPlanResponse = await fetch(`${base}/scenes`, {
      method: 'POST', headers: jsonHeaders(USER), body: JSON.stringify({ sourcePlanId: PLAN_ID }),
    });
    assert.equal(fromPlanResponse.status, 201);
    const fromPlan = assertData(await fromPlanResponse.json());
    assert.equal(fromPlan.sourcePlanId, PLAN_ID);
    assert.equal(fromPlan.elements.length, 0);
    assert.equal(fromPlan.sources[0]?.assetId, FAKE_DISPLAY_ASSET_IDS.A01);
    const storedAsset = db.prepare('SELECT asset_id FROM scene_audio_source WHERE scene_config_id=?').get(fromPlan.sceneConfigId) as { asset_id: string };
    assert.equal(storedAsset.asset_id, FAKE_DISPLAY_ASSET_IDS.A01);
    assert.deepEqual(plans.calls, [{ planId: PLAN_ID, userId: USER }]);
    const unconfirmedId = '12121212-1212-4121-8121-121212121212';
    plans.failures.set(unconfirmedId, 'not_confirmed');
    const before = countRows(db, 'SELECT count(*) AS count FROM scene_config');
    const unconfirmed = await fetch(`${base}/scenes`, {
      method: 'POST', headers: jsonHeaders(USER), body: JSON.stringify({ sourcePlanId: unconfirmedId }),
    });
    assert.equal(unconfirmed.status, 409);
    assertError(await unconfirmed.json(), 'PLAN_NOT_CONFIRMED');
    assert.equal(countRows(db, 'SELECT count(*) AS count FROM scene_config'), before);
    const idempotencyHeaders = jsonHeaders(USER, { 'Idempotency-Key': 'create-once' });
    const first = assertData(await (await fetch(`${base}/scenes`, { method: 'POST', headers: idempotencyHeaders, body: '{}' })).json());
    const second = assertData(await (await fetch(`${base}/scenes`, { method: 'POST', headers: idempotencyHeaders, body: '{}' })).json());
    assert.equal(second.sceneConfigId, first.sceneConfigId);
    assert.equal(service.eraseUserData(USER) > 0, true);
    assert.throws(() => service.get(created.sceneConfigId, USER), (error: unknown) => assertSceneError(error, 'SCENE_NOT_FOUND', 404));
  });
});
