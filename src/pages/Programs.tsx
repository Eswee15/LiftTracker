import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type PlanDay, type Program } from '../db';
import { daysBetween, isoDate, uid } from '../lib';
import { ExercisePicker } from '../components/ui';
import { confirmDialog, promptDialog } from '../components/dialogs';

export function Programs() {
  const nav = useNavigate();
  const programs = useLiveQuery(() => db.programs.toArray(), []);
  const days = (p: Program) => `${p.days.length} day${p.days.length === 1 ? '' : 's'}`;

  async function create() {
    const name = await promptDialog('Program name', 'Push / Pull / Legs');
    if (!name?.trim()) return;
    const first = (await db.programs.count()) === 0;
    const id = await db.programs.add({ name: name.trim(), days: [], active: first ? 1 : 0, startDate: isoDate() });
    nav(`/programs/${id}`);
  }
  async function activate(id: number) {
    await db.transaction('rw', db.programs, async () => {
      await db.programs.toCollection().modify({ active: 0 });
      await db.programs.update(id, { active: 1 });
    });
  }

  return (
    <div className="page">
      <div className="top"><h1>Programs</h1><button className="btn primary small" onClick={create}>+ New</button></div>
      {!programs?.length && <div className="empty">Save your splits here, e.g. a 6-month push/pull/legs, with the exercises and sets for each day.</div>}
      <div className="stack">
        {programs?.map((p) => (
          <div key={p.id} className="card">
            <div className="row">
              <Link to={`/programs/${p.id}`} className="grow" style={{ color: 'inherit', textDecoration: 'none' }}>
                <h3>{p.name}</h3>
                <div className="sub">{days(p)} · started {p.startDate} · week {Math.floor(daysBetween(p.startDate, isoDate()) / 7) + 1}</div>
              </Link>
              {p.active ? <span className="chip accent">active</span> : <button className="btn small" onClick={() => activate(p.id!)}>Set active</button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProgramEditor() {
  const { id } = useParams();
  const nav = useNavigate();
  const loaded = useLiveQuery(() => db.programs.get(Number(id)), [id]);
  const exercises = useLiveQuery(async () => new Map((await db.exercises.toArray()).map((e) => [e.id!, e])), []);
  const [prog, setProg] = useState<Program | null>(null);
  const [pickFor, setPickFor] = useState<string | null>(null);
  const dirty = useRef(false);

  useEffect(() => { if (loaded && !prog) setProg(loaded); }, [loaded, prog]);
  useEffect(() => {
    if (!prog || !dirty.current) return;
    const t = setTimeout(() => db.programs.put(prog), 250);
    return () => clearTimeout(t);
  }, [prog]);

  if (!prog) return <div className="page" />;
  const edit = (fn: (p: Program) => Program) => { dirty.current = true; setProg((p) => fn(structuredClone(p!))); };
  const editDay = (dayId: string, fn: (d: PlanDay) => void) => edit((p) => { fn(p.days.find((d) => d.id === dayId)!); return p; });

  return (
    <div className="page">
      <div className="top"><Link to="/programs" className="back">‹ Programs</Link></div>
      <label className="f" style={{ marginTop: 0 }}>Name</label>
      <input type="text" value={prog.name} onChange={(e) => edit((p) => ({ ...p, name: e.target.value }))} />
      <label className="f">Start date (for the week counter)</label>
      <input type="date" value={prog.startDate} onChange={(e) => edit((p) => ({ ...p, startDate: e.target.value }))} />

      <div className="stack" style={{ marginTop: 18 }}>
        {prog.days.map((day, di) => (
          <div key={day.id} className="card">
            <div className="row" style={{ marginBottom: 8 }}>
              <input type="text" value={day.name} onChange={(e) => editDay(day.id, (d) => (d.name = e.target.value))} style={{ fontWeight: 700 }} />
              <button className="icon-btn" disabled={di === 0} onClick={() => edit((p) => { [p.days[di - 1], p.days[di]] = [p.days[di], p.days[di - 1]]; return p; })}>↑</button>
              <button className="icon-btn" disabled={di === prog.days.length - 1} onClick={() => edit((p) => { [p.days[di + 1], p.days[di]] = [p.days[di], p.days[di + 1]]; return p; })}>↓</button>
            </div>
            {day.items.map((it, i) => {
              const linkedNext = it.superset && day.items[i + 1]?.superset === it.superset;
              const linkedPrev = it.superset && day.items[i - 1]?.superset === it.superset;
              return (
                <div key={i} className={linkedNext || linkedPrev ? 'ss' : ''} style={{ padding: '8px 0 8px 0', borderBottom: '1px solid var(--line)' }}>
                  <div className="row">
                    <div className="grow">{exercises?.get(it.exerciseId)?.name ?? (exercises ? 'Deleted exercise (remove it)' : '…')}</div>
                    <input type="number" inputMode="numeric" value={it.sets} style={{ width: 56, padding: 8, textAlign: 'center' }} onChange={(e) => editDay(day.id, (d) => (d.items[i].sets = Number(e.target.value)))} />
                    <span className="sub">×</span>
                    <input type="text" value={it.reps} style={{ width: 70, padding: 8, textAlign: 'center' }} onChange={(e) => editDay(day.id, (d) => (d.items[i].reps = e.target.value))} />
                  </div>
                  <div className="row" style={{ marginTop: 4 }}>
                    <button className="icon-btn" disabled={i === 0} onClick={() => editDay(day.id, (d) => { [d.items[i - 1], d.items[i]] = [d.items[i], d.items[i - 1]]; })}>↑</button>
                    <button className="icon-btn" disabled={i === day.items.length - 1} onClick={() => editDay(day.id, (d) => { [d.items[i + 1], d.items[i]] = [d.items[i], d.items[i + 1]]; })}>↓</button>
                    {i < day.items.length - 1 && (
                      <button className="chip" onClick={() => editDay(day.id, (d) => {
                        const a = d.items[i], b = d.items[i + 1];
                        if (a.superset && a.superset === b.superset) { b.superset = undefined; if (!d.items.some((x, j) => j !== i && x.superset === a.superset)) a.superset = undefined; }
                        else { const g = a.superset ?? b.superset ?? uid(); a.superset = g; b.superset = g; }
                      })}>{linkedNext ? '🔗 Unlink next' : '🔗 Superset with next'}</button>
                    )}
                    <span className="grow" />
                    <button className="icon-btn" style={{ color: 'var(--danger)' }} onClick={() => editDay(day.id, (d) => d.items.splice(i, 1))}>✕</button>
                  </div>
                </div>
              );
            })}
            <div className="row" style={{ marginTop: 8 }}>
              <button className="btn small" onClick={() => setPickFor(day.id)}>+ Exercise</button>
              <button className="btn small" onClick={() => edit((p) => { const c = structuredClone(day); c.id = uid(); c.name += ' (copy)'; p.days.splice(di + 1, 0, c); return p; })}>Duplicate day</button>
              <span className="grow" />
              <button className="btn small danger" onClick={async () => (await confirmDialog(`Delete “${day.name}”?`)) && edit((p) => { p.days.splice(di, 1); return p; })}>Delete day</button>
            </div>
          </div>
        ))}
        <button className="btn block" onClick={() => edit((p) => { p.days.push({ id: uid(), name: `Day ${p.days.length + 1}`, items: [] }); return p; })}>+ Add day</button>
        <button className="btn ghost danger" onClick={async () => {
          if (!(await confirmDialog(`Delete program “${prog.name}”? Logged workouts are kept.`))) return;
          dirty.current = false; await db.programs.delete(prog.id!); nav('/programs');
        }}>Delete program</button>
      </div>

      {pickFor && (
        <ExercisePicker onClose={() => setPickFor(null)} onPick={(exerciseId) => {
          editDay(pickFor, (d) => d.items.push({ exerciseId, sets: 3, reps: '8-12' }));
          setPickFor(null);
        }} />
      )}
    </div>
  );
}
