import test from 'node:test';
import assert from 'node:assert/strict';
import { harness } from '../testing/harness.ts';

test('migration enforces append-only events and valid state',async()=>{
  const h=harness();const id=(await h.service.prepare('user-1','plan-1','scene-1')).session.sessionId;
  const event=h.repository.listEvents(id)[0];
  assert.throws(()=>h.db.prepare('UPDATE playback_event SET event_type=? WHERE event_id=?').run('paused',event.eventId),/append-only/);
  assert.throws(()=>h.db.prepare('DELETE FROM playback_event WHERE event_id=?').run(event.eventId),/append-only/);
  assert.throws(()=>h.db.prepare('UPDATE sleep_session SET status=? WHERE session_id=?').run('asleep',id),/CHECK constraint/);
  assert.equal(h.db.prepare('PRAGMA foreign_key_check').all().length,0);
});
