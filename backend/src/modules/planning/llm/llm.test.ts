// LLM 合成单元测试：使用 mock completeFn 验证 fallback 链、schema 校验、降级行为。
// 注意：此文件不应该真实调用 DashScope（CI 也跑），只用 mock。

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeLlmPlan, isLlmAvailable, LlmUnavailableError } from './compose-llm.ts';
import { parsePlanResponse } from './prompt.ts';
import { loadDashScopeConfig } from './client.ts';
import type { ContentCandidate, StructuredIntent } from '../types.ts';
import type { ChatCompletionResponse } from './client.ts';

const DUMMY_CONFIG = {
  apiKey: 'sk-test',
  baseUrl: 'https://example.invalid/v1',
  model: 'qwen-plus',
  timeoutMs: 1000,
};

const candidates: ContentCandidate[] = [
  { contentId: 'A01', contentKind: 'audio', tags: ['rain'], ageMode: 'all', hasVoice: false, reviewStatus: 'approved', copyrightStatus: 'public_domain', enabled: true },
  { contentId: 'A03', contentKind: 'audio', tags: ['fire'], ageMode: 'all', hasVoice: false, reviewStatus: 'approved', copyrightStatus: 'public_domain', enabled: true },
  { contentId: 'A12', contentKind: 'audio', tags: ['thunder'], ageMode: 'all', hasVoice: false, reviewStatus: 'approved', copyrightStatus: 'public_domain', enabled: true },
  { contentId: 'S01', contentKind: 'story', tags: ['gentle', 'rain'], ageMode: 'adult', hasVoice: true, reviewStatus: 'approved', copyrightStatus: 'public_domain', enabled: true },
  { contentId: 'BR01', contentKind: 'breath', tags: ['calm'], ageMode: 'all', hasVoice: true, reviewStatus: 'approved', copyrightStatus: 'owned', enabled: true },
];

const intent: StructuredIntent = {
  inputMode: 'choices', mood: 'calm', voicePreference: 'either', avoidTags: [], durationSec: 1800, selectedContentIds: [],
};

const okResponse = (content: object): ChatCompletionResponse => ({
  choices: [{ message: { role: 'assistant', content: JSON.stringify(content) }, finish_reason: 'stop' }],
});

test('loadDashScopeConfig: 无 DASHSCOPE_API_KEY 时返回 null', () => {
  assert.equal(loadDashScopeConfig({}), null);
});

test('loadDashScopeConfig: 有 DASHSCOPE_API_KEY 时返回配置', () => {
  const cfg = loadDashScopeConfig({ DASHSCOPE_API_KEY: 'sk-x', DASHSCOPE_MODEL: 'qwen-turbo' });
  assert.ok(cfg);
  assert.equal(cfg!.apiKey, 'sk-x');
  assert.equal(cfg!.model, 'qwen-turbo');
  assert.equal(cfg!.baseUrl, 'https://dashscope.aliyuncs.com/compatible-mode/v1');
});

test('isLlmAvailable: 环境变量决定', () => {
  // 默认 env 决定；本测试不依赖具体值，只保证函数签名稳定
  assert.equal(typeof isLlmAvailable(), 'boolean');
});

test('parsePlanResponse: 标准 JSON 解析', () => {
  const out = parsePlanResponse('{"reason":"好","tracks":[{"contentId":"A01","volume":0.4}]}');
  assert.equal(out.reason, '好');
  assert.equal(out.tracks.length, 1);
  assert.equal(out.tracks[0]!.contentId, 'A01');
});

test('parsePlanResponse: 容忍 markdown 包裹', () => {
  const out = parsePlanResponse('```json\n{"reason":"好","tracks":[{"contentId":"A01","volume":0.4}]}\n```');
  assert.equal(out.tracks[0]!.contentId, 'A01');
});

test('parsePlanResponse: 缺 tracks 时抛错', () => {
  assert.throws(() => parsePlanResponse('{"reason":"x"}'), /tracks/);
});

test('composeLlmPlan: 正常路径返回 source=llm', async () => {
  const plan = await composeLlmPlan({
    userId: 'u1', ageMode: 'adult', intent, candidates,
    config: DUMMY_CONFIG,
    completeFn: async () => okResponse({ reason: '今晚小雨陪着你。', tracks: [{ contentId: 'A01', volume: 0.4 }] }),
    now: '2026-10-06T00:00:00.000Z',
  });
  assert.equal(plan.source, 'llm');
  assert.equal(plan.sourceLabel, '模型建议');
  assert.equal(plan.reason, '今晚小雨陪着你。');
  assert.equal(plan.tracks.length, 1);
  assert.equal(plan.tracks[0]!.contentId, 'A01');
  assert.equal(plan.tracks[0]!.loopMode, 'loop');
});

