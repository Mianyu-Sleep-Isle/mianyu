import test from 'node:test';
import assert from 'node:assert/strict';
import { harness } from '../testing/harness.ts';

test('prepare writes only preparation facts and ordered stages',async()=>{
  const h=harness();
  const facts=await h.service.prepare('user-1','plan-1','scene-1');
  assert.equal(facts.session.status,'preparing');
  assert.equal(facts.session.startedAt,null);
  assert.deepEqual(facts.stages.map(s=>s.stageType),['breath','story','soundscape','fade_out']);
  assert.deepEqual(facts.events.map(e=>e.eventType),['session_preparing']);
  assert.equal(h.publisher.facts.size,0);
});

test('prepare refuses unconfirmed, mismatched and foreign inputs',async()=>{
  const h=harness();
  await assert.rejects(h.service.prepare('user-2','plan-1','scene-1'),{code:'forbidden'});
  h.plans.plans.get('plan-1')!.status='draft';
  await assert.rejects(h.service.prepare('user-1','plan-1','scene-1'),{code:'validation_error'});
  h.plans.plans.get('plan-1')!.status='confirmed';
  h.scenes.scenes.get('scene-1')!.sourcePlanId='another';
  await assert.rejects(h.service.prepare('user-1','plan-1','scene-1'),{code:'validation_error'});
  assert.equal(h.repository.listSessions('user-1','2000-01-01').length,0);
});

test('missing required resource fails without a false start',async()=>{
  const h=harness();h.resources.resources.clear();
  await assert.rejects(h.service.prepare('user-1','plan-1','scene-1'),{code:'resource_unavailable'});
  const s=h.db.prepare('SELECT session_id,status,started_at FROM sleep_session WHERE user_id=?').get('user-1') as {session_id:string,status:string,started_at:string|null};
  assert.equal(s.status,'failed');assert.equal(s.started_at,null);
  assert.deepEqual(h.repository.listEvents(s.session_id).map(e=>e.eventType).sort(),['resource_missing','session_preparing','session_ended'].sort());
});

test('missing optional source is recorded while playable source continues',async()=>{
  const h=harness();
  h.scenes.scenes.get('scene-1')!.sources.push({sourceId:'source-2',trackId:'missing',enabled:true,required:false});
  const facts=await h.service.prepare('user-1','plan-1','scene-1');
  assert.equal(facts.session.status,'preparing');
  assert.equal(facts.events.filter(e=>e.eventType==='resource_missing').length,1);
});

test('missing required source fails even when another source is playable',async()=>{
  const h=harness();
  h.scenes.scenes.get('scene-1')!.sources.push({sourceId:'source-2',trackId:'missing',enabled:true,required:true});
  await assert.rejects(h.service.prepare('user-1','plan-1','scene-1'),{code:'resource_unavailable'});
});
