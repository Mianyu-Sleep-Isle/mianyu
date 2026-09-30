import test from 'node:test';
import assert from 'node:assert/strict';
import { harness } from '../testing/harness.ts';

test('duplicate observation is accepted once; conflicting payload is rejected',async()=>{
  const h=harness();const id=(await h.service.prepare('user-1','plan-1','scene-1')).session.sessionId;
  await h.service.start('user-1',id);
  const input={eventId:'playback-1',eventType:'track_started' as const,occurredAt:h.clock.now().toISOString(),sceneAudioSourceId:'source-1'};
  assert.equal(h.service.appendObservation('user-1',id,input),true);
  assert.equal(h.service.appendObservation('user-1',id,input),false);
  assert.throws(()=>h.service.appendObservation('user-1',id,{...input,sceneAudioSourceId:'source-2'}),{code:'state_conflict'});
  assert.equal(h.repository.listEvents(id).filter(e=>e.eventId==='playback-1').length,1);
  h.service.end('user-1',id,'user_ended');
  assert.throws(()=>h.service.appendObservation('user-1',id,{...input,eventId:'late'}),{code:'state_conflict'});
});
