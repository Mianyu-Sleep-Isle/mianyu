import type { DatabaseSync } from 'node:sqlite';
import { ApiError, type AgeMode } from '../../shared/http.ts';
import { contentManifest, presetManifest, type ContentEntry, type ContentKind, type SpaceType } from './manifest.ts';

export interface CatalogCandidate {
  contentId: string;
  contentKind: ContentKind;
  tags: string[];
  ageMode: AgeMode | 'all';
  hasVoice: boolean;
  reviewStatus: 'approved';
  copyrightStatus: ContentEntry['copyrightStatus'];
  enabled: boolean;
  // child 模式屏蔽的素材（如 A12 远雷）：调度时不可见、不可选。
  childRestricted: boolean;
}

export interface ContentItemDto {
  id: string;
  asset_id: string;
  name: string;
  meta: string;
  category: string;
  art: string;
  image?: string;
  asset_path?: string;
  action: string;
  detail?: boolean;
  // The page only blocks 'adult' items in child mode, so child-safe items report 'child'.
  age_mode: AgeMode;
  audience: 'all' | AgeMode;
  default_space?: SpaceType;
  duration_sec?: number;
  enabled: boolean;
}

const categoryKinds: Record<string, ContentKind> = { '声音': 'audio', '故事': 'story', '呼吸': 'breath' };
const kindLabels: Record<ContentKind, string> = { audio: '声音', story: '故事', breath: '呼吸' };
const usableCopyright = new Set(['owned', 'licensed', 'public_domain']);

export class ContentCatalog {
  private readonly byContentId = new Map<string, ContentEntry>();
  private readonly byAssetId = new Map<string, ContentEntry>();

  constructor(private readonly db: DatabaseSync, entries: ContentEntry[] = contentManifest) {
    for (const entry of entries) {
      this.byContentId.set(entry.contentId, entry);
      this.byAssetId.set(entry.assetId, entry);
    }
  }

  find(idOrAssetId: string): ContentEntry | undefined {
    return this.byContentId.get(idOrAssetId) ?? this.byAssetId.get(idOrAssetId);
  }

  isPlayable(entry: ContentEntry, ageMode?: AgeMode): boolean {
    return entry.enabled && usableCopyright.has(entry.copyrightStatus)
      && (ageMode === undefined || entry.ageMode === 'all' || entry.ageMode === ageMode)
      && (ageMode !== 'child' || !entry.childRestricted);
  }

  async listCandidates(ageMode: AgeMode): Promise<CatalogCandidate[]> {
    return [...this.byContentId.values()]
      .filter((entry) => (entry.ageMode === 'all' || entry.ageMode === ageMode)
        && (ageMode !== 'child' || !entry.childRestricted))
      .map((entry) => ({
        contentId: entry.contentId, contentKind: entry.kind, tags: entry.tags, ageMode: entry.ageMode, hasVoice: entry.hasVoice,
        reviewStatus: 'approved', copyrightStatus: entry.copyrightStatus, enabled: this.isPlayable(entry, ageMode),
        childRestricted: entry.childRestricted,
      }));
  }

  async validateAssets(assetIds: string[], _userId: string): Promise<Array<{ assetId: string; playable: boolean; allowedSpaceTypes: SpaceType[] }>> {
    return assetIds.flatMap((assetId) => {
      const entry = this.byAssetId.get(assetId);
      return entry ? [{ assetId, playable: this.isPlayable(entry), allowedSpaceTypes: [...entry.allowedSpaceTypes] }] : [];
    });
  }

  async resolveContentIds(contentIds: string[], _userId: string): Promise<Array<{ contentId: string; assetId: string }>> {
    return contentIds.flatMap((contentId) => {
      const entry = this.find(contentId);
      return entry ? [{ contentId, assetId: entry.assetId }] : [];
    });
  }

  async resolveTrack(trackId: string, _userId: string): Promise<{ trackId: string; playable: boolean } | null> {
    const entry = this.find(trackId);
    return entry ? { trackId, playable: this.isPlayable(entry) } : null;
  }

