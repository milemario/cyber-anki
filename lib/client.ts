export type State = { card_id: string; due_at: number; interval_days: number; reviews: number; again_count: number; streak: number; last_rating: string; updated_at: number };
export type Snapshot = { neptun: string; states: Record<string, State>; serverTime: number; token?: string };
// The Pages build replaces this constant. The hosted app uses its own origin.
declare const __CYBER_API_ORIGIN__: string;
export const apiOrigin = typeof __CYBER_API_ORIGIN__ === 'undefined' ? '' : __CYBER_API_ORIGIN__;
export async function api(path: string, token = '', body?: unknown) {
  const response = await fetch(`${apiOrigin}${path}`, { method: body === undefined ? 'GET' : 'POST',
    headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store', signal: AbortSignal.timeout(20000),
  });
  let result;
  try { result = await response.json(); } catch { throw new Error('The practice service could not be reached. Please try again.'); }
  if (!response.ok) throw Object.assign(new Error(result.error || 'The request could not be completed.'), { status: response.status });
  return result;
}
export function readSession(): { neptun: string; token: string } | null {
  try { const value = JSON.parse(localStorage.getItem('cyber-anki-session') || 'null'); return value?.token && value?.neptun ? value : null; } catch { return null; }
}
export function rememberSession(neptun: string, token: string) { try { localStorage.setItem('cyber-anki-session', JSON.stringify({ neptun, token })); } catch { /* Session still works in this tab. */ } }
export function forgetSession() { try { localStorage.removeItem('cyber-anki-session'); } catch { /* Storage may be disabled. */ } }
