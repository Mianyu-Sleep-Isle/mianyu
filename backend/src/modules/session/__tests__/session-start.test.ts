import test from 'node:test';
import assert from 'node:assert/strict';
import { harness } from '../testing/harness.ts';
import { FakeAudioDevice } from '../testing/fakes.ts';
import { SleepSessionService } from '../service.ts';

test('audio started acknowledgement makes session running and publishes one stable fact',async()=>{
  const h=harness();const prepared=await h.service.prepare('user-1','plan-1','scene-1');
  h.clock.advance(3);
  const first=await h.service.start('user-1',prepared.session.sessionId);
  assert.equal(first.session.status,'running');
  assert.equal(first.session.startedAt,h.clock.now().toISOString());
  assert.equal(first.stages[0].status,'running');
  await h.service.start('user-1',prepared.session.sessionId);
  assert.equal(h.publisher.facts.size,1);
  assert.equal([...h.publisher.facts.values()][0].eventId,prepared.session.sessionId);
  assert.equal(h.repository.listEvents(prepared.session.sessionId).filter(e=>e.eventType==='session_started').length,1);
});

test('foreign user and terminated session cannot start',async()=>{
  const h=harness();const id=(await h.service.prepare('user-1','plan-1','scene-1')).session.sessionId;
  await assert.rejects(h.service.start('user-2',id),{code:'forbidden'});
  h.service.end('user-1',id,'user_cancelled_before_start');
  await assert.rejects(h.service.start('user-1',id),{code:'state_conflict'});
});

test('fake audio callback leaves session preparing until playback actually starts',async()=>{
  const h=harness(),audio=new FakeAudioDevice();
  const id=(await h.service.prepare('user-1','plan-1','scene-1')).session.sessionId;
  audio.onStarted=async()=>{await h.service.start('user-1',id);};
  assert.equal(h.service.getSessionFacts(id,'user-1').session.status,'preparing');
  audio.load();await audio.play();
  assert.equal(h.service.getSessionFacts(id,'user-1').session.status,'running');
  assert.equal(h.publisher.facts.size,1);
});

test('start acknowledgement cannot reset a paused session',async()=>{
  const h=harness();const id=(await h.service.prepare('user-1','plan-1','scene-1')).session.sessionId;
  await h.service.start('user-1',id);h.clock.advance(5);h.service.pause('user-1',id);
  const startedAt=h.service.getSessionFacts(id,'user-1').session.startedAt;
  await assert.rejects(h.service.start('user-1',id),{code:'state_conflict'});
  assert.equal(h.service.getSessionFacts(id,'user-1').session.startedAt,startedAt);
});

test('publish failure can be retried with the same fact ID',async()=>{
  const h=harness();const id=(await h.service.prepare('user-1','plan-1','scene-1')).session.sessionId;
  let attempts=0;
  const service=new SleepSessionService({...h,publisher:{async publishPlanStarted(fact){
    attempts++;
    if (attempts===1) throw new Error('bus offline');
    await h.publisher.publishPlanStarted(fact);
  }}});
  await assert.rejects(service.start('user-1',id),/bus offline/);
  assert.equal(h.repository.getSession(id)?.status,'running');
  await service.start('user-1',id);
  assert.equal(h.publisher.facts.size,1);
  assert.equal(h.repository.listEvents(id).filter(e=>e.eventType==='session_started').length,1);
});

test('fake audio error callback closes a running session as failed',async()=>{
  const h=harness(),audio=new FakeAudioDevice();
  const id=(await h.service.prepare('user-1','plan-1','scene-1')).session.sessionId;
  audio.onStarted=async()=>{await h.service.start('user-1',id);};
  audio.onError=()=>{h.service.end('user-1',id,'audio_engine_error');};
  audio.load();await audio.play();audio.fail();
  assert.equal(h.service.getSessionFacts(id,'user-1').session.status,'failed');
});
