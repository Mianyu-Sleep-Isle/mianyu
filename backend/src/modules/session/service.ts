import { randomUUID } from 'node:crypto';
import { SleepSessionRepository } from './repository.ts';
import { assertTransition, checkedSeconds, isTerminal, stageOrder, terminalStatus } from './state-machine.ts';
import {
  SessionError, type Clock, type DomainEventPublisherPort, type EventRecord, type EventType,
  type PlanQueryPort, type PlayableResourceResolverPort, type SceneConfigQueryPort,
  type SessionFacts, type SessionRecord, type StageRecord, type StageType, type StopReason,
} from './types.ts';

export interface SessionDependencies {
  plans: PlanQueryPort;
  scenes: SceneConfigQueryPort;
  resources: PlayableResourceResolverPort;
  publisher: DomainEventPublisherPort;
  clock: Clock;
  repository: SleepSessionRepository;
}
const nowIso=(clock: Clock) => clock.now().toISOString();
const elapsed=(from: string, to: string) => checkedSeconds(Math.max(0,Math.floor((Date.parse(to)-Date.parse(from))/1000)),'elapsed');

export class SleepSessionService {
  private readonly d: SessionDependencies;
  constructor(dependencies: SessionDependencies) { this.d=dependencies; }

  async prepare(userId: string, planId: string, sceneConfigId: string): Promise<SessionFacts> {
    if (!userId || !planId || !sceneConfigId) throw new SessionError('validation_error','User, plan and scene IDs are required');
    const [plan,scene]=await Promise.all([this.d.plans.getPlan(planId),this.d.scenes.getScene(sceneConfigId)]);
    if (!plan || !scene) throw new SessionError('not_found','Plan or scene not found');
    if (plan.userId!==userId || scene.userId!==userId) throw new SessionError('forbidden','Plan or scene belongs to another user');
    if (plan.status!=='confirmed' || scene.lifecycleStatus!=='handed_off' || (scene.sourcePlanId && scene.sourcePlanId!==planId)) {
      throw new SessionError('validation_error','Plan and frozen scene are not compatible');
    }
    if (!Number.isInteger(plan.plannedDurationSec) || plan.plannedDurationSec<1 || plan.plannedDurationSec>43200 ||
      !Number.isInteger(plan.fadeOutSec) || plan.fadeOutSec<0 || plan.fadeOutSec>1800 || plan.fadeOutSec>plan.plannedDurationSec ||
      !Number.isFinite(plan.masterVolume) || plan.masterVolume<0 || plan.masterVolume>1) {
      throw new SessionError('validation_error','Invalid plan duration, fade or volume');
    }
    const at=nowIso(this.d.clock), sessionId=randomUUID();
    const types=stageOrder(Boolean(plan.breathDurationSec),Boolean(plan.storyDurationSec),plan.fadeOutSec>0);
    const session:SessionRecord={
      sessionId,userId,planId,sceneConfigId,status:'preparing',currentStage:null,
      plannedDurationSec:plan.plannedDurationSec,fadeOutSec:plan.fadeOutSec,startedAt:null,endedAt:null,
      activePlaybackSec:0,pausedSec:0,stopReason:null,masterVolumeStart:plan.masterVolume,masterVolumeEnd:null,
      noiseCaptureAuthorized:false,deviceDataAuthorized:false,recordSource:'playback_record',createdAt:at,updatedAt:at,
    };
    this.d.repository.transaction(() => {
      this.d.repository.createSession(session);
      types.forEach((stageType,index) => this.d.repository.createStage({
        stageId:randomUUID(),sessionId,stageType,sequenceNo:index+1,status:'pending',
        plannedDurationSec:stageType==='breath' ? plan.breathDurationSec! : stageType==='story' ? plan.storyDurationSec! : stageType==='fade_out' ? plan.fadeOutSec : null,
        actualDurationSec:0,startedAt:null,endedAt:null,skipReason:null,recordSource:'playback_record',createdAt:at,updatedAt:at,
      }));
      this.event(sessionId,'session_preparing',at);
    });

    let playable=0,requiredMissing=false;
    for (const source of scene.sources.filter(s=>s.enabled)) {
      let resource;
      try { resource=await this.d.resources.resolve(source.trackId,userId); } catch { resource=null; }
      if (resource?.playable && resource.trackId===source.trackId) { playable++; continue; }
      if (source.required) requiredMissing=true;
      this.d.repository.transaction(() => this.event(sessionId,'resource_missing',nowIso(this.d.clock),{
        sceneAudioSourceId:source.sourceId,errorCode:'resource_unavailable',
      }));
    }
    if (playable===0 || requiredMissing) {
      this.end(userId,sessionId,'resource_load_failed');
      throw new SessionError('resource_unavailable','No playable source in the frozen scene');
    }
    return this.getSessionFacts(sessionId,userId);
  }

