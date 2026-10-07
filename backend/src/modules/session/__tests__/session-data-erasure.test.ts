import test from 'node:test';
import assert from 'node:assert/strict';
import { harness } from '../testing/harness.ts';

test('user data erasure removes own sessions, stages and events and is repeatable',async()=>{
  const h=harness();const id=(await h.service.prepare('user-1','plan-1','scene-1')).session.sessionId;
  assert.equal(h.service.eraseUserData('user-1'),1);
  assert.equal(h.service.eraseUserData('user-1'),0);
  assert.equal(h.repository.getSession(id),null);
  assert.equal(h.repository.listStages(id).length,0);
  assert.equal(h.repository.listEvents(id).length,0);
});
