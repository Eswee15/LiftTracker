import Papa from 'papaparse';
import { db, getSetting, setSetting, type Equipment, type Exercise, type SetLog, type Workout, type WorkoutExercise } from './db';
import { seedExercises } from './seed';
import { e1rm, uid } from './lib';

export function ensureSeed() {
  return db.transaction('rw', db.exercises, db.venues, db.settings, async () => {
    if ((await db.exercises.count()) === 0) await db.exercises.bulkAdd(seedExercises());
    if ((await db.venues.count()) === 0) {
      const id = await db.venues.add({ name: 'My Gym', lastUsed: Date.now() });
      await setSetting('lastVenueId', id);
    }
  });
}

export async function lastVenueId(): Promise<number> {
  const id = await getSetting<number | null>('lastVenueId', null);
  if (id && (await db.venues.get(id))) return id;
  const first = await db.venues.toCollection().first();
  return first!.id!;
}

export async function setWorkoutVenue(workoutId: number, venueId: number) {
  await db.workouts.update(workoutId, { venueId });
  await db.venues.update(venueId, { lastUsed: Date.now() });
  await setSetting('lastVenueId', venueId);
}

/** Create a workout for a date, optionally pre-loaded from a program day. */
export async function startWorkout(date: string, programId?: number, dayId?: string): Promise<number> {
  const venueId = await lastVenueId();
  const wid = await db.workouts.add({ date, venueId, programId, dayId, deload: false, note: '', createdAt: Date.now() });
  if (programId && dayId) {
    const day = (await db.programs.get(programId))?.days.find((d) => d.id === dayId);
    if (day) {
      await db.workoutExercises.bulkAdd(
        day.items.map((it, i) => ({
          workoutId: wid, exerciseId: it.exerciseId, order: i, superset: it.superset,
          done: false, targetSets: it.sets, targetReps: it.reps,
        })),
      );
    }
  }
  return wid as number;
}

/** Which day of the active program is next, based on the last workout done with it. */
export async function nextPlanDay(programId: number): Promise<string | undefined> {
  const prog = await db.programs.get(programId);
  if (!prog || !prog.days.length) return undefined;
  const last = (await db.workouts.orderBy('date').reverse().toArray()).find((w) => w.programId === programId && w.dayId);
  if (!last) return prog.days[0].id;
  const idx = prog.days.findIndex((d) => d.id === last.dayId);
  return prog.days[(idx + 1) % prog.days.length].id;
}

export async function addExerciseToWorkout(workoutId: number, exerciseId: number) {
  const rows = await db.workoutExercises.where('workoutId').equals(workoutId).toArray();
  const w = await db.workouts.get(workoutId);
  await db.workoutExercises.add({
    workoutId, exerciseId, order: rows.length, done: false,
    adHoc: !!w?.dayId, // only "out of plan" when the workout follows a plan day
  });
}

/** Replace a planned exercise with another; the history remembers it was swapped in. */
export async function swapExercise(we: WorkoutExercise, newExerciseId: number) {
  const n = await db.sets.where({ workoutId: we.workoutId, exerciseId: we.exerciseId }).count();
  if (n > 0) throw new Error('Delete the sets already logged for this exercise before swapping it.');
  await db.workoutExercises.update(we.id!, {
    exerciseId: newExerciseId,
    swappedFrom: we.swappedFrom ?? we.exerciseId,
    adHoc: false, done: false, doneAt: undefined,
  });
}

export async function removeWorkoutExercise(we: WorkoutExercise) {
  await db.transaction('rw', db.workoutExercises, db.sets, async () => {
    await db.sets.where({ workoutId: we.workoutId, exerciseId: we.exerciseId }).delete();
    await db.workoutExercises.delete(we.id!);
  });
}

