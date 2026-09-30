import type { Clock, DomainEventPublisherPort, PlanExecutionView, PlanQueryPort, PlanStartedFact, PlayableResourceResolverPort, ResourceView, SceneConfigQueryPort, SceneExecutionView } from '../types.ts';

export class FakeClock implements Clock {
  private instant: Date;
  constructor(value = '2026-09-25T20:00:00.000Z') { this.instant=new Date(value); }
  now(): Date { return new Date(this.instant); }
  advance(seconds: number): void { this.instant=new Date(this.instant.getTime()+seconds*1000); }
}
export class FakePlanQuery implements PlanQueryPort {
  readonly plans=new Map<string,PlanExecutionView>();
  async getPlan(id: string): Promise<PlanExecutionView|null> { return this.plans.get(id)??null; }
}
export class FakeSceneConfigQueryPort implements SceneConfigQueryPort {
  readonly scenes=new Map<string,SceneExecutionView>();
  async getScene(id: string): Promise<SceneExecutionView|null> { return this.scenes.get(id)??null; }
}
export class FakePlayableResourceResolver implements PlayableResourceResolverPort {
  readonly resources=new Map<string,ResourceView>();
  async resolve(trackId: string): Promise<ResourceView|null> { return this.resources.get(trackId)??null; }
}
export class FakeDomainEventPublisher implements DomainEventPublisherPort {
  readonly facts=new Map<string,PlanStartedFact>();
  async publishPlanStarted(fact: PlanStartedFact): Promise<void> {
    const prior=this.facts.get(fact.eventId);
    if (prior && JSON.stringify(prior)!==JSON.stringify(fact)) throw new Error('Conflicting fact ID');
    this.facts.set(fact.eventId,fact);
  }
}

export class FakeAudioDevice {
  loaded=false;
  playing=false;
  onStarted: (()=>Promise<void>)|null=null;
  onPaused: (()=>void)|null=null;
  onResumed: (()=>void)|null=null;
  onError: ((code:string)=>void)|null=null;
  load(): void { this.loaded=true; }
  async play(): Promise<void> {
    if (!this.loaded) throw new Error('Audio not loaded');
    this.playing=true;
    await this.onStarted?.();
  }
  pause(): void { if (!this.playing) throw new Error('Audio not playing'); this.playing=false;this.onPaused?.(); }
  resume(): void { if (!this.loaded) throw new Error('Audio not loaded');this.playing=true;this.onResumed?.(); }
  fail(code='audio_engine_error'): void { this.playing=false;this.onError?.(code); }
}