  async start(userId: string, sessionId: string): Promise<SessionFacts> {
    const at=nowIso(this.d.clock);
    const session=this.owned(userId,sessionId);
    if (session.status!=='preparing' && session.status!=='running') throw new SessionError('state_conflict','Only preparing sessions can acknowledge first audio start');
    if (session.status!=='running') {
      assertTransition(session.status,'running');
      this.d.repository.transaction(() => {
        const fresh=this.owned(userId,sessionId);
        assertTransition(fresh.status,'running');
        const stages=this.d.repository.listStages(sessionId);
        const first=stages[0];
        this.d.repository.updateSession({...fresh,status:'running',startedAt:at,currentStage:first?.stageType??null,updatedAt:at});
        this.event(sessionId,'session_started',at);
        if (first) this.beginStage(first,at);
      });
    }
    const started=this.owned(userId,sessionId);
    // The stable fact ID makes retries safe for the downstream idempotent handler.
    await this.d.publisher.publishPlanStarted({eventId:sessionId,userId,planId:started.planId,sessionId,startedAt:started.startedAt!});
    return this.getSessionFacts(sessionId,userId);
  }

  pause(userId: string, sessionId: string): SessionFacts {
    const at=nowIso(this.d.clock), session=this.owned(userId,sessionId);
    if (session.status==='paused') return this.getSessionFacts(sessionId,userId);
    assertTransition(session.status,'paused');
    this.d.repository.transaction(() => {
      const fresh=this.owned(userId,sessionId), since=this.lastRunAt(sessionId);
      this.d.repository.updateSession({...fresh,status:'paused',activePlaybackSec:fresh.activePlaybackSec+elapsed(since,at),updatedAt:at});
      const stage=this.currentStage(sessionId,fresh.currentStage);
      if (stage) this.d.repository.updateStage({...stage,status:'paused',updatedAt:at});
      this.event(sessionId,'paused',at,{stageId:stage?.stageId??null});
    });
    return this.getSessionFacts(sessionId,userId);
  }

  resume(userId: string, sessionId: string): SessionFacts {
    const at=nowIso(this.d.clock), session=this.owned(userId,sessionId);
    if (session.status==='running') return this.getSessionFacts(sessionId,userId);
    assertTransition(session.status,'running');
    this.d.repository.transaction(() => {
      const fresh=this.owned(userId,sessionId), paused=this.latest(sessionId,'paused');
      if (!paused) throw new SessionError('state_conflict','Pause event missing');
      this.d.repository.updateSession({...fresh,status:'running',pausedSec:fresh.pausedSec+elapsed(paused.occurredAt,at),updatedAt:at});
      const stage=this.currentStage(sessionId,fresh.currentStage);
      if (stage) this.d.repository.updateStage({...stage,status:'running',updatedAt:at});
      this.event(sessionId,'resumed',at,{stageId:stage?.stageId??null});
    });
    return this.getSessionFacts(sessionId,userId);
  }

  skipStage(userId: string, sessionId: string, reason: string): SessionFacts {
    if (!reason?.trim() || reason.length>100) throw new SessionError('validation_error','A short skip reason is required');
    const at=nowIso(this.d.clock),session=this.owned(userId,sessionId);
    if (session.status!=='running') throw new SessionError('state_conflict','Session is not running');
    const current=this.currentStage(sessionId,session.currentStage);
    if (!current || !['breath','story'].includes(current.stageType)) throw new SessionError('state_conflict','Only breath or story can be skipped');
    this.d.repository.transaction(() => {
      this.d.repository.updateStage({...current,status:'skipped',actualDurationSec:0,endedAt:at,skipReason:reason.trim(),updatedAt:at});
      this.event(sessionId,'stage_skipped',at,{stageId:current.stageId});
      if (current.stageType==='story') this.event(sessionId,'voice_removed',at,{stageId:current.stageId});
      this.nextStage(session, current, at);
    });
    return this.getSessionFacts(sessionId,userId);
  }

