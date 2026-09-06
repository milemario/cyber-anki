"use client";
import { useEffect, useState } from 'react';
import { BookOpen, Download, RefreshCw, ArrowLeft, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cards, topics } from '@/lib/cards';
import { api } from '@/lib/client';
type Topic = { seen: number; confident: number; reviews: number; again: number };
type Student = { neptun: string; seen: number; reviews: number; confident: number; due: number; again: number; last_seen: number; topics: Topic[] };
export default function AdminApp() {
  const [status, setStatus] = useState<{ configured: boolean; authorised: boolean } | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(true);
  const [filter, setFilter] = useState(''); const [selected, setSelected] = useState<string | null>(null); const [updated, setUpdated] = useState(0);
  async function load() { setBusy(true); setError(''); try { const s = await api('/api/admin/status'); setStatus(s); if (s.authorised) { const d = await api('/api/admin/progress'); setStudents(d.students); setUpdated(d.serverTime); } } catch (e) { setError(e instanceof Error ? e.message : 'Could not load progress.'); } finally { setBusy(false); } }
  useEffect(() => { load(); }, []);
  function exportCsv() {
    const header = ['Neptun', 'Cards practised', 'Reviews', 'Remembered consistently', 'Due', 'Again ratings', 'Last active UTC', ...topics.flatMap((t, i) => [`${i + 1}. ${t}: practised`, `${i + 1}. ${t}: reviews`, `${i + 1}. ${t}: again`])];
    const rows = students.map(s => [s.neptun, s.seen, s.reviews, s.confident, s.due, s.again, new Date(s.last_seen).toISOString(), ...s.topics.flatMap(t => [t.seen, t.reviews, t.again])]);
    const csv = '\ufeff' + [header, ...rows].map(row => row.map(x => `"${String(x).replaceAll('"', '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); const link = document.createElement('a'); link.href = url; link.download = `cyber-anki-progress-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const visible = students.filter(s => s.neptun.includes(filter.toUpperCase())); const student = students.find(s => s.neptun === selected);
  return <div className="study-shell"><header className="topbar"><a href="/" className="brand"><BookOpen aria-hidden="true" /><span>Cyber <strong>Anki</strong></span></a><div className="header-right"><span className="teacher-badge"><ShieldCheck size={16} />Teacher view</span><a href="/signout-with-chatgpt?return_to=/">Sign out</a></div></header>
    <main className="admin-main"><a href="/" className="back-link"><ArrowLeft size={16} />Student practice</a><div className="practice-heading"><div><div className="eyebrow">CLASS PROGRESS</div><h1>A view of the practice.</h1></div>{status?.authorised && <div className="admin-actions"><Button variant="outline" onClick={load} disabled={busy}><RefreshCw size={17} />Refresh</Button><Button onClick={exportCsv} disabled={!students.length}><Download size={17} />Export CSV</Button></div>}</div>
      {error && <p className="error" role="alert">{error} <Button variant="outline" onClick={load}>Try again</Button></p>}
      {busy && !status && <p role="status">Loading teacher access…</p>}
      {status && !status.configured && <p className="error">Teacher access has not been configured yet.</p>}
      {status?.configured && !status.authorised && <section className="session-panel"><div><h2>This account does not have teacher access.</h2><p>Sign out and use your site-owner account.</p></div></section>}
      {status?.authorised && <>
        <p className="intro admin-intro">Practice activity and students’ own recall ratings. These figures do not verify identity or measure examination performance.</p>
        <div className="stats"><div><strong>{students.length}</strong><span>Students started</span></div><div><strong>{students.reduce((n, s) => n + s.reviews, 0)}</strong><span>Reviews recorded</span></div><div><strong>{students.filter(s => s.last_seen > Date.now() - 7 * 86400000).length}</strong><span>Active in the last 7 days</span></div></div>
        <div className="table-toolbar"><label htmlFor="student-filter">Find a Neptun code<Input id="student-filter" value={filter} onChange={e => setFilter(e.target.value)} placeholder="Search code…" maxLength={6} /></label><span>{updated ? `Updated ${new Date(updated).toLocaleTimeString()}` : ''}</span></div>
        <div className="results-table"><Table><TableHeader><TableRow><TableHead>Neptun</TableHead><TableHead>Practised</TableHead><TableHead>Reviews</TableHead><TableHead>Consistent recall</TableHead><TableHead>Due</TableHead><TableHead>Again</TableHead><TableHead>Last active</TableHead></TableRow></TableHeader><TableBody>{visible.map(s => <TableRow key={s.neptun}><TableCell><Button variant="link" className="student-code" onClick={() => setSelected(selected === s.neptun ? null : s.neptun)}>{s.neptun}</Button></TableCell><TableCell>{s.seen} / {cards.length}</TableCell><TableCell>{s.reviews}</TableCell><TableCell>{s.confident}</TableCell><TableCell>{s.due}</TableCell><TableCell>{s.again}</TableCell><TableCell>{new Date(s.last_seen).toLocaleString()}</TableCell></TableRow>)}</TableBody></Table>{!visible.length && <div className="table-empty"><BookOpen size={27} /><h2>{students.length ? 'No matching student.' : 'The first review starts here.'}</h2><p>{students.length ? 'Try another Neptun code.' : 'Students appear here after entering their Neptun code. Their reviews are recorded as they practise.'}</p></div>}</div>
        <p className="small-note">Consistent recall = at least three consecutive Good/Easy ratings and a review interval of at least seven days. Click a Neptun code for topic details.</p>
        {student && <section className="student-detail"><h2>{student.neptun} · topic breakdown</h2><Table><TableHeader><TableRow><TableHead>Topic</TableHead><TableHead>Practised</TableHead><TableHead>Reviews</TableHead><TableHead>Again</TableHead></TableRow></TableHeader><TableBody>{student.topics.map((t, i) => <TableRow key={i}><TableCell>{i + 1}. {topics[i]}</TableCell><TableCell>{t.seen} / {cards.filter(card => card.topic === i).length}</TableCell><TableCell>{t.reviews}</TableCell><TableCell>{t.again}</TableCell></TableRow>)}</TableBody></Table></section>}
      </>}
    </main></div>;
}
