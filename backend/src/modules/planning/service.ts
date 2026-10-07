import { composePlanSchema } from './schema.ts';
import { toStructuredIntent } from './intent-parser.ts';
import { composeRulePlan } from './rule-engine.ts';
import { composeLlmPlan, isLlmAvailable, LlmUnavailableError, type ComposeLlmArgs } from './llm/compose-llm.ts';
import { PlanningRepository } from './repository.ts';
import { PlanningError, type AgeMode, type ContentCandidate, type PlanningMeta, type SleepPlan } from './types.ts';

export interface ContentCatalogService { listCandidates(ageMode: AgeMode): Promise<ContentCandidate[]> }
export interface PreferenceQueryService { getPreferences(userId: string): Promise<{ avoidTags: string[] }> }
/** 可选注入：测试或本地 mock 替换 LLM 调用。返回 plan 即视为 LLM 成功，抛 LlmUnavailableError 即降级。 */
export type LlmProvider = (args: ComposeLlmArgs) => Promise<SleepPlan>;

export class PlanningService {
  private readonly idempotentResults = new Map<string, { data: SleepPlan; meta?: PlanningMeta }>();
  /**
   * llmProvider 三态：
   *   - undefined（默认）：按 DASHSCOPE_API_KEY 自动选择 LLM 或规则引擎。
   *   - null：显式禁用 LLM，永远走规则引擎。
   *   - LlmProvider：使用注入的 provider（测试用 mock）。
   */
  private readonly llmProvider: LlmProvider | null | undefined;
  constructor(
    private readonly repository: PlanningRepository,
    private readonly catalog: ContentCatalogService,
    private readonly preferences: PreferenceQueryService,
    llmProvider?: LlmProvider | null,
  ) { this.llmProvider = llmProvider; }

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

    // 优先尝试 LLM；LLM 不可用/失败时降级到规则引擎；最终失败抛 NO_SAFE_CONTENT_MATCH。
    const plan = await this.composeWithFallback(userId, ageMode, intent, candidates, request.freeText ?? null);

    this.repository.save(plan);
    const result = degraded ? { data: plan, meta: { degraded: true } } : { data: plan };
    if (cacheKey) this.idempotentResults.set(cacheKey, result);
    return result;
  }

  // 优先 LLM，失败降级到规则引擎。
  // 当 LLM 输出违反安全规则时（如选到了禁雷/儿童成人内容），catch 后用规则引擎；
  // 规则引擎再失败才抛 NO_SAFE_CONTENT_MATCH（语义等同于之前"没有符合当前条件的安全内容"）。
  private async composeWithFallback(userId: string, ageMode: AgeMode, intent: Parameters<typeof composeRulePlan>[0]['intent'], candidates: ContentCandidate[], freeText?: string | null | undefined): Promise<SleepPlan> {
    // llmProvider === null → 强制规则；undefined → 自动；其他 → 用注入的 provider
    const enabled = this.llmProvider !== null && (this.llmProvider !== undefined || isLlmAvailable());
    const provider = this.llmProvider && this.llmProvider !== null
      ? this.llmProvider
      : async (args: ComposeLlmArgs) => composeLlmPlan(args);
    if (enabled) {
      try {
        return await provider({ userId, ageMode, intent, candidates, freeText });
      } catch (error) {
        if (!(error instanceof LlmUnavailableError)) throw error;
        console.warn('[planning] LLM unavailable, falling back to rule engine:', error.message);
      }
    }
    try {
      return composeRulePlan({ userId, ageMode, intent, candidates });
    } catch (error) {
      if (error instanceof PlanningError && error.code === 'NO_SAFE_CONTENT_MATCH') throw error;
      throw error;
    }
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
