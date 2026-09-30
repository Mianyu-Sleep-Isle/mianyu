import { SessionError, type SessionStatus, type StageType, type StopReason } from './types.ts';

const allowed: Record<SessionStatus, readonly SessionStatus[]> = {
  preparing: ['running', 'failed', 'cancelled'],
  running: ['paused', 'completed', 'failed', 'cancelled'],
  paused: ['running', 'failed', 'cancelled'],
  completed: [], cancelled: [], failed: [],
};

export function assertTransition(from: SessionStatus, to: SessionStatus): void {
  if (!allowed[from].includes(to)) throw new SessionError('state_conflict', `Cannot change ${from} to ${to}`);
}
export function isTerminal(status: SessionStatus): boolean {
  return status === 'completed' || status === 'cancelled' || status === 'failed';
}
export function terminalStatus(reason: StopReason): SessionStatus {
  if (reason === 'timer_completed') return 'completed';
  if (reason === 'user_ended' || reason === 'user_cancelled_before_start') return 'cancelled';
  return 'failed';
}
export function stageOrder(hasBreath: boolean, hasStory: boolean, hasFade: boolean): StageType[] {
  return [...(hasBreath ? ['breath' as const] : []), ...(hasStory ? ['story' as const] : []), 'soundscape', ...(hasFade ? ['fade_out' as const] : [])];
}
export function checkedSeconds(seconds: number, label: string): number {
  if (!Number.isInteger(seconds) || seconds < 0) throw new SessionError('validation_error', `${label} must be a nonnegative integer`);
  return seconds;
}
