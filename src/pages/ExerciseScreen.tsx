import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { db, type SetLog } from '../db';
import { historyFor, logSet, sessionStats, setWorkoutVenue, type Session } from '../data';
import { e1rm, fmtDate, fmtDur, fmtWeight, parseDate, repsError, weightError } from '../lib';
import { Check, ExerciseForm, Stepper, useTick } from '../components/ui';
import { VenueSheet } from './Settings';

const VENUE_COLORS = ['#5eead4', '#f59e0b', '#a78bfa', '#f472b6', '#60a5fa', '#a3e635', '#fb7185'];

export default function ExerciseScreen() {
  const { wid, weid } = useParams();
  const workoutId = Number(wid);
  const we = useLiveQuery(() => db.workoutExercises.get(Number(weid)), [weid]);
  const workout = useLiveQuery(() => db.workouts.get(workoutId), [workoutId]);
  const ex = useLiveQuery(() => (we ? db.exercises.get(we.exerciseId) : undefined), [we?.exerciseId]);
  const venues = useLiveQuery(() => db.venues.toArray(), []);
  const [tab, setTab] = useState<'track' | 'history' | 'progress'>('track');
  const [scope, setScope] = useState<'venue' | 'all' | null>(null);
  const [edit, setEdit] = useState(false);
  const [venuePicker, setVenuePicker] = useState(false);
  useTick();

  const effScope = scope ?? (ex?.venueSpecific ? 'venue' : 'all');
  const venueId = workout?.venueId ?? 0;
  const exerciseId = we?.exerciseId ?? 0;

  // Re-run when sets change anywhere for this exercise or the venue changes.
  const setCount = useLiveQuery(() => db.sets.where('exerciseId').equals(exerciseId).count(), [exerciseId]);
  const history = useLiveQuery(
    () => (exerciseId ? historyFor(exerciseId, effScope, venueId) : undefined),
    [exerciseId, effScope, venueId, setCount],
  );
  const todaySets = useLiveQuery(async () => (exerciseId ? await db.sets.where({ workoutId, exerciseId }).sortBy('at') : undefined), [workoutId, exerciseId]);

  const past = useMemo(() => (history ?? []).filter((s) => s.workout.id !== workoutId), [history, workoutId]);
  const lastSession = past[0];
  const priorTop = Math.max(0, ...past.flatMap((s) => s.sets.map((x) => x.weight)));
  const pb = useMemo(() => {
    let best: SetLog | undefined;
    for (const s of history ?? []) for (const x of s.sets) if (!best || x.weight > best.weight || (x.weight === best.weight && x.reps > best.reps)) best = x;
    return best;
  }, [history]);
  const best1rm = Math.max(0, ...(history ?? []).flatMap((s) => s.sets.map((x) => e1rm(x.weight, x.reps))));

  const [weight, setWeight] = useState(0);
  const [reps, setReps] = useState(8);
  const [selected, setSelected] = useState<number | null>(null);
  const seeded = useRef<number | null>(null);
  useEffect(() => {
    if (!we || todaySets === undefined || history === undefined || seeded.current === we.id) return;
    seeded.current = we.id!;
    const src = todaySets[todaySets.length - 1] ?? lastSession?.sets[0];
    if (src) { setWeight(src.weight); setReps(src.reps); }
  }, [we, todaySets, history, lastSession]);

  if (!we || !ex || !workout) return <div className="page" />;
  const venue = venues?.find((v) => v.id === venueId);
  const step = ex.increment || 2.5;

  let running = priorTop;
  const prFlags = new Set<number>();
  for (const s of todaySets ?? []) { if (priorTop > 0 && s.weight > running) prFlags.add(s.id!); running = Math.max(running, s.weight); }

  const lastSet = todaySets?.[todaySets.length - 1];
  const sinceSet = lastSet ? (Date.now() - lastSet.at) / 1000 : 0;

  const wErr = weightError(weight), rErr = repsError(reps);
  async function submit() {
    if (wErr || rErr) return;
    if (selected) {
      await db.sets.update(selected, { weight, reps });
      setSelected(null);
    } else {
      await logSet(workoutId, exerciseId, weight, reps);
    }
  }
  async function toggleDone() {
    await db.workoutExercises.update(we!.id!, { done: !we!.done, doneAt: we!.done ? undefined : Date.now() });
  }

  return (
    <div className="page">
      <div className="top">
        <Link to="/" className="back">‹ Back</Link>
        <span className="grow" />
        <button className="icon-btn" onClick={() => setEdit(true)} aria-label="edit exercise">⚙︎</button>
      </div>
      <div className="row" style={{ marginBottom: 6 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em' }} className="grow">{ex.name}</h1>
        <button onClick={toggleDone} className="row" style={{ gap: 6, color: we.done ? 'var(--accent)' : 'var(--muted)' }} aria-label="toggle done">
          <span style={{ fontSize: 13 }}>{we.done ? 'Done' : 'Mark done'}</span><Check on={we.done} />
        </button>
      </div>
      <div className="chips" style={{ marginBottom: 12 }}>
        <button className="chip accent" onClick={() => setVenuePicker(true)}>📍 {venue?.name} ▾</button>
        {ex.muscles.map((m) => <span key={m} className="chip">{m}</span>)}
        {we.swappedFrom && <span className="chip warn">Out of plan</span>}
      </div>

      <div className="row" style={{ gap: 8, marginBottom: 12 }}>
        <div className="stat"><b>{pb ? `${fmtWeight(pb.weight)} × ${pb.reps}` : '—'}</b><span>Personal best</span></div>
        <div className="stat"><b>{best1rm ? fmtWeight(Math.round(best1rm * 10) / 10) : '—'}</b><span>Est. 1RM</span></div>
      </div>

      <div className="seg" style={{ marginBottom: 12 }}>
        {(['track', 'history', 'progress'] as const).map((t) => (
          <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t[0].toUpperCase() + t.slice(1)}</button>
        ))}
      </div>
      <div className="seg" style={{ marginBottom: 14, padding: 2 }}>
        <button className={effScope === 'venue' ? 'on' : ''} onClick={() => setScope('venue')} style={{ fontSize: 12 }}>This venue</button>
        <button className={effScope === 'all' ? 'on' : ''} onClick={() => setScope('all')} style={{ fontSize: 12 }}>All venues</button>
      </div>

      {tab === 'track' && (
        <div className="stack">
          {lastSession && (
            <div className="card">
              <div className="row">
                <span className="sub grow">Last time · {fmtDate(lastSession.workout.date)}{effScope === 'all' ? ` · ${lastSession.venueName}` : ''}</span>
              </div>
              <div style={{ marginTop: 4, fontWeight: 600 }}>{lastSession.sets.map((s) => `${fmtWeight(s.weight)}×${s.reps}`).join('   ')}</div>
            </div>
          )}
          {lastSet && sinceSet < 3600 && (
            <div className="restbar"><span className="sub">Rest</span><span className="timer" style={{ fontSize: 26 }}>{fmtDur(sinceSet)}</span></div>
          )}
          <Stepper label="kg" value={weight} onChange={setWeight} step={step} error={wErr} />
          <Stepper label="reps" value={reps} onChange={setReps} step={1} min={1} error={rErr} />
          <div className="row">
            <button className="btn primary block grow" onClick={submit} disabled={!!(wErr || rErr)}>{selected ? 'Update set' : 'Log set'}</button>
            {selected && (
              <>
                <button className="btn" onClick={() => setSelected(null)}>Cancel</button>
                <button className="btn danger" onClick={async () => { await db.sets.delete(selected); setSelected(null); }}>Delete</button>
              </>
            )}
          </div>
          <div className="sub" style={{ textAlign: 'center' }}>Step {fmtWeight(step)} kg · change it with ⚙︎</div>
          {!!todaySets?.length && (
            <div className="card">
              {todaySets.map((s, i) => (
                <div key={s.id} className={'set' + (prFlags.has(s.id!) ? ' pr' : '') + (selected === s.id ? ' sel' : '')} onClick={() => { setSelected(s.id!); setWeight(s.weight); setReps(s.reps); }}>
                  <span className="n">{i + 1}</span>
                  <span className="w">{fmtWeight(s.weight)} kg</span>
                  <span className="grow">× {s.reps}</span>
                  {s.restSec !== undefined && <span className="sub">rest {fmtDur(s.restSec)}</span>}
                </div>
              ))}
            </div>
          )}
          {!we.done && !!todaySets?.length && <button className="btn block" onClick={toggleDone}>✓ Mark exercise done</button>}
        </div>
      )}

      {tab === 'history' && <HistoryList sessions={history ?? []} showVenue={effScope === 'all'} />}
      {tab === 'progress' && <Progress sessions={history ?? []} venueIds={(venues ?? []).map((v) => v.id!)} venueNames={new Map((venues ?? []).map((v) => [v.id!, v.name]))} />}

      {edit && <ExerciseForm initial={ex} onClose={() => setEdit(false)} />}
      {venuePicker && <VenueSheet currentId={venueId} onPick={async (id) => { await setWorkoutVenue(workoutId, id); setVenuePicker(false); }} onClose={() => setVenuePicker(false)} />}
    </div>
  );
}

function HistoryList({ sessions, showVenue }: { sessions: Session[]; showVenue: boolean }) {
  if (!sessions.length) return <div className="empty">No history yet.</div>;
  const topEver = Math.max(...sessions.flatMap((s) => s.sets.map((x) => x.weight)));
  return (
    <div className="stack">
      {sessions.map((s) => {
        const rests = s.sets.map((x) => x.restSec).filter((r): r is number => r !== undefined);
        const hasPB = s.sets.some((x) => x.weight === topEver);
        return (
          <div className="card" key={s.workout.id}>
            <div className="row" style={{ marginBottom: 6 }}>
              <b className="grow">{fmtDate(s.workout.date, true)}</b>
              {hasPB && <span className="chip warn">PB</span>}
            </div>
            <div className="chips" style={{ marginBottom: 6 }}>
              {showVenue && <span className="chip accent">📍 {s.venueName}</span>}
              {s.workout.deload && <span className="chip">Deload</span>}
              {s.we?.swappedFrom && <span className="chip warn">Out of plan · swapped in for {s.swappedFromName ?? 'another exercise'}</span>}
              {s.we?.adHoc && <span className="chip warn">Out of plan · added to the day</span>}
            </div>
            {s.sets.map((x, i) => (
              <div className="set" key={x.id}>
                <span className="n">{i + 1}</span>
                <span className="w">{fmtWeight(x.weight)} kg</span>
                <span className="grow">× {x.reps}</span>
                {x.restSec !== undefined && <span className="sub">rest {fmtDur(x.restSec)}</span>}
              </div>
            ))}
            <div className="sub" style={{ marginTop: 6 }}>
              Volume {Math.round(sessionStats(s.sets).volume).toLocaleString()} kg
              {rests.length > 0 && ` · avg rest ${fmtDur(rests.reduce((a, b) => a + b, 0) / rests.length)}`}
            </div>
          </div>
        );
      })}
    </div>
  );
}

type Metric = 'best1rm' | 'top' | 'volume';
const METRICS: { id: Metric; label: string; unit: string }[] = [
  { id: 'best1rm', label: 'Est. 1RM', unit: 'kg' },
  { id: 'top', label: 'Top weight', unit: 'kg' },
  { id: 'volume', label: 'Volume', unit: 'kg' },
];
const RANGES = [{ l: '3M', d: 91 }, { l: '6M', d: 182 }, { l: '1Y', d: 365 }, { l: 'All', d: 0 }];

function Progress({ sessions, venueIds, venueNames }: { sessions: Session[]; venueIds: number[]; venueNames: Map<number, string> }) {
  const [metric, setMetric] = useState<Metric>('best1rm');
  const [range, setRange] = useState(0);
  const cutoff = range ? Date.now() - range * 86400000 : 0;
  const rows = sessions
    .filter((s) => parseDate(s.workout.date).getTime() >= cutoff)
    .map((s) => ({
      t: parseDate(s.workout.date).getTime(),
      v: Math.round(sessionStats(s.sets)[metric] * 10) / 10,
      venueId: s.workout.venueId,
      deload: s.workout.deload,
    }))
    .sort((a, b) => a.t - b.t);
  const color = (id: number) => VENUE_COLORS[Math.max(0, venueIds.indexOf(id)) % VENUE_COLORS.length];
  const used = [...new Set(rows.map((d) => d.venueId))];
  // One series per venue so different gyms are never joined into a single line.
  const data = rows.map((r) => ({ t: r.t, deload: r.deload, venueId: r.venueId, [`v${r.venueId}`]: r.v }));
  const first = rows[0]?.v, lastV = rows[rows.length - 1]?.v;

  if (!sessions.length) return <div className="empty">Log a few sessions to see your progress.</div>;
  return (
    <div className="stack">
      <div className="seg">
        {METRICS.map((m) => <button key={m.id} className={metric === m.id ? 'on' : ''} onClick={() => setMetric(m.id)}>{m.label}</button>)}
      </div>
      <div className="card" style={{ padding: '14px 6px 8px 0' }}>
        <div style={{ height: 240 }}>
          <ResponsiveContainer>
            <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--line)" vertical={false} />
              <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={(t: number) => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} stroke="var(--muted)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis domain={['auto', 'auto']} stroke="var(--muted)" fontSize={11} width={42} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ background: 'var(--surface2)', border: 0, borderRadius: 10, color: 'var(--text)' }}
                labelFormatter={(t) => new Date(Number(t)).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                formatter={(v, name) => [`${v} kg`, venueNames.get(Number(String(name).slice(1))) ?? '']}
              />
              {used.map((id) => (
                <Line
                  key={id} type="monotone" dataKey={`v${id}`} stroke={color(id)} strokeWidth={2} connectNulls isAnimationActive={false}
                  dot={(p: { cx?: number; cy?: number; payload?: Record<string, number | boolean>; index?: number }) =>
                    p.payload?.[`v${id}`] === undefined ? <g key={p.index} /> : (
                      <circle key={p.index} cx={p.cx} cy={p.cy} r={5} fill={p.payload.deload ? 'var(--bg)' : color(id)} stroke={color(id)} strokeWidth={2} />
                    )}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="seg">
        {RANGES.map((r) => <button key={r.l} className={range === r.d ? 'on' : ''} onClick={() => setRange(r.d)}>{r.l}</button>)}
      </div>
      <div className="chips">
        {used.map((id) => (
          <span key={id} className="chip"><span style={{ width: 9, height: 9, borderRadius: 9, background: color(id) }} />{venueNames.get(id)}</span>
        ))}
        <span className="chip"><span style={{ width: 9, height: 9, borderRadius: 9, border: '2px solid var(--muted)' }} />deload</span>
      </div>
      {first !== undefined && lastV !== undefined && used.length === 1 && rows.length > 1 && (
        <div className="sub">
          {METRICS.find((m) => m.id === metric)!.label}: {fmtWeight(first)} → {fmtWeight(lastV)} kg ({lastV >= first ? '+' : ''}{fmtWeight(Math.round((lastV - first) * 10) / 10)})
        </div>
      )}
    </div>
  );
}
