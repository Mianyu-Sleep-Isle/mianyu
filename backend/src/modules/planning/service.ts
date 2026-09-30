import { composePlanSchema } from './schema.ts';
import { toStructuredIntent } from './intent-parser.ts';
import { composeRulePlan } from './rule-engine.ts';
import { PlanningRepository } from './repository.ts';
import { PlanningError, type AgeMode, type ContentCandidate, type PlanningMeta, type SleepPlan } from './types.ts';

export interface ContentCatalogService { listCandidates(ageMode: AgeMode): Promise<ContentCandidate[]> }
export interface PreferenceQueryService { getPreferences(userId: string): Promise<{ avoidTags: string[] }> }

export class PlanningService {
  private readonly idempotentResults = new Map<string, { data: SleepPlan; meta?: PlanningMeta }>();
  constructor(private readonly repository: PlanningRepository, private readonly catalog: ContentCatalogService, private readonly preferences: PreferenceQueryService) {}
  async compose(userId: string, ageMode: AgeMode, unknownInput: unknown, idempotencyKey?: string): Promise<{ data: SleepPlan; meta?: PlanningMeta }> {
    const cacheKey = idempotencyKey ? `compose:${userId}:${idempotencyKey}` : null;
    if (cacheKey && this.idempotentResults.has(cacheKey)) return this.idempotentResults.get(cacheKey)!;
    const request = composePlanSchema.parse(unknownInput); const intent = toStructuredIntent(request); let degraded = false; let historyAvoidTags: string[] = [];
    try { historyAvoidTags = (await this.preferences.getPreferences(userId)).avoidTags; }
    catch { degraded = true; }
    let candidates: ContentCandidate[];
    try { candidates = await this.catalog.listCandidates(ageMode); }
    catch { throw new PlanningError('CONTENT_CATALOG_UNAVAILABLE', '内容目录暂时不可用', 503); }
    const explicitlySelectedTags = new Set(candidates.filter((item) => intent.selectedContentIds.includes(item.contentId)).flatMap((item) => item.tags.map((tag) => tag.toLowerCase())));
    intent.avoidTags = [...new Set([...intent.avoidTags, ...historyAvoidTags.filter((tag) => !explicitlySelectedTags.has(tag.toLowerCase()))])];
    const plan = composeRulePlan({ userId, ageMode, intent, candidates }); this.repository.save(plan);
    const result = degraded ? { data: plan, meta: { degraded: true } } : { data: plan };
    if (cacheKey) this.idempotentResults.set(cacheKey, result);
    return result;
  }
  getPlan(planId: string, userId: string): SleepPlan { return this.repository.get(planId, userId); }
  // In-process query for the session module, which checks ownership itself.
  findPlan(planId: string): SleepPlan | null { return this.repository.findById(planId); }
  getCurrentPlan(userId: string): SleepPlan | null { return this.repository.getCurrent(userId); }
  confirm(planId: string, userId: string): SleepPlan { return this.repository.confirm(planId, userId, new Date().toISOString()); }
  async regenerate(planId: string, userId: string, ageMode: AgeMode, idempotencyKey?: string): Promise<{ data: SleepPlan; meta?: PlanningMeta }> {
    const cacheKey = idempotencyKey ? `regenerate:${userId}:${planId}:${idempotencyKey}` : null;
    if (cacheKey && this.idempotentResults.has(cacheKey)) return this.idempotentResults.get(cacheKey)!;
    const old = this.repository.get(planId, userId);
    const result = await this.compose(userId, ageMode, { inputMode: 'choices', mood: old.mood, voicePreference: old.voicePreference,
      avoidTags: old.avoidTags, durationSec: old.durationSec, selectedContentIds: old.selectedContentIds });
    if (cacheKey) this.idempotentResults.set(cacheKey, result);
    return result;
  }
  markStarted(planId: string, sessionId: string): SleepPlan { return this.repository.markStarted(planId, sessionId, new Date().toISOString()); }
  markCompleted(planId: string, sessionId: string): SleepPlan { return this.repository.markCompleted(planId, sessionId, new Date().toISOString()); }
  cancel(planId: string, userId: string): SleepPlan { return this.repository.cancel(planId, userId, new Date().toISOString()); }
  eraseUserData(userId: string): number { return this.repository.eraseUserData(userId); }
}
