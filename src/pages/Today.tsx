import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getSetting, type WorkoutExercise } from '../db';
import { addExerciseToWorkout, nextPlanDay, removeWorkoutExercise, setWorkoutVenue, startWorkout, swapExercise, toggleSuperset } from '../data';
import { addDays, fmtDate, fmtDur, isoDate } from '../lib';
import { Check, ExercisePicker, Sheet, useTick } from '../components/ui';
import { VenueSheet } from './Settings';
import { alertDialog, confirmDialog } from '../components/dialogs';

export default function Today() {
  const nav = useNavigate();
  const [date, setDate] = useState(isoDate());
  const [showVenues, setShowVenues] = useState(false);
  const [picker, setPicker] = useState<null | { mode: 'add' } | { mode: 'swap'; we: WorkoutExercise }>(null);
  const [menu, setMenu] = useState<WorkoutExercise | null>(null);

  const workout = useLiveQuery(async () => (await db.workouts.where('date').equals(date).first()) ?? null, [date]);
  const venues = useLiveQuery(() => db.venues.toArray(), []);
  const exercises = useLiveQuery(async () => new Map((await db.exercises.toArray()).map((e) => [e.id!, e])), []);
  const rows = useLiveQuery(
    async () => (workout ? (await db.workoutExercises.where('workoutId').equals(workout.id!).toArray()).sort((a, b) => a.order - b.order) : []),
    [workout?.id],
  );
  const sets = useLiveQuery(async () => (workout ? db.sets.where('workoutId').equals(workout.id!).sortBy('at') : []), [workout?.id]);
  const program = useLiveQuery(async () => (await db.programs.where('active').equals(1).first()) ?? null, []);
  const next = useLiveQuery(async () => (program ? nextPlanDay(program.id!) : undefined), [program?.id, workout?.id]);
  const stale = useLiveQuery(async () => {
    if (!(await db.workouts.count())) return false;
    const last = await getSetting<number>('lastBackup', 0);
    return Date.now() - last > 30 * 86400000;
  }, []);
  useTick();

  const venue = venues?.find((v) => v.id === workout?.venueId);
  const planDay = program && workout?.programId === program.id ? program.days.find((d) => d.id === workout?.dayId) : undefined;
  const last = sets?.length ? sets[sets.length - 1].at : 0;
  const sinceLast = last ? (Date.now() - last) / 1000 : 0;

  const header = (
    <div className="datenav">
      <button className="icon-btn" onClick={() => setDate(addDays(date, -1))} aria-label="previous day">‹</button>
      <div>
        <div className="d">{fmtDate(date)}</div>
        {date !== isoDate() && <button className="sub" onClick={() => setDate(isoDate())} style={{ color: 'var(--accent)' }}>Back to today</button>}
      </div>
      <button className="icon-btn" onClick={() => setDate(addDays(date, 1))} aria-label="next day">›</button>
    </div>
  );

  if (workout === undefined) return <div className="page">{header}</div>;

  if (!workout) {
    return (
      <div className="page">
        {header}
        {stale && <div className="card sub" style={{ marginBottom: 12 }}>You haven’t backed up in a while. Settings → Backup.</div>}
        <div className="stack">
          {program && next && (
            <div className="card">
              <div className="sub">{program.name}</div>
              <h3 style={{ fontSize: 22, margin: '4px 0 12px' }}>Up next: {program.days.find((d) => d.id === next)?.name}</h3>
              <button className="btn primary block" onClick={() => startWorkout(date, program.id, next)}>Start workout</button>
            </div>
          )}
          {program && program.days.filter((d) => d.id !== next).length > 0 && (
            <div className="card">
              <div className="sub" style={{ marginBottom: 6 }}>Or pick another day</div>
              <div className="chips">
                {program.days.filter((d) => d.id !== next).map((d) => (
                  <button key={d.id} className="chip" onClick={() => startWorkout(date, program.id, d.id)}>{d.name}</button>
                ))}
              </div>
            </div>
          )}
          <button className="btn block" onClick={() => startWorkout(date)}>Start empty workout</button>
          {!program && <p className="empty">No active program. Create one under Programs to get your split pre-loaded each day.</p>}
        </div>
      </div>
    );
  }

  const ordered = rows ?? [];
  const groups: WorkoutExercise[][] = [];
  for (const r of ordered) {
    const g = groups[groups.length - 1];
    if (g && r.superset && g[0].superset === r.superset) g.push(r); else groups.push([r]);
  }

  async function toggleDone(we: WorkoutExercise) {
    await db.workoutExercises.update(we.id!, { done: !we.done, doneAt: we.done ? undefined : Date.now() });
  }
  async function move(we: WorkoutExercise, dir: -1 | 1) {
    const i = ordered.findIndex((r) => r.id === we.id);
    const other = ordered[i + dir];
    if (!other) return;
    await db.workoutExercises.update(we.id!, { order: other.order });
    await db.workoutExercises.update(other.id!, { order: we.order });
  }

  function card(we: WorkoutExercise) {
    const ex = exercises?.get(we.exerciseId);
    const my = (sets ?? []).filter((s) => s.exerciseId === we.exerciseId);
    const swappedFrom = we.swappedFrom ? exercises?.get(we.swappedFrom)?.name : undefined;
    return (
      <div key={we.id} className={'card tap' + (we.done ? ' done' : '')} onClick={() => nav(`/workout/${workout!.id}/${we.id}`)}>
        <div className="row">
          <button onClick={(e) => { e.stopPropagation(); toggleDone(we); }} aria-label="mark done"><Check on={we.done} /></button>
          <div className="grow">
            <h3>{ex?.name ?? '…'}</h3>
            <div className="sub">
              {my.length ? my.map((s) => `${s.weight}×${s.reps}`).join('  ') : we.targetSets ? `Plan: ${we.targetSets} × ${we.targetReps}` : ex?.muscles.join(', ')}
            </div>
            {(swappedFrom || we.adHoc) && <span className="chip warn" style={{ marginTop: 6 }}>{swappedFrom ? `Swapped for ${swappedFrom}` : 'Added, not in plan'}</span>}
          </div>
          <button className="icon-btn" onClick={(e) => { e.stopPropagation(); setMenu(we); }} aria-label="more">⋯</button>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      {header}
      <div className="row" style={{ marginBottom: 12 }}>
        <button className="chip accent" onClick={() => setShowVenues(true)}>📍 {venue?.name ?? 'Venue'} ▾</button>
        {planDay && <span className="chip">{planDay.name}</span>}
        <label className="chip" style={workout.deload ? { color: 'var(--warn)' } : undefined}>
          <input type="checkbox" checked={workout.deload} onChange={(e) => db.workouts.update(workout.id!, { deload: e.target.checked })} style={{ accentColor: 'var(--warn)' }} /> Deload
        </label>
      </div>
      {last > 0 && sinceLast < 3600 && (
        <div className="restbar"><span className="sub">Since last set</span><span className="timer" style={{ fontSize: 22 }}>{fmtDur(sinceLast)}</span></div>
      )}
      <div className="stack">
        {groups.map((g, i) =>
          g.length > 1 ? <div key={i} className="ss stack">{g.map(card)}</div> : card(g[0]),
        )}
        <button className="btn block" onClick={() => setPicker({ mode: 'add' })}>+ Add exercise</button>
        <button className="btn ghost danger" onClick={async () => {
          if (!(await confirmDialog('Delete this whole workout and its sets?'))) return;
          await db.transaction('rw', db.workouts, db.workoutExercises, db.sets, async () => {
            await db.sets.where('workoutId').equals(workout.id!).delete();
            await db.workoutExercises.where('workoutId').equals(workout.id!).delete();
            await db.workouts.delete(workout.id!);
          });
        }}>Delete workout</button>
      </div>

      {showVenues && (
        <VenueSheet currentId={workout.venueId} onPick={async (id) => { await setWorkoutVenue(workout.id!, id); setShowVenues(false); }} onClose={() => setShowVenues(false)} />
      )}
      {picker && (
        <ExercisePicker
          onClose={() => setPicker(null)}
          onPick={async (id) => {
            try {
              if (picker.mode === 'add') await addExerciseToWorkout(workout.id!, id);
              else await swapExercise(picker.we, id);
              setPicker(null);
            } catch (e) { await alertDialog((e as Error).message); setPicker(null); }
          }}
        />
      )}
      {menu && (
        <Sheet title={exercises?.get(menu.exerciseId)?.name} onClose={() => setMenu(null)}>
          <button className="list-item" onClick={() => { setPicker({ mode: 'swap', we: menu }); setMenu(null); }}>⇄ Swap for another exercise</button>
          <button className="list-item" onClick={async () => { await toggleSuperset(menu, ordered); setMenu(null); }}>
            🔗 {(() => { const i = ordered.findIndex((r) => r.id === menu.id); const n = ordered[i + 1]; return n && menu.superset && menu.superset === n.superset ? 'Unlink from next exercise' : 'Superset with next exercise'; })()}
          </button>
          <button className="list-item" onClick={async () => { await move(menu, -1); setMenu(null); }}>↑ Move up</button>
          <button className="list-item" onClick={async () => { await move(menu, 1); setMenu(null); }}>↓ Move down</button>
          <button className="list-item danger" style={{ color: 'var(--danger)' }} onClick={async () => { await removeWorkoutExercise(menu); setMenu(null); }}>✕ Remove from workout</button>
        </Sheet>
      )}
    </div>
  );
}