test('composeLlmPlan: LLM 选了禁雷 → 抛 LlmUnavailableError', async () => {
  await assert.rejects(
    composeLlmPlan({
      userId: 'u1', ageMode: 'adult',
      intent: { ...intent, avoidTags: ['thunder'] },
      candidates,
      config: DUMMY_CONFIG,
      completeFn: async () => okResponse({ reason: 'x', tracks: [{ contentId: 'A12', volume: 0.4 }] }),
    }),
    LlmUnavailableError,
  );
});

test('composeLlmPlan: LLM 选了儿童成人故事 → 抛 LlmUnavailableError', async () => {
  await assert.rejects(
    composeLlmPlan({
      userId: 'u1', ageMode: 'child',
      intent: { ...intent, voicePreference: 'wanted' },
      candidates,
      config: DUMMY_CONFIG,
      completeFn: async () => okResponse({ reason: 'x', tracks: [{ contentId: 'S01', volume: 0.6 }] }),
    }),
    LlmUnavailableError,
  );
});

test('composeLlmPlan: LLM 忽略了用户显式选中 → 抛 LlmUnavailableError', async () => {
  await assert.rejects(
    composeLlmPlan({
      userId: 'u1', ageMode: 'adult',
      intent: { ...intent, selectedContentIds: ['A03'] },
      candidates,
      config: DUMMY_CONFIG,
      completeFn: async () => okResponse({ reason: 'x', tracks: [{ contentId: 'A01', volume: 0.4 }] }),
    }),
    LlmUnavailableError,
  );
});

test('composeLlmPlan: LLM 选了 disabled 素材 → 抛 LlmUnavailableError', async () => {
  // 模拟 listCandidates 在 child 模式下：ST01 ageMode=adult, enabled=false（listCandidates 仍返回但 enabled=false）
  const childCandidates: ContentCandidate[] = [
    { contentId: 'S01', contentKind: 'story', tags: ['gentle', 'rain'], ageMode: 'adult', hasVoice: true, reviewStatus: 'approved', copyrightStatus: 'public_domain', enabled: false },
    { contentId: 'S04', contentKind: 'story', tags: ['gentle', 'star'], ageMode: 'child', hasVoice: true, reviewStatus: 'approved', copyrightStatus: 'public_domain', enabled: true },
  ];
  await assert.rejects(
    composeLlmPlan({
      userId: 'u1', ageMode: 'child',
      intent: { ...intent, voicePreference: 'wanted' },
      candidates: childCandidates,
      config: DUMMY_CONFIG,
      completeFn: async () => okResponse({ reason: 'x', tracks: [{ contentId: 'S01', volume: 0.6 }] }),
    }),
    LlmUnavailableError,
  );
});

test('composeLlmPlan: 用户显式选中被包含时通过', async () => {
  const plan = await composeLlmPlan({
    userId: 'u1', ageMode: 'adult',
    intent: { ...intent, selectedContentIds: ['A03'] },
    candidates,
    config: DUMMY_CONFIG,
    completeFn: async () => okResponse({ reason: 'ok', tracks: [{ contentId: 'A03', volume: 0.4 }, { contentId: 'A01', volume: 0.3 }] }),
  });
  assert.equal(plan.tracks.length, 2);
  assert.ok(plan.tracks.some((t) => t.contentId === 'A03'));
});

test('composeLlmPlan: 解析失败 → 抛 LlmUnavailableError', async () => {
  await assert.rejects(
    composeLlmPlan({
      userId: 'u1', ageMode: 'adult', intent, candidates,
      config: DUMMY_CONFIG,
      completeFn: async () => okResponse({ reason: 'not json' } as any),
    }),
    LlmUnavailableError,
  );
});

test('composeLlmPlan: 不传 config 且 env 为空 → 抛 LlmUnavailableError', async () => {
  await assert.rejects(
    composeLlmPlan({ userId: 'u1', ageMode: 'adult', intent, candidates }),
    LlmUnavailableError,
  );
});