/** Link an exercise with the one after it into a superset (or unlink it). */
export async function toggleSuperset(we: WorkoutExercise, ordered: WorkoutExercise[]) {
  const i = ordered.findIndex((r) => r.id === we.id);
  const next = ordered[i + 1];
  if (!next) return;
  if (we.superset && we.superset === next.superset) {
    // unlink `next` and everything after it in this group
    const group = we.superset;
    const tail = ordered.slice(i + 1).filter((r) => r.superset === group);
    const keep = ordered.filter((r) => r.superset === group).length - tail.length;
    await db.workoutExercises.bulkUpdate(tail.map((r) => ({ key: r.id!, changes: { superset: undefined } })));
    if (keep < 2) await db.workoutExercises.update(we.id!, { superset: undefined });
  } else {
    const g = we.superset ?? next.superset ?? uid();
    await db.workoutExercises.update(we.id!, { superset: g });
    await db.workoutExercises.update(next.id!, { superset: g });
  }
}

export async function logSet(workoutId: number, exerciseId: number, weight: number, reps: number) {
  const prev = await db.sets.where({ workoutId, exerciseId }).last();
  const at = Date.now();
  const gap = prev ? (at - prev.at) / 1000 : undefined;
  const restSec = gap !== undefined && gap < 1800 ? Math.round(gap) : undefined;
  return db.sets.add({ workoutId, exerciseId, weight, reps, at, restSec });
}

export interface Session {
  workout: Workout;
  venueName: string;
  sets: SetLog[];
  we?: WorkoutExercise;
  swappedFromName?: string;
}

export function sessionStats(sets: SetLog[]) {
  return {
    top: Math.max(0, ...sets.map((s) => s.weight)),
    best1rm: Math.max(0, ...sets.map((s) => e1rm(s.weight, s.reps))),
    volume: sets.reduce((a, s) => a + s.weight * s.reps, 0),
  };
}

export function isScoped(ex: Exercise | undefined, venueScope: 'venue' | 'all' | undefined): 'venue' | 'all' {
  return venueScope ?? (ex?.venueSpecific ? 'venue' : 'all');
}

/** All past sessions of an exercise, newest first, optionally restricted to a venue. */
export async function historyFor(exerciseId: number, scope: 'venue' | 'all', venueId: number, excludeWorkoutId?: number): Promise<Session[]> {
  const sets = await db.sets.where('exerciseId').equals(exerciseId).toArray();
  const byWorkout = new Map<number, SetLog[]>();
  for (const s of sets) {
    if (s.workoutId === excludeWorkoutId) continue;
    (byWorkout.get(s.workoutId) ?? byWorkout.set(s.workoutId, []).get(s.workoutId)!).push(s);
  }
  const venues = new Map((await db.venues.toArray()).map((v) => [v.id!, v.name]));
  const out: Session[] = [];
  for (const [wid, list] of byWorkout) {
    const workout = await db.workouts.get(wid);
    if (!workout || (scope === 'venue' && workout.venueId !== venueId)) continue;
    const we = await db.workoutExercises.where({ workoutId: wid, exerciseId }).first();
    const swappedFromName = we?.swappedFrom ? (await db.exercises.get(we.swappedFrom))?.name : undefined;
    out.push({ workout, venueName: venues.get(workout.venueId) ?? '?', sets: list.sort((a, b) => a.at - b.at), we, swappedFromName });
  }
  return out.sort((a, b) => b.workout.date.localeCompare(a.workout.date) || b.workout.createdAt - a.workout.createdAt);
}

// ---------- Backup ----------

export async function exportBackup(): Promise<Blob> {
  const data: Record<string, unknown[]> = {};
  for (const t of db.tables) data[t.name] = await t.toArray();
  return new Blob([JSON.stringify({ app: 'lifttracker', version: 1, exportedAt: new Date().toISOString(), data })], { type: 'application/json' });
}

export async function importBackup(text: string) {
  const parsed = JSON.parse(text);
  if (parsed.app !== 'lifttracker' || !parsed.data) throw new Error('Not a LiftTracker backup file.');
  await db.transaction('rw', db.tables, async () => {
    for (const t of db.tables) {
      await t.clear();
      if (parsed.data[t.name]?.length) await t.bulkAdd(parsed.data[t.name]);
    }
  });
}

