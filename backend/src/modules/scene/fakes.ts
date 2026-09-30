import {
  PlanQueryUnavailable,
  type CatalogAsset,
  type ConfirmedPlan,
  type ContentCatalogService,
  type PlanQueryFailure,
  type PlanQueryService,
  type ResolvedContent,
} from './service.ts';
import type { SceneSpaceType } from './types.ts';

export const FAKE_DISPLAY_ASSET_IDS = {
  A01: '10000000-0000-4000-8000-000000000001',
  A03: '10000000-0000-4000-8000-000000000003',
  A12: '10000000-0000-4000-8000-000000000012',
} as const;

export class FakePlanQuery implements PlanQueryService {
  readonly plans = new Map<string, ConfirmedPlan>();
  readonly failures = new Map<string, PlanQueryFailure>();
  readonly calls: Array<{ planId: string; userId: string }> = [];

  async getConfirmedPlan(planId: string, userId: string): Promise<ConfirmedPlan> {
    this.calls.push({ planId, userId });
    const failure = this.failures.get(planId);
    if (failure) throw new PlanQueryUnavailable(failure);
    const plan = this.plans.get(planId);
    if (!plan) throw new PlanQueryUnavailable('not_found');
    if (plan.userId !== userId) throw new PlanQueryUnavailable('forbidden');
    return plan;
  }
}

export class FakeContentCatalog implements ContentCatalogService {
  readonly assets = new Map<string, CatalogAsset>();
  readonly displayIds = new Map<string, string>();
  failMessage: string | null = null;

  async validateAssets(assetIds: string[], _userId: string): Promise<CatalogAsset[]> {
    this.failIfNeeded();
    return assetIds.flatMap((assetId) => {
      const asset = this.assets.get(assetId);
      return asset ? [asset] : [];
    });
  }

  async resolveContentIds(contentIds: string[], _userId: string): Promise<ResolvedContent[]> {
    this.failIfNeeded();
    const resolved: ResolvedContent[] = [];
    for (const contentId of contentIds) {
      const assetId = this.displayIds.get(contentId);
      if (assetId) resolved.push({ contentId, assetId });
    }
    return resolved;
  }

  private failIfNeeded(): void {
    if (this.failMessage) throw new Error(this.failMessage);
  }
}

export function allowAsset(catalog: FakeContentCatalog, assetId: string, allowedSpaceTypes: SceneSpaceType[], playable = true): void {
  catalog.assets.set(assetId, { assetId, playable, allowedSpaceTypes });
}

export function registerDisplayAssets(catalog: FakeContentCatalog): void {
  for (const [displayId, assetId] of Object.entries(FAKE_DISPLAY_ASSET_IDS)) {
    catalog.displayIds.set(displayId, assetId);
    allowAsset(catalog, assetId, ['indoor', 'outdoor']);
  }
}
