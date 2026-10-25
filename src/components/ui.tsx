import { useEffect, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Equipment, type Exercise } from '../db';
import { MUSCLES } from '../seed';

export const Check = ({ on }: { on: boolean }) => (
  <span className={'check' + (on ? ' on' : '')}>
    {on && (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5 9-10" /></svg>
    )}
  </span>
);

export function Sheet({ title, onClose, children }: { title?: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        {title && <h2>{title}</h2>}
        {children}
      </div>
    </div>
  );
}

/** Numeric input with big +/- buttons. */
export function Stepper({ value, onChange, step, label, min = 0 }: { value: number; onChange: (v: number) => void; step: number; label: string; min?: number }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const bump = (d: number) => onChange(Math.max(min, Math.round((value + d) * 100) / 100));
  return (
    <div className="stepper">
      <button onClick={() => bump(-step)} aria-label={`decrease ${label}`}>−</button>
      <div className="mid">
        <input
          type="number" inputMode="decimal" value={text}
          onChange={(e) => { setText(e.target.value); const n = parseFloat(e.target.value); if (!isNaN(n)) onChange(Math.max(min, n)); }}
          onFocus={(e) => e.target.select()}
        />
        <small>{label}</small>
      </div>
      <button onClick={() => bump(step)} aria-label={`increase ${label}`}>+</button>
    </div>
  );
}

export function useTick(ms = 1000) {
  const [, set] = useState(0);
  useEffect(() => { const t = setInterval(() => set((n) => n + 1), ms); return () => clearInterval(t); }, [ms]);
}

/** Pick an exercise from the library (with search + muscle filter), or create a new one. */
export function ExercisePicker({ onPick, onClose }: { onPick: (id: number) => void; onClose: () => void }) {
  const exercises = useLiveQuery(() => db.exercises.orderBy('name').toArray(), []);
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState('');
  const [creating, setCreating] = useState(false);
  const list = (exercises ?? []).filter(
    (e) => e.name.toLowerCase().includes(q.toLowerCase()) && (!muscle || e.muscles.includes(muscle) || e.secondary.includes(muscle)),
  );
  if (creating) return <ExerciseForm initial={{ name: q }} onClose={() => setCreating(false)} onSaved={(id) => onPick(id)} />;
  return (
    <Sheet onClose={onClose}>
      <input type="text" placeholder="Search exercises" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      <div className="chips" style={{ margin: '10px 0', flexWrap: 'nowrap', overflowX: 'auto' }}>
        <button className={'chip' + (!muscle ? ' on' : '')} onClick={() => setMuscle('')}>All</button>
        {MUSCLES.map((m) => (
          <button key={m} className={'chip' + (muscle === m ? ' on' : '')} onClick={() => setMuscle(m)}>{m}</button>
        ))}
      </div>
      <button className="btn primary block" style={{ marginBottom: 6, padding: 12, fontSize: 15 }} onClick={() => setCreating(true)}>+ New exercise{q ? ` “${q}”` : ''}</button>
      {list.map((e) => (
        <button key={e.id} className="list-item" onClick={() => onPick(e.id!)}>
          <div className="grow">
            <div>{e.name}</div>
            <div className="sub">{e.muscles.join(', ') || 'No muscle set'} · {e.equipment}</div>
          </div>
        </button>
      ))}
      {!list.length && <div className="empty">No match. Create it above.</div>}
    </Sheet>
  );
}

const EQUIPMENT: Equipment[] = ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'other'];

/** Create or edit an exercise: name, muscles, equipment, stack increment, venue behaviour. */
export function ExerciseForm({ initial, onClose, onSaved }: { initial?: Partial<Exercise>; onClose: () => void; onSaved?: (id: number) => void }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [muscles, setMuscles] = useState<string[]>(initial?.muscles ?? []);
  const [secondary, setSecondary] = useState<string[]>(initial?.secondary ?? []);
  const [equipment, setEquipment] = useState<Equipment>(initial?.equipment ?? 'dumbbell');
  const [increment, setIncrement] = useState(initial?.increment ?? 2.5);
  const [venueSpecific, setVenueSpecific] = useState(initial?.venueSpecific ?? false);
  const [touchedVenue, setTouchedVenue] = useState(initial?.id !== undefined);
  const toggle = (list: string[], set: (v: string[]) => void, m: string) => set(list.includes(m) ? list.filter((x) => x !== m) : [...list, m]);

  async function save() {
    const row = { name: name.trim(), muscles, secondary: secondary.filter((m) => !muscles.includes(m)), equipment, increment: increment || 2.5, venueSpecific, custom: initial?.custom ?? true };
    const id = initial?.id ? (await db.exercises.update(initial.id, row), initial.id) : ((await db.exercises.add(row)) as number);
    onSaved?.(id);
    onClose();
  }

  return (
    <Sheet title={initial?.id ? 'Edit exercise' : 'New exercise'} onClose={onClose}>
      <label className="f" style={{ marginTop: 0 }}>Name</label>
      <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
      <label className="f">Equipment</label>
      <div className="chips">
        {EQUIPMENT.map((eq) => (
          <button key={eq} className={'chip' + (equipment === eq ? ' on' : '')} onClick={() => { setEquipment(eq); if (!touchedVenue) setVenueSpecific(eq === 'machine' || eq === 'cable'); }}>{eq}</button>
        ))}
      </div>
      <label className="f">Primary muscles</label>
      <div className="chips">
        {MUSCLES.map((m) => <button key={m} className={'chip' + (muscles.includes(m) ? ' on' : '')} onClick={() => toggle(muscles, setMuscles, m)}>{m}</button>)}
      </div>
      <label className="f">Secondary muscles</label>
      <div className="chips">
        {MUSCLES.filter((m) => !muscles.includes(m)).map((m) => <button key={m} className={'chip' + (secondary.includes(m) ? ' on' : '')} onClick={() => toggle(secondary, setSecondary, m)}>{m}</button>)}
      </div>
      <label className="f">Weight step (kg per +/− tap)</label>
      <div className="chips" style={{ marginBottom: 8 }}>
        {[1, 1.25, 2, 2.5, 5, 10].map((n) => <button key={n} className={'chip' + (increment === n ? ' on' : '')} onClick={() => setIncrement(n)}>{n}</button>)}
      </div>
      <input type="number" inputMode="decimal" step="any" value={increment} onChange={(e) => setIncrement(parseFloat(e.target.value) || 0)} />
      <div className="toggle" style={{ marginTop: 14 }}>
        <div>
          <div>Track separately per venue</div>
          <div className="sub">On for machines and cables, which differ between gyms</div>
        </div>
        <input type="checkbox" checked={venueSpecific} onChange={(e) => { setVenueSpecific(e.target.checked); setTouchedVenue(true); }} />
      </div>
      <button className="btn primary block" style={{ marginTop: 18 }} disabled={!name.trim()} onClick={save}>Save</button>
      {initial?.id && (
        <button className="btn ghost danger block" style={{ marginTop: 6, fontSize: 14 }} onClick={async () => {
          if ((await db.sets.where('exerciseId').equals(initial.id!).count()) > 0) return alert('This exercise has logged sets, so it can’t be deleted.');
          if (!confirm(`Delete “${initial.name}”?`)) return;
          await db.exercises.delete(initial.id!);
          onClose();
        }}>Delete exercise</button>
      )}
    </Sheet>
  );
}
