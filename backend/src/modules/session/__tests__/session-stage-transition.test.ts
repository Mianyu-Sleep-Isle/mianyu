import test from 'node:test';
import assert from 'node:assert/strict';
import { harness } from '../testing/harness.ts';

test('stage completion follows breath, story, soundscape, fade order',async()=>{
  const h=harness();const id=(await h.service.prepare('user-1','plan-1','scene-1')).session.sessionId;
  await h.service.start('user-1',id);
  for (const next of ['story','soundscape','fade_out']) {
    h.clock.advance(10);assert.equal(h.service.completeStage('user-1',id).session.currentStage,next);
  }
  h.service.setMasterVolume('user-1',id,0);
  h.clock.advance(10);const facts=h.service.completeStage('user-1',id);
  assert.equal(facts.session.status,'completed');
  assert.equal(facts.session.masterVolumeEnd,0);
  assert.equal(facts.events.filter(e=>e.eventType==='voice_removed').length,1);
  assert.equal(facts.events.filter(e=>e.eventType==='fade_completed').length,1);
});

test('skipping story records reason, zero duration and removes voice',async()=>{
  const h=harness();const id=(await h.service.prepare('user-1','plan-1','scene-1')).session.sessionId;
  await h.service.start('user-1',id);h.service.skipStage('user-1',id,'user_skip');
  const facts=h.service.skipStage('user-1',id,'user_skip');
  const story=facts.stages.find(s=>s.stageType==='story')!;
  assert.equal(story.status,'skipped');assert.equal(story.actualDurationSec,0);
  assert.equal(facts.session.currentStage,'soundscape');
  assert.ok(facts.events.some(e=>e.eventType==='voice_removed'));
  assert.throws(()=>h.service.skipStage('user-1',id,'again'),{code:'state_conflict'});
});
