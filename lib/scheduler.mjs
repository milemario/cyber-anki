export const DAY = 86400000;
export const ratings = ['again', 'hard', 'good', 'easy'];

/** A small, deterministic spaced-repetition schedule, not Anki's FSRS algorithm. */
export function schedule(previous, rating, now = Date.now()) {
  if (!ratings.includes(rating)) throw new Error('Unknown rating');
  const p = previous ?? { reviews: 0, interval_days: 0, streak: 0, again_count: 0 };
  const oldInterval = Math.max(0, Number(p.interval_days) || 0);
  let delay;
  let interval;
  if (rating === 'again') { delay = 60000; interval = 0; }
  else if (rating === 'hard') { interval = oldInterval < 1 ? 0 : Math.min(180, Math.max(1, Math.ceil(oldInterval * 1.2))); delay = interval ? interval * DAY : 600000; }
  else if (rating === 'good') { interval = oldInterval < 1 ? 1 : Math.min(180, Math.max(oldInterval + 1, Math.ceil(oldInterval * 2.5))); delay = interval * DAY; }
  else { interval = Math.min(180, Math.max(4, Math.ceil(oldInterval * 3))); delay = interval * DAY; }
  return {
    due_at: now + delay,
    interval_days: interval,
    reviews: Number(p.reviews) + 1,
    again_count: Number(p.again_count) + (rating === 'again' ? 1 : 0),
    streak: rating === 'again' || rating === 'hard' ? 0 : Number(p.streak) + 1,
    last_rating: rating,
    updated_at: now,
  };
}
export function intervalLabel(previous, rating, now = Date.now()) {
  const delay = schedule(previous, rating, now).due_at - now;
  if (delay < 3600000) return `${Math.round(delay / 60000)} min`;
  const days = Math.round(delay / DAY);
  return `${days} ${days === 1 ? 'day' : 'days'}`;
}
export function isConfident(state) { return !!state && state.streak >= 3 && state.interval_days >= 7; }
export function selectQueue(cards, states, topic = 'all', now = Date.now(), limit = 10) {
  const filtered = cards.filter(card => topic === 'all' || card.topic === Number(topic));
  const due = filtered.filter(card => states[card.id] && states[card.id].due_at <= now)
    .sort((a, b) => states[a.id].due_at - states[b.id].due_at || a.id.localeCompare(b.id));
  const fresh = filtered.filter(card => !states[card.id]);
  return [...due, ...fresh].slice(0, limit).map(card => card.id);
}
