import { cards, cardMap, topics } from './cards.ts';
import { schedule, ratings, isConfident } from './scheduler.mjs';

export type Database = { prepare: (sql: string) => any; batch: (queries: any[]) => Promise<any[]> };
type Settings = { ADMIN_EMAIL?: string };
const SESSION_MS = 30 * 86400000;
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
async function hash(value: string) { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))).map(x => x.toString(16).padStart(2, '0')).join(''); }
async function payload(request: Request) {
  const raw = await request.text();
  if (raw.length > 4096) throw new Error('BAD_REQUEST');
  const body = JSON.parse(raw);
  if (!body || Array.isArray(body) || typeof body !== 'object') throw new Error('BAD_REQUEST');
  return body;
}
async function snapshot(db: Database, neptun: string) {
  const result = await db.prepare('SELECT card_id,due_at,interval_days,reviews,again_count,streak,last_rating,updated_at FROM progress WHERE neptun=?').bind(neptun).all();
  const rows = result.results.filter((row: any) => cardMap.has(row.card_id));
  return { neptun, states: Object.fromEntries(rows.map((row: any) => [row.card_id, row])), serverTime: Date.now() };
}
async function identify(request: Request, db: Database) {
  const token = request.headers.get('Authorization')?.replace(/^Bearer /, '') ?? '';
  if (!/^[a-f0-9-]{73}$/.test(token)) return null;
  return await db.prepare('SELECT neptun FROM sessions WHERE token_hash=? AND expires_at>?').bind(await hash(token), Date.now()).first();
}
function isTeacher(request: Request, env: Settings) {
  const userId = request.headers.get('oai-authenticated-user-id');
  const email = request.headers.get('oai-authenticated-user-email');
  return !!userId && !!env.ADMIN_EMAIL && email?.toLowerCase() === env.ADMIN_EMAIL.toLowerCase();
}
export async function handleApi(request: Request, db: Database, env: Settings = {}) {
  const path = new URL(request.url).pathname.replace(/\/$/, '');
  const now = Date.now();
  try {
    if (path === '/api/health' && request.method === 'GET') {
      await db.prepare('SELECT neptun FROM students LIMIT 1').first();
      return json({ ok: true, cards: cards.length });
    }
    if (path === '/api/session' && request.method === 'POST') {
      const body = await payload(request);
      const neptun = typeof body.neptun === 'string' ? body.neptun.trim().toUpperCase() : '';
      if (!/^[A-Z0-9]{6}$/.test(neptun)) return json({ error: 'Enter a six-character Neptun code using letters and numbers.' }, 400);
      // A Neptun code is an identifier, not identity verification. This is self-rated practice.
      const token = `${crypto.randomUUID()}-${crypto.randomUUID()}`;
      await db.batch([
        db.prepare('INSERT INTO students(neptun,created_at,last_seen) VALUES(?,?,?) ON CONFLICT(neptun) DO UPDATE SET last_seen=excluded.last_seen').bind(neptun, now, now),
        db.prepare('INSERT INTO sessions(token_hash,neptun,expires_at) VALUES(?,?,?)').bind(await hash(token), neptun, now + SESSION_MS),
        db.prepare('DELETE FROM sessions WHERE expires_at<?').bind(now),
      ]);
      return json({ ...await snapshot(db, neptun), token });
    }
    if (path === '/api/progress' && request.method === 'GET') {
      const user = await identify(request, db);
      if (!user) return json({ error: 'Please enter your Neptun code again.' }, 401);
      return json(await snapshot(db, user.neptun));
    }
    if (path === '/api/review' && request.method === 'POST') {
      const user = await identify(request, db);
      if (!user) return json({ error: 'Please enter your Neptun code again.' }, 401);
      const body = await payload(request);
      if (!cardMap.has(body.cardId) || !ratings.includes(body.rating) || typeof body.eventId !== 'string' || !/^[a-f0-9-]{36}$/.test(body.eventId)) return json({ error: 'This review could not be validated. Please reload your practice.' }, 400);
      const existing = await db.prepare('SELECT neptun,card_id,rating FROM reviews WHERE event_id=?').bind(body.eventId).first();
      if (existing) {
        if (existing.neptun !== user.neptun || existing.card_id !== body.cardId || existing.rating !== body.rating) return json({ error: 'Review identifier already used.' }, 409);
        return json(await snapshot(db, user.neptun));
      }
      const old = await db.prepare('SELECT * FROM progress WHERE neptun=? AND card_id=?').bind(user.neptun, body.cardId).first();
      if (old && now - old.updated_at < 1500) return json({ error: 'That card was just saved. Please refresh your session.' }, 409);
      const next = schedule(old, body.rating, now);
      const revision = old?.reviews ?? 0;
      const results = await db.batch([
        db.prepare(`INSERT INTO reviews(event_id,neptun,card_id,rating,created_at,applied)
          SELECT ?,?,?,?,?,0 WHERE COALESCE((SELECT reviews FROM progress WHERE neptun=? AND card_id=?),0)=?
          ON CONFLICT(event_id) DO NOTHING`).bind(body.eventId, user.neptun, body.cardId, body.rating, now, user.neptun, body.cardId, revision),
        db.prepare(`INSERT INTO progress(neptun,card_id,due_at,interval_days,reviews,again_count,streak,last_rating,updated_at)
          SELECT ?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM reviews WHERE event_id=? AND neptun=? AND applied=0)
          ON CONFLICT(neptun,card_id) DO UPDATE SET due_at=excluded.due_at,interval_days=excluded.interval_days,reviews=excluded.reviews,again_count=excluded.again_count,streak=excluded.streak,last_rating=excluded.last_rating,updated_at=excluded.updated_at`).bind(user.neptun, body.cardId, next.due_at, next.interval_days, next.reviews, next.again_count, next.streak, next.last_rating, now, body.eventId, user.neptun),
        db.prepare('UPDATE reviews SET applied=1 WHERE event_id=? AND neptun=? AND applied=0').bind(body.eventId, user.neptun),
        db.prepare('UPDATE students SET last_seen=? WHERE neptun=?').bind(now, user.neptun),
      ]);
      // A racing duplicate is a successful retry; a racing different review needs a reload.
      if (!results[0].meta.changes) {
        const saved = await db.prepare('SELECT neptun,card_id,rating FROM reviews WHERE event_id=?').bind(body.eventId).first();
        if (!saved || saved.neptun !== user.neptun || saved.card_id !== body.cardId || saved.rating !== body.rating) return json({ error: 'Progress changed in another tab. Refresh your session to continue.' }, 409);
      }
      return json(await snapshot(db, user.neptun));
    }
    if (path === '/api/admin/status' && request.method === 'GET') {
      if (!request.headers.get('oai-authenticated-user-id')) return json({ error: 'Teacher sign-in is required.' }, 401);
      return json({ configured: !!env.ADMIN_EMAIL, authorised: isTeacher(request, env) });
    }
    if (path === '/api/admin/progress' && request.method === 'GET') {
      if (!isTeacher(request, env)) return json({ error: 'Only the registered teacher can view class progress.' }, 403);
      const enrolled = await db.prepare('SELECT neptun,created_at,last_seen FROM students ORDER BY last_seen DESC').all();
      const allProgress = await db.prepare('SELECT * FROM progress').all();
      const rows = enrolled.results.map((student: any) => {
        const states = allProgress.results.filter((p: any) => p.neptun === student.neptun && cardMap.has(p.card_id));
        return { ...student, seen: states.length, reviews: states.reduce((sum: number, p: any) => sum + p.reviews, 0),
          confident: states.filter(isConfident).length, due: states.filter((p: any) => p.due_at <= now).length,
          again: states.reduce((sum: number, p: any) => sum + p.again_count, 0),
          topics: Array.from({ length: topics.length }, (_, topic) => {
            const group = states.filter((p: any) => cardMap.get(p.card_id)?.topic === topic);
            return { seen: group.length, confident: group.filter(isConfident).length, reviews: group.reduce((n: number, p: any) => n + p.reviews, 0), again: group.reduce((n: number, p: any) => n + p.again_count, 0) };
          }),
        };
      });
      return json({ students: rows, totalCards: cards.length, serverTime: now });
    }
    return json({ error: 'Not found.' }, 404);
  } catch (error) {
    if (error instanceof SyntaxError || (error instanceof Error && error.message === 'BAD_REQUEST')) return json({ error: 'Please check the submitted information.' }, 400);
    console.error('Cyber Anki request failed', error instanceof Error ? error.message : 'Unknown error');
    return json({ error: 'Practice progress is temporarily unavailable. Your answer has not been discarded; please try again.' }, 503);
  }
}
