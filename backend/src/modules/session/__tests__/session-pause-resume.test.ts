import test from 'node:test';
import assert from 'node:assert/strict';
import { harness } from '../testing/harness.ts';

test('pause and resume alternate and exclude paused time',async()=>{
  const h=harness();const id=(await h.service.prepare('user-1','plan-1','scene-1')).session.sessionId;
  await h.service.start('user-1',id);h.clock.advance(10);
  assert.equal(h.service.pause('user-1',id).session.activePlaybackSec,10);
  h.service.pause('user-1',id);h.clock.advance(300);
  assert.equal(h.service.resume('user-1',id).session.pausedSec,300);
  h.service.resume('user-1',id);h.clock.advance(20);
  const facts=h.service.end('user-1',id,'user_ended');
  assert.equal(facts.session.activePlaybackSec,30);
  assert.equal(facts.session.pausedSec,300);
  assert.equal(facts.events.filter(e=>e.eventType==='paused').length,1);
  assert.equal(facts.events.filter(e=>e.eventType==='resumed').length,1);
});

test('interrupting a paused session closes the current stage and counts pause time',async()=>{
  const h=harness();const id=(await h.service.prepare('user-1','plan-1','scene-1')).session.sessionId;
  await h.service.start('user-1',id);h.clock.advance(12);h.service.pause('user-1',id);
  h.clock.advance(8);const facts=h.service.end('user-1',id,'app_interrupted');
  assert.equal(facts.session.status,'failed');
  assert.equal(facts.session.activePlaybackSec,12);
  assert.equal(facts.session.pausedSec,8);
  assert.equal(facts.stages[0]?.status,'failed');
  assert.equal(facts.stages[0]?.actualDurationSec,12);
});
