import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { SleepSessionRepository } from '../repository.ts';
import { SleepSessionService } from '../service.ts';
import { FakeClock, FakeDomainEventPublisher, FakePlanQuery, FakePlayableResourceResolver, FakeSceneConfigQueryPort } from './fakes.ts';

export function harness() {
  const db=new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(readFileSync(new URL('../../../../migrations/400_module4_sleep.sql',import.meta.url),'utf8'));
  const clock=new FakeClock(), plans=new FakePlanQuery(), scenes=new FakeSceneConfigQueryPort();
  const resources=new FakePlayableResourceResolver(),publisher=new FakeDomainEventPublisher();
  const repository=new SleepSessionRepository(db);
  const service=new SleepSessionService({clock,plans,scenes,resources,publisher,repository});
  plans.plans.set('plan-1',{planId:'plan-1',userId:'user-1',status:'confirmed',plannedDurationSec:1800,fadeOutSec:60,masterVolume:0.7,breathDurationSec:120,storyDurationSec:300});
  scenes.scenes.set('scene-1',{sceneConfigId:'scene-1',userId:'user-1',sourcePlanId:'plan-1',lifecycleStatus:'handed_off',sources:[{sourceId:'source-1',trackId:'track-1',enabled:true,required:true}]});
  resources.resources.set('track-1',{trackId:'track-1',playable:true});
  return {db,clock,plans,scenes,resources,publisher,repository,service};
}
