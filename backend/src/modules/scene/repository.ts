import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { mapSceneAudioSource, mapSceneConfig, mapSceneElement, toSceneSnapshot, type SqlRow } from './mapper.ts';
import { SceneError, type CreateSceneInput, type SceneAudioSource, type SceneConfig, type SceneElement, type SceneSnapshot, type SceneSnapshotInput } from './types.ts';

export class SceneRepository {
  constructor(private readonly db: DatabaseSync) {
    this.db.exec('PRAGMA foreign_keys = ON');
  }

  createDraft(userId: string, input: CreateSceneInput, now: string): SceneSnapshot {
    const sceneConfigId = randomUUID();
    this.db.prepare(`INSERT INTO scene_config (
      scene_config_id, scene_family_id, config_version, previous_version_id, user_id,
      source_plan_id, preset_scene_id, status, space_type, environment_type, reverb_type,
      handed_off_at, created_at, updated_at
    ) VALUES (?, ?, 1, NULL, ?, ?, ?, 'draft', ?, ?, ?, NULL, ?, ?)`).run(
      sceneConfigId,
      sceneConfigId,
      userId,
      input.sourcePlanId ?? null,
      input.presetSceneId ?? null,
      input.spaceType,
      input.environmentType,
      input.reverbType,
      now,
      now,
    );
    return this.getOwnedSnapshot(sceneConfigId, userId);
  }

  getOwnedSnapshot(sceneConfigId: string, userId: string): SceneSnapshot {
    return this.loadSnapshot(this.requireConfig(sceneConfigId, userId, 'read'));
  }

  getHandedOffSnapshot(sceneConfigId: string, userId: string): SceneSnapshot {
    const config = this.requireConfig(sceneConfigId, userId, 'read');
    if (config.status !== 'handed_off') {
      throw new SceneError('SCENE_STATUS_CONFLICT', '只能读取已交接的场景快照', 409);
    }
    return this.loadSnapshot(config);
  }

  replaceDraftSnapshot(sceneConfigId: string, userId: string, input: SceneSnapshotInput, now: string): SceneSnapshot {
    return this.transaction(() => {
      const config = this.requireConfig(sceneConfigId, userId, 'write');
      if (config.status === 'handed_off') throw new SceneError('SCENE_ALREADY_HANDED_OFF', '已交接的场景不能再修改', 409);
      if (config.status !== 'draft') throw new SceneError('SCENE_STATUS_CONFLICT', '当前状态不能保存', 409);
      this.deleteChildren(sceneConfigId);
      for (const source of input.sources) this.insertSource(sceneConfigId, source);
      for (const element of input.elements) this.insertElement(sceneConfigId, { ...element, elementId: randomUUID() });
      this.db.prepare(`UPDATE scene_config
        SET space_type=?, environment_type=?, reverb_type=?, updated_at=?
        WHERE scene_config_id=? AND status='draft'`).run(
        input.spaceType, input.environmentType, input.reverbType, now, sceneConfigId,
      );
      return this.loadSnapshot(this.requireConfig(sceneConfigId, userId, 'read'));
    });
  }

  handOff(sceneConfigId: string, userId: string, now: string): SceneSnapshot {
    return this.transaction(() => {
      const config = this.requireConfig(sceneConfigId, userId, 'write');
      if (config.status === 'handed_off') return this.loadSnapshot(config);
      if (config.status !== 'draft') throw new SceneError('SCENE_STATUS_CONFLICT', '当前状态不能交接', 409);
      const enabled = this.db.prepare(
        'SELECT count(*) AS count FROM scene_audio_source WHERE scene_config_id=? AND enabled=1',
      ).get(sceneConfigId) as SqlRow;
      if (Number(enabled.count) < 1) throw new SceneError('SCENE_NO_ENABLED_SOURCE', '交接前至少需要一个启用的声源', 409);
      this.db.prepare(`UPDATE scene_config
        SET status='handed_off', handed_off_at=?, updated_at=?
        WHERE scene_config_id=? AND status='draft'`).run(now, now, sceneConfigId);
      return this.loadSnapshot(this.requireConfig(sceneConfigId, userId, 'read'));
    });
  }