  completeStage(userId: string, sessionId: string): SessionFacts {
    const at=nowIso(this.d.clock),session=this.owned(userId,sessionId);
    if (session.status!=='running') throw new SessionError('state_conflict','Session is not running');
    const current=this.currentStage(sessionId,session.currentStage);
    if (!current) throw new SessionError('state_conflict','No running stage');
    this.d.repository.transaction(() => {
      const seconds=this.stageActiveSeconds(sessionId,current.startedAt!,at);
      this.d.repository.updateStage({...current,status:'completed',actualDurationSec:seconds,endedAt:at,updatedAt:at});
      this.event(sessionId,'stage_completed',at,{stageId:current.stageId});
      if (current.stageType==='story') {
        this.event(sessionId,'story_finished',at,{stageId:current.stageId});
        this.event(sessionId,'voice_removed',at,{stageId:current.stageId});
      }
      if (current.stageType==='fade_out') {
        const volume=this.latest(sessionId,'volume_changed');
        if ((volume ? Number(volume.newValue) : session.masterVolumeStart)!==0) {
          throw new SessionError('state_conflict','Fade must reach zero before completion');
        }
        this.event(sessionId,'fade_completed',at,{stageId:current.stageId});
        this.endInTransaction(session,'timer_completed',at);
      } else this.nextStage(session,current,at);
    });
    return this.getSessionFacts(sessionId,userId);
  }

  setMasterVolume(userId: string, sessionId: string, volume: number): SessionFacts {
    if (!Number.isFinite(volume) || volume<0 || volume>1) throw new SessionError('validation_error','Volume must be between 0 and 1');
    const session=this.owned(userId,sessionId);
    if (session.status!=='running') throw new SessionError('state_conflict','Session is not running');
    const prior=this.latest(sessionId,'volume_changed');
    const old=prior ? Number(prior.newValue) : session.masterVolumeStart;
    if (session.currentStage==='fade_out' && volume>old) throw new SessionError('validation_error','Fade volume must decrease monotonically');
    if (volume===old) return this.getSessionFacts(sessionId,userId);
    const at=nowIso(this.d.clock);
    this.d.repository.transaction(() => this.event(sessionId,'volume_changed',at,{oldValue:String(old),newValue:String(volume)}));
    return this.getSessionFacts(sessionId,userId);
  }

  end(userId: string, sessionId: string, reason: StopReason): SessionFacts {
    const session=this.owned(userId,sessionId);
    if (isTerminal(session.status)) {
      if (session.stopReason===reason) return this.getSessionFacts(sessionId,userId);
      throw new SessionError('state_conflict','Session already ended for another reason');
    }
    if (reason==='timer_completed') {
      const stages=this.d.repository.listStages(sessionId);
      if (session.status!=='running' || session.currentStage!==stages.at(-1)?.stageType) throw new SessionError('state_conflict','Final stage has not finished');
      if (session.currentStage==='fade_out' && Number(this.latest(sessionId,'volume_changed')?.newValue??session.masterVolumeStart)!==0) {
        throw new SessionError('state_conflict','Fade has not reached zero');
      }
    }
    const at=nowIso(this.d.clock);
    this.d.repository.transaction(() => this.endInTransaction(session,reason,at));
    return this.getSessionFacts(sessionId,userId);
  }

  appendObservation(userId: string, sessionId: string, input: {
    eventId: string; eventType: 'track_started' | 'track_stopped' | 'resource_missing' | 'playback_error';
    occurredAt: string; sceneAudioSourceId?: string; errorCode?: string;
  }): boolean {
    const session=this.owned(userId,sessionId);
    if (isTerminal(session.status)) throw new SessionError('state_conflict','Session already ended');
    if (!input.eventId || Number.isNaN(Date.parse(input.occurredAt))) throw new SessionError('validation_error','Event ID and UTC time are required');
    if (['resource_missing','playback_error'].includes(input.eventType) && !input.errorCode) throw new SessionError('validation_error','Error code is required');
    const at=nowIso(this.d.clock);
    return this.d.repository.transaction(() => this.event(sessionId,input.eventType,input.occurredAt,{
      eventId:input.eventId,sceneAudioSourceId:input.sceneAudioSourceId??null,errorCode:input.errorCode??null,createdAt:at,
    }));
  }

  getSessionFacts(sessionId: string, userId: string): SessionFacts {
    const facts=this.d.repository.facts(sessionId,userId);
    if (!facts) throw new SessionError('not_found','Session not found');
    return facts;
  }
  listHistory(userId: string, days: 7 | 30): SessionRecord[] {
    if (days!==7 && days!==30) throw new SessionError('validation_error','Period must be 7 or 30 days');
    return this.d.repository.listSessions(userId,new Date(this.d.clock.now().getTime()-days*86400000).toISOString());
  }
  eraseUserData(userId: string): number { return this.d.repository.eraseUserData(userId); }

