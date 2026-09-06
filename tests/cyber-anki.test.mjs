import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { cards, topics } from '../lib/cards.ts';
import { schedule, DAY, selectQueue, isConfident } from '../lib/scheduler.mjs';
import { handleApi } from '../lib/service.ts';

function database() {
  const sql = new DatabaseSync(':memory:');
  sql.exec('PRAGMA foreign_keys=ON');
  for (const name of readdirSync(new URL('../drizzle/', import.meta.url)).filter(n => n.endsWith('.sql')).sort()) sql.exec(readFileSync(new URL(`../drizzle/${name}`, import.meta.url), 'utf8'));
  const db = { sql, prepare(query) {
    const prepared = sql.prepare(query);
    let values = [];
    return { bind(...args) { values = args; return this; },
      async first() { return prepared.get(...values) ?? null; },
      async all() { return { results: prepared.all(...values) }; },
      async run() { const result = prepared.run(...values); return { meta: { changes: Number(result.changes) } }; },
    };
  }, async batch(statements) { sql.exec('BEGIN'); try { const result = []; for (const s of statements) result.push(await s.run()); sql.exec('COMMIT'); return result; } catch (e) { sql.exec('ROLLBACK'); throw e; } } };
  // D1 serialises each atomic batch. Keep that behaviour for parallel requests in tests.
  let chain = Promise.resolve(); const batch = db.batch.bind(db);
  db.batch = statements => { const result = chain.then(() => batch(statements)); chain = result.catch(() => {}); return result; };
  return db;
}
const settings = { ADMIN_EMAIL: 'teacher@example.test' };
const teacher = { 'oai-authenticated-user-id': 'teacher-site-id', 'oai-authenticated-user-email': 'teacher@example.test' };
async function call(db, path, body, token = '', extra = {}) {
  const response = await handleApi(new Request(`https://example.test${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra }, body: body === undefined ? undefined : JSON.stringify(body) }), db, settings);
  return { status: response.status, body: await response.json() };
}
const review = (cardId, rating = 'good') => ({ cardId, rating, eventId: crypto.randomUUID() });

test('curriculum has exactly eight unique, complete cards in every topic', () => {
  assert.equal(topics.length, 14); assert.equal(cards.length, 112); assert.equal(new Set(cards.map(c => c.id)).size, 112);
  assert.equal(new Set(cards.map(c => c.question)).size, 112);
  for (let i = 0; i < 14; i++) assert.equal(cards.filter(c => c.topic === i).length, 8);
  for (const c of cards) for (const value of [c.question, c.answer, c.example]) assert.ok(value.length > 15);
});
test('initial intervals and lapse behaviour keep difficult cards due sooner', () => {
  const now = 100000; assert.equal(schedule(null, 'again', now).due_at, now + 60000);
  assert.equal(schedule(null, 'hard', now).due_at, now + 600000);
  assert.equal(schedule(null, 'good', now).due_at, now + DAY);
  assert.equal(schedule(null, 'easy', now).due_at, now + 4 * DAY);
  let s = null; for (let i = 0; i < 3; i++) s = schedule(s, 'good', now);
  assert.equal(isConfident(s), true); const lapse = schedule(s, 'again', now);
  assert.equal(isConfident(lapse), false); assert.equal(lapse.again_count, 1); assert.equal(lapse.reviews, 4);
});
test('queue prioritises due cards, excludes future cards, and respects selected topic', () => {
  const states = { 't01-01': { due_at: 9999 }, 't01-02': { due_at: 10 }, 't02-01': { due_at: 5 } };
  assert.equal(selectQueue(cards, states, 'all', 100, 3)[0], 't02-01');
  const queue = selectQueue(cards, states, '0', 100, 10);
  assert.equal(queue[0], 't01-02'); assert.ok(!queue.includes('t01-01')); assert.ok(queue.every(id => id.startsWith('t01')));
});
test('student sessions normalise Neptun, protect APIs, and keep progress across sessions', async () => {
  const db = database(); assert.equal((await call(db, '/api/session', { neptun: 'wrong' })).status, 400);
  assert.equal((await call(db, '/api/progress')).status, 401);
  const login = await call(db, '/api/session', { neptun: ' abc123 ' }); assert.equal(login.status, 200); assert.equal(login.body.neptun, 'ABC123');
  assert.equal((await call(db, '/api/review', review('t01-01'), login.body.token)).status, 200);
  const again = await call(db, '/api/session', { neptun: 'ABC123' }); assert.equal(again.body.states['t01-01'].reviews, 1);
  assert.equal(db.sql.prepare('SELECT count(*) AS n FROM students').get().n, 1);
});
test('retries do not double count, including replay after other reviews', async () => {
  const db = database(); const login = await call(db, '/api/session', { neptun: 'ABC123' }); const token = login.body.token;
  const first = review('t01-01', 'again');
  assert.equal((await call(db, '/api/review', first, token)).status, 200);
  assert.equal((await call(db, '/api/review', review('t01-02'), token)).status, 200);
  const retry = await call(db, '/api/review', first, token); assert.equal(retry.status, 200); assert.equal(retry.body.states['t01-01'].reviews, 1);
  assert.equal(db.sql.prepare('SELECT count(*) AS n FROM reviews').get().n, 2);
  assert.equal((await call(db, '/api/review', { ...first, rating: 'easy' }, token)).status, 409);
});
test('parallel duplicate requests commit a review only once', async () => {
  const db = database(); const login = await call(db, '/api/session', { neptun: 'ABC123' }); const event = review('t01-01');
  const results = await Promise.all([call(db, '/api/review', event, login.body.token), call(db, '/api/review', event, login.body.token)]);
  assert.deepEqual(results.map(r => r.status), [200, 200]); assert.equal(db.sql.prepare('SELECT reviews FROM progress').get().reviews, 1);
});
test('parallel different reviews on the same card cannot overwrite a newer revision', async () => {
  const db = database(); const login = await call(db, '/api/session', { neptun: 'ABC123' });
  const results = await Promise.all([call(db, '/api/review', review('t01-01', 'good'), login.body.token), call(db, '/api/review', review('t01-01', 'again'), login.body.token)]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 409]); assert.equal(db.sql.prepare('SELECT reviews FROM progress').get().reviews, 1);
});
test('only the configured teacher gets the class roster; students cannot choose scheduling values', async () => {
  const db = database(); const login = await call(db, '/api/session', { neptun: 'XYZ789' });
  const fake = { ...review('t01-01'), reviews: 999, interval_days: 999 };
  await call(db, '/api/review', fake, login.body.token);
  assert.equal((await call(db, '/api/admin/progress', undefined, login.body.token)).status, 403);
  assert.equal((await call(db, '/api/admin/progress', undefined, '', { ...teacher, 'oai-authenticated-user-email': 'other@example.test' })).status, 403);
  const result = await call(db, '/api/admin/progress', undefined, '', teacher); assert.equal(result.status, 200);
  assert.equal(result.body.students[0].reviews, 1); assert.equal(result.body.students[0].topics[0].seen, 1);
  assert.equal((await call(db, '/api/review', review('not-a-card'), login.body.token)).status, 400);
});