  copyAsNextVersion(sceneConfigId: string, userId: string, now: string): SceneSnapshot {
    return this.transaction(() => {
      const sourceSnapshot = this.loadSnapshot(this.requireConfig(sceneConfigId, userId, 'write'));
      const maxVersion = this.db.prepare(
        'SELECT MAX(config_version) AS max_version FROM scene_config WHERE scene_family_id=?',
      ).get(sourceSnapshot.sceneFamilyId) as SqlRow;
      const nextVersion = Number(maxVersion.max_version) + 1;
      const nextConfigId = randomUUID();
      this.db.prepare(`INSERT INTO scene_config (
        scene_config_id, scene_family_id, config_version, previous_version_id, user_id,
        source_plan_id, preset_scene_id, status, space_type, environment_type, reverb_type,
        handed_off_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, NULL, ?, ?)`).run(
        nextConfigId,
        sourceSnapshot.sceneFamilyId,
        nextVersion,
        sourceSnapshot.sceneConfigId,
        sourceSnapshot.userId,
        sourceSnapshot.sourcePlanId,
        sourceSnapshot.presetSceneId,
        sourceSnapshot.spaceType,
        sourceSnapshot.environmentType,
        sourceSnapshot.reverbType,
        now,
        now,
      );
      const sourceIds = new Map<string, string>();
      for (const source of sourceSnapshot.sources) {
        const nextSourceId = randomUUID();
        sourceIds.set(source.sourceId, nextSourceId);
        this.insertSource(nextConfigId, { ...source, sourceId: nextSourceId });
      }
      for (const element of sourceSnapshot.elements) {
        const nextSourceId = element.sourceId === null ? null : sourceIds.get(element.sourceId) ?? null;
        if (element.sourceId !== null && nextSourceId === null) {
          throw new SceneError('INVALID_REQUEST', '元素绑定的声源不在该场景中', 400);
        }
        this.insertElement(nextConfigId, { ...element, elementId: randomUUID(), sourceId: nextSourceId });
      }
      return this.loadSnapshot(this.requireConfig(nextConfigId, userId, 'read'));
    });
  }

  eraseUserData(userId: string): number {
    return this.transaction(() => {
      this.db.prepare('UPDATE scene_config SET previous_version_id=NULL WHERE user_id=?').run(userId);
      return Number(this.db.prepare('DELETE FROM scene_config WHERE user_id=?').run(userId).changes);
    });
  }

  private requireConfig(sceneConfigId: string, userId: string, action: 'read' | 'write'): SceneConfig {
    const row = this.db.prepare('SELECT * FROM scene_config WHERE scene_config_id=?').get(sceneConfigId) as SqlRow | undefined;
    if (!row) throw new SceneError('SCENE_NOT_FOUND', '场景不存在', 404);
    const config = mapSceneConfig(row);
    if (config.userId !== userId) {
      throw new SceneError('SCENE_FORBIDDEN', action === 'read' ? '不能读取其他用户的场景' : '不能修改其他用户的场景', 403);
    }
    return config;
  }

  private loadSnapshot(config: SceneConfig): SceneSnapshot {
    const sources = (this.db.prepare(
      'SELECT * FROM scene_audio_source WHERE scene_config_id=? ORDER BY source_id',
    ).all(config.sceneConfigId) as SqlRow[]).map(mapSceneAudioSource);
    const elements = (this.db.prepare(
      'SELECT * FROM scene_element WHERE scene_config_id=? ORDER BY z_order, element_id',
    ).all(config.sceneConfigId) as SqlRow[]).map(mapSceneElement);
    return toSceneSnapshot(config, sources, elements);
  }

  private deleteChildren(sceneConfigId: string): void {
    this.db.prepare('DELETE FROM scene_element WHERE scene_config_id=?').run(sceneConfigId);
    this.db.prepare('DELETE FROM scene_audio_source WHERE scene_config_id=?').run(sceneConfigId);
  }

  private insertSource(sceneConfigId: string, source: SceneAudioSource): void {
    this.db.prepare(`INSERT INTO scene_audio_source (
      source_id, scene_config_id, asset_id, space_type, volume, loop_mode, fade_in_sec, fade_out_sec, enabled
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      source.sourceId,
      sceneConfigId,
      source.assetId,
      source.spaceType,
      source.volume,
      source.loopMode,
      source.fadeInSec,
      source.fadeOutSec,
      source.enabled ? 1 : 0,
    );
  }

  private insertElement(sceneConfigId: string, element: SceneElement): void {
    this.db.prepare(`INSERT INTO scene_element (
      element_id, scene_config_id, client_element_id, asset_id, source_id,
      space_type, position_x, position_y, scale, z_order
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      element.elementId,
      sceneConfigId,
      element.clientElementId,
      element.assetId,
      element.sourceId,
      element.spaceType,
      element.positionX,
      element.positionY,
      element.scale,
      element.zOrder,
    );
  }

  private transaction<T>(work: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = work();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
}
