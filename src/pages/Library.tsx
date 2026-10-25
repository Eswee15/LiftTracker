import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Exercise } from '../db';
import { MUSCLES } from '../seed';
import { ExerciseForm } from '../components/ui';
import { fmtWeight } from '../lib';

export default function Library() {
  const exercises = useLiveQuery(() => db.exercises.orderBy('name').toArray(), []);
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState('');
  const [editing, setEditing] = useState<Partial<Exercise> | null>(null);
  const list = (exercises ?? []).filter((e) => e.name.toLowerCase().includes(q.toLowerCase()) && (!muscle || e.muscles.includes(muscle) || e.secondary.includes(muscle)));

  return (
    <div className="page">
      <div className="top">
        <h1>Exercises</h1>
        <button className="btn primary small" onClick={() => setEditing({})}>+ New</button>
      </div>
      <input type="text" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="chips" style={{ margin: '10px 0', flexWrap: 'nowrap', overflowX: 'auto' }}>
        <button className={'chip' + (!muscle ? ' on' : '')} onClick={() => setMuscle('')}>All</button>
        {MUSCLES.map((m) => <button key={m} className={'chip' + (muscle === m ? ' on' : '')} onClick={() => setMuscle(m)}>{m}</button>)}
      </div>
      <div className="sub" style={{ marginBottom: 6 }}>{list.length} exercises</div>
      <div className="card" style={{ padding: '2px 14px' }}>
        {list.map((e) => (
          <button key={e.id} className="list-item" onClick={() => setEditing(e)}>
            <div className="grow">
              <div>{e.name}{e.custom && <span className="chip accent" style={{ marginLeft: 8 }}>custom</span>}</div>
              <div className="sub">{e.muscles.join(', ') || 'No muscle set'} · {e.equipment} · step {fmtWeight(e.increment)} kg{e.venueSpecific ? ' · per venue' : ''}</div>
            </div>
          </button>
        ))}
      </div>
      {editing && (
        <ExerciseForm
          key={editing.id ?? 'new'} initial={editing} onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
