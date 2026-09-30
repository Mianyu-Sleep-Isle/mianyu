import { PlanningError, type ComposePlanRequest, type StructuredIntent } from './types.ts';

const hasAny = (text: string, words: string[]) => words.some((word) => text.includes(word));

export function toStructuredIntent(request: ComposePlanRequest): StructuredIntent {
  if (request.inputMode === 'choices') { const { freeText: _discarded, ...intent } = request; return intent; }
  const text = request.freeText?.trim() ?? '';
  if (!text) throw new PlanningError('UNRECOGNIZED_SLEEP_INTENT', '请补充今晚的状态或改用点选', 400);
  if (hasAny(text, ['自杀', '不想活', '伤害自己'])) throw new PlanningError('PRODUCT_BOUNDARY_CRISIS', '本产品不能提供危机干预，请立即联系可信任的人或当地紧急援助', 400);
  const avoidTags = new Set(request.avoidTags); const selectedContentIds = new Set(request.selectedContentIds);
  let mood = request.mood; let voicePreference = request.voicePreference; let durationSec = request.durationSec; let recognized = false;
  if (hasAny(text, ['不要打雷', '别打雷', '不要雷声', '怕打雷'])) { avoidTags.add('thunder'); recognized = true; }
  if (hasAny(text, ['不要人声', '别说话', '不想听人声'])) { voicePreference = 'avoid'; recognized = true; }
  else if (hasAny(text, ['想有人陪', '陪我', '想听故事'])) { voicePreference = 'wanted'; recognized = true; }
  if (hasAny(text, ['雨', '下雨'])) { selectedContentIds.add('A01'); recognized = true; }
  if (hasAny(text, ['考试', '紧张', '焦虑', '心情不好'])) { mood = 'annoyed'; recognized = true; }
  if (hasAny(text, ['很累', '疲惫', '困'])) { mood = 'tired'; recognized = true; }
  // “三十分钟”包含“十分钟”，因此从更长、更具体的表达开始匹配。
  if (hasAny(text, ['30分钟', '三十分钟', '半小时'])) { durationSec = 1800; recognized = true; }
  else if (hasAny(text, ['20分钟', '二十分钟'])) { durationSec = 1200; recognized = true; }
  else if (hasAny(text, ['15分钟', '十五分钟'])) { durationSec = 900; recognized = true; }
  else if (hasAny(text, ['10分钟', '十分钟'])) { durationSec = 600; recognized = true; }
  if (!recognized) throw new PlanningError('UNRECOGNIZED_SLEEP_INTENT', '暂时没理解，请改用点选或说明时长与声音偏好', 400);
  return { inputMode: 'sentence', mood, voicePreference, avoidTags: [...avoidTags], durationSec, selectedContentIds: [...selectedContentIds] };
}
