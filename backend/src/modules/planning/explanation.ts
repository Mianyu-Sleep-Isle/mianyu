export type RuleCode = 'avoid_voice' | 'short_duration' | 'wanted_company' | 'avoid_thunder' | 'default';

export function explain(codes: RuleCode[]): string {
  if (codes.includes('avoid_voice')) return '你明确选择了不要人声，所以方案只保留柔和环境声。';
  if (codes.includes('short_duration')) return '今晚时间较短，先用简短呼吸练习，再让环境声自然收尾。';
  if (codes.includes('wanted_company')) return '你希望有一点陪伴，方案选择已审核的短故事和低刺激环境声。';
  if (codes.includes('avoid_thunder')) return '保留轻柔雨声，并按你的要求排除雷声音轨。';
  return '先安排稳定的低刺激环境声，你还可以继续调整。';
}