// ---------- FitNotes import ----------

const CATEGORY_MUSCLE: Record<string, string> = {
  shoulders: 'Front Delts', triceps: 'Triceps', biceps: 'Biceps', chest: 'Chest',
  back: 'Lats', legs: 'Quads', abs: 'Abs', cardio: 'Cardio',
};

function guessEquipment(name: string): Equipment {
  const n = name.toLowerCase();
  if (/barbell|bench press|deadlift|squat|ez/.test(n) && !/dumbbell|machine|smith/.test(n)) return 'barbell';
  if (/dumbbell/.test(n)) return 'dumbbell';
  if (/cable|pushdown|pulldown/.test(n)) return 'cable';
  if (/machine|smith|press$|leg curl|extension/.test(n)) return 'machine';
  if (/pull-up|chin-up|push-up|dip|plank|crunch/.test(n)) return 'bodyweight';
  return 'other';
}

export interface ImportResult { workouts: number; sets: number; newExercises: number; skipped: number }

export async function importFitNotes(csv: string, venueId: number): Promise<ImportResult> {
  const { data, meta } = Papa.parse<Record<string, string>>(csv.trim(), { header: true, skipEmptyLines: true });
  const fields = meta.fields ?? [];
  const wKey = fields.find((f) => /^weight/i.test(f));
  if (!fields.includes('Date') || !fields.includes('Exercise') || !wKey || !fields.includes('Reps'))
    throw new Error('This does not look like a FitNotes CSV export (needs Date, Exercise, Weight, Reps columns).');
  const factor = /lb/i.test(wKey) ? 0.45359237 : 1;

  const existing = new Map((await db.exercises.toArray()).map((e) => [e.name.toLowerCase(), e]));
  const exIds = new Map<string, number>();
  let newExercises = 0, skipped = 0, setCount = 0;

  const byDate = new Map<string, Record<string, string>[]>();
  for (const row of data) {
    const reps = Number(row.Reps);
    if (!row.Date || !row.Exercise || !reps) { skipped++; continue; }
    (byDate.get(row.Date) ?? byDate.set(row.Date, []).get(row.Date)!).push(row);
  }

  await db.transaction('rw', db.exercises, db.workouts, db.workoutExercises, db.sets, async () => {
    for (const [date, rows] of [...byDate].sort(([a], [b]) => a.localeCompare(b))) {
      const wid = (await db.workouts.add({ date, venueId, deload: false, note: 'Imported from FitNotes', createdAt: new Date(date).getTime() })) as number;
      const order: number[] = [];
      let t = new Date(date + 'T12:00:00').getTime();
      for (const row of rows) {
        const key = row.Exercise.trim().toLowerCase();
        let id = exIds.get(key) ?? existing.get(key)?.id;
        if (!id) {
          const muscle = CATEGORY_MUSCLE[(row.Category ?? '').trim().toLowerCase()];
          const equipment = guessEquipment(row.Exercise);
          id = (await db.exercises.add({
            name: row.Exercise.trim(), muscles: muscle ? [muscle] : [], secondary: [], equipment,
            increment: 2.5, venueSpecific: equipment === 'machine' || equipment === 'cable', custom: true,
          })) as number;
          newExercises++;
        }
        exIds.set(key, id);
        if (!order.includes(id)) order.push(id);
        const w = Math.round(Number(row[wKey] || 0) * factor * 100) / 100;
        await db.sets.add({ workoutId: wid, exerciseId: id, weight: w, reps: Number(row.Reps), at: (t += 60000) });
        setCount++;
      }
      await db.workoutExercises.bulkAdd(order.map((exerciseId, i) => ({ workoutId: wid, exerciseId, order: i, done: true })));
    }
  });
  return { workouts: byDate.size, sets: setCount, newExercises, skipped };
}
