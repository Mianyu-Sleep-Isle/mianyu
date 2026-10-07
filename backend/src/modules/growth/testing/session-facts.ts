import type { SessionFact, SessionFactsPort } from '../contracts.ts';

export class DevelopmentSessionFactsAdapter implements SessionFactsPort {
  private readonly sessions = new Map<string, SessionFact>();

  ensureForUser(userId: string): SessionFact {
    const existing = [...this.sessions.values()].find((item) => item.userId === userId);
    if (existing) return existing;
    const fact: SessionFact = { id: `dev-session-${userId}`, userId, endedAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(), source: 'development' };
    this.sessions.set(fact.id, fact);
    return fact;
  }

  add(fact: SessionFact): void { this.sessions.set(fact.id, fact); }

  async latestCompleted(userId: string): Promise<SessionFact | null> {
    return [...this.sessions.values()].filter((item) => item.userId === userId).sort((a, b) => b.endedAt.localeCompare(a.endedAt))[0] ?? this.ensureForUser(userId);
  }

  async isCompletedForUser(sessionId: string, userId: string): Promise<boolean> {
    const fact = this.sessions.get(sessionId) ?? (sessionId === `dev-session-${userId}` ? this.ensureForUser(userId) : undefined);
    return Boolean(fact && fact.userId === userId);
  }
}
