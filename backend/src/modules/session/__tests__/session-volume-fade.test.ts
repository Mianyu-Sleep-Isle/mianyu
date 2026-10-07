import test from 'node:test';
import assert from 'node:assert/strict';
import { harness } from '../testing/harness.ts';

test('volume accepts 0..1, fade only decreases and reaches zero before completion',async()=>{
  const h=harness();const id=(await h.service.prepare('user-1','plan-1','scene-1')).session.sessionId;
  await h.service.start('user-1',id);
  assert.throws(()=>h.service.setMasterVolume('user-1',id,1.1),{code:'validation_error'});
  h.service.setMasterVolume('user-1',id,0.8);
  for(let i=0;i<3;i++) h.service.completeStage('user-1',id);
  h.service.setMasterVolume('user-1',id,0.5);
  assert.throws(()=>h.service.setMasterVolume('user-1',id,0.6),{code:'validation_error'});
  assert.throws(()=>h.service.completeStage('user-1',id),{code:'state_conflict'});
  h.service.setMasterVolume('user-1',id,0.2);
  h.service.setMasterVolume('user-1',id,0);
  const facts=h.service.completeStage('user-1',id);
  assert.equal(facts.session.masterVolumeEnd,0);
  assert.deepEqual(facts.events.filter(e=>e.eventType==='volume_changed').map(e=>Number(e.newValue)),[0.8,0.5,0.2,0]);
});
