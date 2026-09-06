"use client";
import { useEffect, useRef, useState } from 'react';
import { BookOpen, ArrowRight, ShieldCheck, RotateCcw, Check, LogOut, ChevronLeft, GraduationCap, Clock, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cards, cardMap, topics, curriculumUrl } from '@/lib/cards';
import { intervalLabel, isConfident, selectQueue } from '@/lib/scheduler.mjs';
import { api, apiOrigin, readSession, rememberSession, forgetSession, type Snapshot } from '@/lib/client';

export default function StudyApp() {
  const [code, setCode] = useState('');
  const [token, setToken] = useState('');
  const [data, setData] = useState<Snapshot | null>(null);
  const [topic, setTopic] = useState('all');
  const [queue, setQueue] = useState<string[] | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const [error, setError] = useState('');
  const [completed, setCompleted] = useState(0);
  const [sessionSize, setSessionSize] = useState(0);
  const [now, setNow] = useState(Date.now());
  const pending = useRef<{ cardId: string; rating: string; eventId: string } | null>(null);
  const inFlight = useRef(false);
  const questionRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const saved = readSession();
    if (!saved) { setRestoring(false); return; }
    setCode(saved.neptun);
    api('/api/progress', saved.token).then(result => { setToken(saved.token); setData(result); })
      .catch((e: Error & { status?: number }) => { if (e.status === 401) forgetSession(); else setError('Could not restore your session. Enter your code to try again.'); })
      .finally(() => setRestoring(false));
  }, []);
  useEffect(() => { const interval = setInterval(() => setNow(Date.now()), 15000); return () => clearInterval(interval); }, []);
  useEffect(() => { if (queue?.length) questionRef.current?.focus(); }, [queue?.[0]]);
  const state = data?.states ?? {};
  const selectedCards = cards.filter(card => topic === 'all' || card.topic === Number(topic));
  const due = selectedCards.filter(card => state[card.id]?.due_at <= now).length;
  const fresh = selectedCards.filter(card => !state[card.id]).length;
  const confident = selectedCards.filter(card => isConfident(state[card.id])).length;
  const reviewCount = Object.values(state).reduce((n, s) => n + s.reviews, 0);
  const current = queue?.length ? cardMap.get(queue[0]) : null;

  async function login(event: React.FormEvent) {
    event.preventDefault(); if (busy) return; setBusy(true); setError('');
    try { const result = await api('/api/session', '', { neptun: code }); setToken(result.token); setData(result); setCode(result.neptun); rememberSession(result.neptun, result.token); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not start practice. Try again.'); }
    finally { setBusy(false); }
  }
  function startSession() {
    const next = selectQueue(cards, state, topic, Date.now(), 10);
    setQueue(next); setSessionSize(next.length); setCompleted(0); setRevealed(false); setError(''); pending.current = null;
  }
  async function refresh() {
    if (busy) return; setBusy(true); setError('');
    try { setData(await api('/api/progress', token)); setQueue(null); pending.current = null; setNow(Date.now()); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not refresh.'); }
    finally { setBusy(false); }
  }
  async function rate(rating: string) {
    if (!current || !revealed || inFlight.current) return;
    if (pending.current && pending.current.rating !== rating) return;
    const review = pending.current ?? { cardId: current.id, rating, eventId: crypto.randomUUID() };
    pending.current = review; inFlight.current = true; setBusy(true); setError('');
    try {
      setData(await api('/api/review', token, review));
      pending.current = null; setCompleted(n => n + 1); setQueue(q => q ? q.slice(1) : q); setRevealed(false); setNow(Date.now());
    } catch (e) { setError(e instanceof Error ? e.message : 'Your review could not be saved. Retry the same rating.'); }
    finally { setBusy(false); inFlight.current = false; }
  }
  function logout() { if (busy) return; forgetSession(); setToken(''); setData(null); setQueue(null); setCode(''); setError(''); pending.current = null; }
  const nextDue = selectedCards.map(card => state[card.id]?.due_at).filter((time): time is number => !!time && time > now).sort((a, b) => a - b)[0];
  return <div className="study-shell">
    <header className="topbar">
      <a className="brand" href="./"><BookOpen aria-hidden="true" /><span>Cyber <strong>Anki</strong></span></a>
      <div className="header-right"><span className="course-code">ÁKIBTM013</span>{data ? <Button variant="ghost" onClick={logout} disabled={busy}><LogOut aria-hidden="true" /> {data.neptun}</Button> : <a className="teacher-link" href={`${apiOrigin}/admin`}><GraduationCap size={18} aria-hidden="true" /> Teacher</a>}</div>
    </header>
    {!data ? <main className="welcome">
      <div className="eyebrow">INTRODUCTION TO CYBERSECURITY</div>
      <h1>Make it stick.</h1>
      <p className="intro">Recall the answer. Reveal the card. Rate how well you remembered it. Tricky cards come back sooner.</p>
      <form className="entry-panel" onSubmit={login}>
        <label htmlFor="neptun">Your Neptun code</label>
        <Input id="neptun" autoCapitalize="characters" autoComplete="off" spellCheck={false} required pattern="[A-Za-z0-9]{6}" minLength={6} maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/[^a-z0-9]/gi, '').toUpperCase())} placeholder="ABC123" className="neptun-input" disabled={busy || restoring} aria-describedby="neptun-help" />
        <Button type="submit" className="start-button" disabled={!/^[A-Z0-9]{6}$/.test(code) || busy || restoring}>{restoring ? 'Restoring session…' : busy ? 'Opening your cards…' : 'Start practising'}<ArrowRight aria-hidden="true" /></Button>
        <p className="small-note"><ShieldCheck size={17} aria-hidden="true" />Your teacher can see your practice progress.</p>
        <p id="neptun-help" className="privacy-note">Use only your own code. It identifies your practice record; it is not a password or a verified university sign-in.</p>
        {error && <p className="error" role="alert">{error}</p>}
      </form>
      <div className="welcome-facts"><span><Layers size={18} />{cards.length} cards</span><span><BookOpen size={18} />14 topics</span><span><Clock size={18} />10-card sessions</span></div>
      <a className="curriculum-link" href={curriculumUrl} target="_blank" rel="noreferrer">Based on the NKE course curriculum</a>
    </main> : <main className="practice">
      <div className="practice-heading"><div><div className="eyebrow">YOUR PRACTICE</div><h1>{queue === null ? 'Ready when you are.' : queue.length ? 'One card at a time.' : 'Session complete.'}</h1></div>{queue !== null && <Button variant="outline" onClick={() => { if (!pending.current) { setQueue(null); setError(''); } }} disabled={busy || !!pending.current}><ChevronLeft aria-hidden="true" /> Topics</Button>}</div>
      {queue === null ? <>
        <div className="study-toolbar"><label htmlFor="topic-picker">What would you like to practise?</label><Select value={topic} onValueChange={setTopic}><SelectTrigger id="topic-picker" className="topic-picker"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All course topics</SelectItem>{topics.map((name, i) => <SelectItem key={name} value={String(i)}>{String(i + 1).padStart(2, '0')} · {name}</SelectItem>)}</SelectContent></Select></div>
        <div className="stats"><div><strong>{due}</strong><span>Due for review</span></div><div><strong>{fresh}</strong><span>Not practised yet</span></div><div><strong>{confident}</strong><span>Remembered consistently</span></div></div>
        <section className="session-panel"><div><h2>{due + fresh > 0 ? 'Your next 10 cards' : 'You’re up to date.'}</h2><p>{due + fresh > 0 ? 'Due cards come first, followed by new cards. Your progress is saved after each review.' : nextDue ? `Next review: ${new Date(nextDue).toLocaleString()}. Choose another topic or come back then.` : 'Choose another topic to keep practising.'}</p></div><Button className="primary-action" onClick={startSession} disabled={!due && !fresh}>Practise {Math.min(10, due + fresh)} cards<ArrowRight aria-hidden="true" /></Button></section>
        <div className="coverage-heading"><h2>Course topics</h2><span>{reviewCount} reviews saved</span></div>
        <div className="topic-grid">{topics.map((name, i) => { const group = cards.filter(card => card.topic === i); const seen = group.filter(card => state[card.id]).length; return <button className={`topic-card ${topic === String(i) ? 'selected' : ''}`} key={name} onClick={() => setTopic(String(i))}><span className="topic-number">{String(i + 1).padStart(2, '0')}</span><span className="topic-name">{name}</span><span className="topic-count">{seen} / {group.length} practised</span><Progress value={seen / group.length * 100} aria-label={`${name}: ${seen} of ${group.length} practised`} /></button>; })}</div>
      </> : current ? <>
        <div className="session-progress"><span>{completed} of {sessionSize} reviewed</span><Progress value={completed / sessionSize * 100} aria-label="Session progress" /></div>
        <article className="flashcard"><div className="card-meta"><span>TOPIC {String(current.topic + 1).padStart(2, '0')} · {topics[current.topic]}</span><span>{state[current.id] ? 'REVIEW' : 'NEW CARD'}</span></div><h2 tabIndex={-1} ref={questionRef}>{current.question}</h2>
          {revealed ? <div className="answer" aria-live="polite"><div className="eyebrow">ANSWER</div><p>{current.answer}</p><div className="example"><strong>For example</strong><p>{current.example}</p></div></div> : <div className="recall-prompt">Try answering in your own words before revealing.</div>}
        </article>
        {!revealed ? <Button className="reveal-button" onClick={() => setRevealed(true)}>Show answer</Button> : <div className="rating-section"><p>How well did you remember it?</p><div className="ratings">{['again', 'hard', 'good', 'easy'].map((rating, i) => <Button key={rating} className={`rating ${rating}`} variant="outline" disabled={busy || (!!pending.current && pending.current.rating !== rating)} onClick={() => rate(rating)}><span>{busy && pending.current?.rating === rating ? 'Saving…' : ['Again', 'Hard', 'Good', 'Easy'][i]}</span><small>{intervalLabel(state[current.id], rating)}</small></Button>)}</div><p className="rating-hint">Again = I missed it · Hard = partial recall · Good = recalled it · Easy = effortless</p></div>}
      </> : <section className="completion"><div className="completion-icon"><Check size={30} aria-hidden="true" /></div><h2>{completed} cards reviewed.</h2><p>Your progress is saved. Cards you found difficult return sooner.</p><p className="small-note">“Again” cards are due after one minute; “Hard” cards return after their shown interval.</p><Button className="primary-action" onClick={() => { setQueue(null); setNow(Date.now()); }}>Back to practice<ArrowRight aria-hidden="true" /></Button></section>}
      {error && <div className="error" role="alert"><p>{error}</p><p>If saving was interrupted, retry the same rating. You will not be counted twice.</p><Button variant="outline" onClick={refresh} disabled={busy}><RotateCcw size={16} /> Refresh session</Button></div>}
      <footer className="practice-footer"><span>Self-assessed practice, not an exam score.</span><Button variant="ghost" onClick={refresh} disabled={busy}><RotateCcw size={16} /> Refresh progress</Button><a href={`${apiOrigin}/admin`}>Teacher view</a></footer>
    </main>}
  </div>;
}