  list(category: string, userId: string | undefined, ageMode?: AgeMode): ContentItemDto[] {
    if (category === '预设') {
      return presetManifest
        .filter((preset) => ageMode !== 'child' || preset.memberIds.every((id) => {
          const entry = this.byContentId.get(id);
          return entry && !entry.childRestricted;
        }))
        .map((preset) => ({
          id: preset.contentId, asset_id: preset.contentId, name: preset.name, meta: preset.meta, category, art: preset.art,
          action: '查看', age_mode: 'child', audience: 'all', enabled: preset.memberIds.every((id) => this.isEnabled(id)),
        }));
    }
    if (category === '收藏') {
      if (!userId) return [];
      const rows = this.db.prepare('SELECT content_id FROM content_favorite WHERE user_id = ? ORDER BY created_at DESC, content_id').all(userId) as Array<{ content_id: string }>;
      return rows.flatMap((row) => {
        const entry = this.byContentId.get(row.content_id);
        return entry ? [{ ...this.toDto(entry, category, ageMode), meta: `${kindLabels[entry.kind]} · 已收藏` }] : [];
      });
    }
    const kind = categoryKinds[category];
    if (!kind) throw new ApiError('INVALID_REQUEST', '不支持的内容分类', 400, [{ category }]);
    return [...this.byContentId.values()]
      .filter((entry) => entry.kind === kind)
      .filter((entry) => ageMode !== 'child' || !entry.childRestricted)
      .map((entry) => this.toDto(entry, category, ageMode));
  }

  playable(idOrAssetId: string, ageMode: AgeMode): { asset_id: string; content_id: string; url: string; image: string | null; playable: boolean; duration_sec: number | null; loop: boolean; expires_at: null } {
    const entry = this.find(idOrAssetId);
    if (!entry) throw new ApiError('CONTENT_NOT_FOUND', '内容不存在', 404);
    if (entry.ageMode !== 'all' && entry.ageMode !== ageMode) throw new ApiError('CONTENT_AGE_RESTRICTED', '当前年龄模式不能播放该内容', 403);
    if (ageMode === 'child' && entry.childRestricted) throw new ApiError('CONTENT_AGE_RESTRICTED', '当前年龄模式不能播放该内容', 403);
    const playable = this.isPlayable(entry, ageMode);
    const durationSec = entry.durationSec ?? null;
    // 环境音（audio）天然是氛围声，应循环以避免 90s 后突然静音破坏体验。
    // 故事（story）和呼吸（breath）是有头有尾的内容，播完即止。
    // 兜底规则：durationSec 已知且 < 30s 也视为短促而循环。
    const loop = entry.kind === 'audio'
      || (durationSec !== null && durationSec < 30);
    return { asset_id: entry.assetId, content_id: entry.contentId, url: playable ? entry.audioPath ?? '' : '', image: entry.imagePath, playable, duration_sec: durationSec, loop, expires_at: null };
  }

  setFavorite(userId: string, idOrAssetId: string, favorite: boolean): { asset_id: string; content_id: string; favorite: boolean } {
    const entry = this.find(idOrAssetId);
    if (!entry) throw new ApiError('CONTENT_NOT_FOUND', '内容不存在', 404);
    if (favorite) {
      this.db.prepare('INSERT OR IGNORE INTO content_favorite(user_id, content_id, created_at) VALUES (?, ?, ?)').run(userId, entry.contentId, new Date().toISOString());
    } else {
      this.db.prepare('DELETE FROM content_favorite WHERE user_id = ? AND content_id = ?').run(userId, entry.contentId);
    }
    return { asset_id: entry.assetId, content_id: entry.contentId, favorite };
  }

  eraseUserData(userId: string): number {
    return Number(this.db.prepare('DELETE FROM content_favorite WHERE user_id = ?').run(userId).changes);
  }

  private isEnabled(contentId: string): boolean {
    const entry = this.byContentId.get(contentId);
    return Boolean(entry && this.isPlayable(entry));
  }

  private toDto(entry: ContentEntry, category: string, ageMode?: AgeMode): ContentItemDto {
    const dto: ContentItemDto = {
      id: entry.contentId, asset_id: entry.assetId, name: entry.name, meta: entry.meta, category, art: entry.art,
      action: entry.kind === 'audio' ? '试听' : '详情', age_mode: entry.ageMode === 'adult' ? 'adult' : 'child', audience: entry.ageMode,
      default_space: entry.defaultSpace, enabled: this.isPlayable(entry, ageMode),
    };
    if (entry.kind === 'audio' && entry.imagePath) dto.asset_path = entry.imagePath;
    if (entry.kind !== 'audio') {
      dto.detail = true;
      if (entry.imagePath) dto.image = entry.imagePath;
    }
    if (entry.durationSec !== null) dto.duration_sec = entry.durationSec;
    return dto;
  }
}
