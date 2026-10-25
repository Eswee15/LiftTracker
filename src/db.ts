import Dexie, { type Table } from 'dexie';

export type Equipment = 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'bodyweight' | 'other';

export interface Exercise {
  id?: number;
  name: string;
  muscles: string[];
  secondary: string[];
  equipment: Equipment;
  increment: number;
  venueSpecific: boolean;
  custom: boolean;
}
export interface Venue { id?: number; name: string; lastUsed: number }
export interface PlanItem { exerciseId: number; sets: number; reps: string; superset?: string }
export interface PlanDay { id: string; name: string; items: PlanItem[] }
export interface Program { id?: number; name: string; days: PlanDay[]; active: 0 | 1; startDate: string }
export interface Workout {
  id?: number;
  date: string;
  venueId: number;
  programId?: number;
  dayId?: string;
  deload: boolean;
  note: string;
  createdAt: number;
}
export interface WorkoutExercise {
  id?: number;
  workoutId: number;
  exerciseId: number;
  order: number;
  superset?: string;
  done: boolean;
  doneAt?: number;
  swappedFrom?: number;
  adHoc?: boolean;
  targetSets?: number;
  targetReps?: string;
}
export interface SetLog {
  id?: number;
  workoutId: number;
  exerciseId: number;
  weight: number;
  reps: number;
  at: number;
  restSec?: number;
}
export interface Setting { key: string; value: unknown }

class LiftDB extends Dexie {
  exercises!: Table<Exercise, number>;
  venues!: Table<Venue, number>;
  programs!: Table<Program, number>;
  workouts!: Table<Workout, number>;
  workoutExercises!: Table<WorkoutExercise, number>;
  sets!: Table<SetLog, number>;
  settings!: Table<Setting, string>;

  constructor() {
    super('lifttracker');
    this.version(1).stores({
      exercises: '++id, name',
      venues: '++id, name',
      programs: '++id, active',
      workouts: '++id, date, venueId',
      workoutExercises: '++id, workoutId, exerciseId',
      sets: '++id, workoutId, exerciseId, at',
      settings: 'key',
    });
  }
}

export const db = new LiftDB();

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.settings.get(key);
  return row ? (row.value as T) : fallback;
}
export const setSetting = (key: string, value: unknown) => db.settings.put({ key, value });
