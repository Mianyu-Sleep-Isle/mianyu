import { randomUUID } from 'node:crypto';
import { explain, type RuleCode } from './explanation.ts';
import { PlanningError, type AgeMode, type ContentCandidate, type PlanTrack, type SleepPlan, type StructuredIntent } from './types.ts';

export const isPlayable = (item: ContentCandidate, ageMode: AgeMode) => item.enabled
  && item.reviewStatus === 'approved' && ['owned', 'licensed', 'public_domain'].includes(item.copyrightStatus)
  && (item.ageMode === 'all' || item.ageMode === ageMode);

export function composeRulePlan(args: { userId: string; ageMode: AgeMode; intent: StructuredIntent; candidates: ContentCandidate[]; now?: string }): SleepPlan {
  const { userId, ageMode, intent } = args;
  let candidates = args.candidates.filter((item) => isPlayable(item, ageMode));
  const avoid = new Set(intent.avoidTags.map((tag) => tag.toLowerCase()));
  candidates = candidates.filter((item) => !item.tags.some((tag) => avoid.has(tag.toLowerCase())));
  if (intent.voicePreference === 'avoid') candidates = candidates.filter((item) => !item.hasVoice && item.contentKind !== 'story');
  const selected = intent.selectedContentIds.map((id) => candidates.find((item) => item.contentId === id));
  if (selected.some((item) => !item)) throw new PlanningError('NO_SAFE_CONTENT_MATCH', '已选内容不满足当前安全限制', 400);
  const rules: RuleCode[] = [];
  if (intent.voicePreference === 'avoid') rules.push('avoid_voice');
  else if (intent.voicePreference === 'wanted') rules.push('wanted_company');
  else if (intent.durationSec <= 900) rules.push('short_duration');
  else if (avoid.has('thunder')) rules.push('avoid_thunder');
  else rules.push('default');
  const desiredKind = rules[0] === 'short_duration' ? 'breath' : rules[0] === 'wanted_company' ? 'story' : 'audio';
  const chosen = [...selected.filter(Boolean) as ContentCandidate[], ...candidates.filter((item) => item.contentKind === desiredKind), ...candidates.filter((item) => item.contentKind === 'audio')]
    .filter((item, index, all) => all.findIndex((other) => other.contentId === item.contentId) === index).slice(0, 3);
  if (chosen.length === 0) throw new PlanningError('NO_SAFE_CONTENT_MATCH', '没有符合当前条件的安全内容', 400);
  const planId = randomUUID();
  const tracks: PlanTrack[] = chosen.map((item, index) => ({ trackId: randomUUID(), contentId: item.contentId, contentKind: item.contentKind,
    startOffsetSec: 0, volume: item.contentKind === 'audio' ? 0.45 : 0.6, loopMode: item.contentKind === 'audio' ? 'loop' : 'once', sequenceNo: index + 1 }));
  const hasStory = tracks.some((track) => track.contentKind === 'story'); const hasBreath = tracks.some((track) => track.contentKind === 'breath');
  const planType = hasStory && tracks.length > 1 ? 'mix' : hasStory ? 'story' : hasBreath && tracks.length > 1 ? 'mix' : hasBreath ? 'breath' : 'soundscape';
  return { planId, userId, ...intent, status: 'draft', planType, durationSec: intent.durationSec,
    fadeOutSec: Math.min(300, intent.durationSec), reason: explain(rules), source: 'rule', sourceLabel: '规则建议', tracks,
    createdAt: args.now ?? new Date().toISOString(), confirmedAt: null, startedSessionId: null };
}
