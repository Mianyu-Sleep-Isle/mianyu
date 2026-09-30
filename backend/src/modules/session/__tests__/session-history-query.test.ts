import test from 'node:test';
import assert from 'node:assert/strict';
import { harness } from '../testing/harness.ts';

test('history filters by user and 7/30 day windows',async()=>{
  const h=harness();const old=(await h.service.prepare('user-1','plan-1','scene-1')).session.sessionId;
  await h.service.start('user-1',old);
  h.clock.advance(10*86400);
  const recent=(await h.service.prepare('user-1','plan-1','scene-1')).session.sessionId;
  await h.service.start('user-1',recent);
  assert.deepEqual(h.service.listHistory('user-1',7).map(s=>s.sessionId),[recent]);
  assert.equal(h.service.listHistory('user-1',30).length,2);
  assert.equal(h.service.listHistory('user-2',30).length,0);
  assert.throws(()=>h.service.getSessionFacts(old,'user-2'),{code:'not_found'});
  assert.throws(()=>h.service.listHistory('user-1',8 as 7),{code:'validation_error'});
});

test('history excludes preparation that never played',async()=>{
  const h=harness();await h.service.prepare('user-1','plan-1','scene-1');
  assert.equal(h.service.listHistory('user-1',7).length,0);
});