  private owned(userId: string, sessionId: string): SessionRecord {
    const session=this.d.repository.getSession(sessionId);
    if (!session) throw new SessionError('not_found','Session not found');
    if (session.userId!==userId) throw new SessionError('forbidden','Session belongs to another user');
    return session;
  }
  private currentStage(sessionId: string, stageType: StageType | null): StageRecord | null {
    return this.d.repository.listStages(sessionId).find(s=>s.stageType===stageType)??null;
  }
  private latest(sessionId: string, type: EventType): EventRecord | null {
    return this.d.repository.listEvents(sessionId).filter(e=>e.eventType===type).at(-1)??null;
  }
  private lastRunAt(sessionId: string): string {
    const events=this.d.repository.listEvents(sessionId).filter(e=>e.eventType==='session_started'||e.eventType==='resumed');
    const last=events.at(-1);
    if (!last) throw new SessionError('state_conflict','Start event missing');
    return last.occurredAt;
  }
  private stageActiveSeconds(sessionId: string, startedAt: string, endAt: string): number {
    let from=startedAt,total=0,playing=true;
    for (const event of this.d.repository.listEvents(sessionId).filter(e=>e.occurredAt>=startedAt && e.occurredAt<=endAt && (e.eventType==='paused'||e.eventType==='resumed'))) {
      if (event.eventType==='paused' && playing) { total+=elapsed(from,event.occurredAt); playing=false; }
      if (event.eventType==='resumed' && !playing) { from=event.occurredAt; playing=true; }
    }
    if (playing) total+=elapsed(from,endAt);
    return total;
  }
  private beginStage(stage: StageRecord, at: string): void {
    this.d.repository.updateStage({...stage,status:'running',startedAt:at,updatedAt:at});
    this.event(stage.sessionId,'stage_started',at,{stageId:stage.stageId});
    if (stage.stageType==='fade_out') this.event(stage.sessionId,'fade_started',at,{stageId:stage.stageId});
  }
  private nextStage(session: SessionRecord, current: StageRecord, at: string): void {
    const next=this.d.repository.listStages(session.sessionId).find(s=>s.sequenceNo===current.sequenceNo+1);
    this.d.repository.updateSession({...session,currentStage:next?.stageType??null,updatedAt:at});
    if (next) this.beginStage(next,at);
  }
  private endInTransaction(session: SessionRecord, reason: StopReason, at: string): void {
    const status=terminalStatus(reason);
    assertTransition(session.status,status);
    if (session.status==='preparing' && reason==='user_ended') throw new SessionError('validation_error','Use user_cancelled_before_start');
    if (session.status!=='preparing' && reason==='user_cancelled_before_start') throw new SessionError('validation_error','Playback already started');
    let active=session.activePlaybackSec,paused=session.pausedSec;
    if (session.status==='running') active+=elapsed(this.lastRunAt(session.sessionId),at);
    if (session.status==='paused') {
      const pause=this.latest(session.sessionId,'paused');
      if (pause) paused+=elapsed(pause.occurredAt,at);
    }
    const current=this.currentStage(session.sessionId,session.currentStage);
    if (current && (current.status==='running' || current.status==='paused')) {
      const stageStatus=status==='failed' ? 'failed' : status==='completed' ? 'completed' : 'skipped';
      const stageSeconds=stageStatus==='skipped' ? 0 : this.stageActiveSeconds(session.sessionId,current.startedAt!,at);
      this.d.repository.updateStage({...current,status:stageStatus,actualDurationSec:stageSeconds,
        endedAt:at,skipReason:stageStatus==='skipped' ? reason : null,updatedAt:at});
      this.event(session.sessionId,stageStatus==='completed' ? 'stage_completed' : stageStatus==='skipped' ? 'stage_skipped' : 'playback_error',at,
        {stageId:current.stageId,errorCode:stageStatus==='failed' ? reason : null});
    }
    if (status==='failed' && !this.d.repository.listEvents(session.sessionId).some(e=>e.eventType==='resource_missing'||e.eventType==='playback_error')) {
      this.event(session.sessionId,'playback_error',at,{errorCode:reason});
    }
    const volumeEvent=this.latest(session.sessionId,'volume_changed');
    const endVolume=status==='completed' ? 0 : volumeEvent ? Number(volumeEvent.newValue) : session.masterVolumeStart;
    this.d.repository.updateSession({...session,status,currentStage:null,endedAt:at,activePlaybackSec:active,pausedSec:paused,stopReason:reason,masterVolumeEnd:endVolume,updatedAt:at});
    this.event(session.sessionId,'session_ended',at);
  }
  private event(sessionId: string,eventType: EventType,occurredAt: string,values: Partial<EventRecord>={}): boolean {
    return this.d.repository.appendEvent({
      eventId:values.eventId??randomUUID(),sessionId,stageId:values.stageId??null,sceneAudioSourceId:values.sceneAudioSourceId??null,
      eventType,occurredAt,oldValue:values.oldValue??null,newValue:values.newValue??null,errorCode:values.errorCode??null,
      detailJson:values.detailJson??null,recordSource:'playback_record',createdAt:values.createdAt??occurredAt,
    });
  }
}
