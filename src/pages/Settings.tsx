import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getSetting, setSetting } from '../db';
import { exportBackup, importBackup, importFitNotes } from '../data';
import { Sheet } from '../components/ui';

/** Pick (or add) the venue you are training at. */
export function VenueSheet({ currentId, onPick, onClose }: { currentId?: number; onPick: (id: number) => void; onClose: () => void }) {
  const venues = useLiveQuery(async () => (await db.venues.toArray()).sort((a, b) => b.lastUsed - a.lastUsed), []);
  const [name, setName] = useState('');
  return (
    <Sheet title="Where are you training?" onClose={onClose}>
      {venues?.map((v) => (
        <button key={v.id} className="list-item" onClick={() => onPick(v.id!)}>
          <span className="grow">{v.name}</span>
          {v.id === currentId && <span className="chip accent">current</span>}
        </button>
      ))}
      <div className="row" style={{ marginTop: 14 }}>
        <input type="text" placeholder="New venue name" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn primary" disabled={!name.trim()} onClick={async () => onPick((await db.venues.add({ name: name.trim(), lastUsed: Date.now() })) as number)}>Add</button>
      </div>
    </Sheet>
  );
}

export default function Settings() {
  const venues = useLiveQuery(() => db.venues.toArray(), []);
  const counts = useLiveQuery(async () => ({ w: await db.workouts.count(), s: await db.sets.count() }), []);
  const lastBackup = useLiveQuery(() => getSetting<number>('lastBackup', 0), []);
  const [msg, setMsg] = useState('');
  const [fnVenue, setFnVenue] = useState<number | ''>('');
  const restoreRef = useRef<HTMLInputElement>(null);
  const fnRef = useRef<HTMLInputElement>(null);
  const theme = useLiveQuery(() => getSetting<string>('theme', 'dark'), []);

  async function backup() {
    const blob = await exportBackup();
    const file = new File([blob], `lifttracker-${new Date().toISOString().slice(0, 10)}.json`, { type: 'application/json' });
    try {
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: 'LiftTracker backup' });
      else {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = file.name; a.click();
        URL.revokeObjectURL(a.href);
      }
      await setSetting('lastBackup', Date.now());
      setMsg('Backup saved.');
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setMsg(`Backup failed: ${(e as Error).message}`);
    }
  }
  async function restore(f?: File) {
    if (!f) return;
    if (!confirm('Restoring replaces ALL data on this device with the backup. Continue?')) return;
    try { await importBackup(await f.text()); setMsg('Backup restored.'); } catch (e) { setMsg((e as Error).message); }
  }
  async function fitnotes(f?: File) {
    if (!f) return;
    const vid = fnVenue || venues?.[0]?.id;
    if (!vid) return;
    try {
      const r = await importFitNotes(await f.text(), vid);
      setMsg(`Imported ${r.workouts} workouts, ${r.sets} sets (${r.newExercises} new exercises, ${r.skipped} rows skipped).`);
    } catch (e) { setMsg((e as Error).message); }
  }
  function setTheme(t: string) {
    setSetting('theme', t);
    document.documentElement.dataset.theme = t;
  }

  return (
    <div className="page">
      <div className="top"><h1>Settings</h1></div>
      {msg && <div className="card" style={{ marginBottom: 12, color: 'var(--accent)' }}>{msg}</div>}

      <label className="f" style={{ marginTop: 0 }}>Venues</label>
      <div className="card">
        {venues?.map((v) => (
          <div key={v.id} className="set">
            <span className="grow">{v.name}</span>
            <button className="btn small" onClick={async () => { const n = prompt('Rename venue', v.name); if (n?.trim()) await db.venues.update(v.id!, { name: n.trim() }); }}>Rename</button>
            <button className="btn small danger" onClick={async () => {
              if ((await db.workouts.where('venueId').equals(v.id!).count()) > 0) return alert('This venue has workouts logged against it, so it can’t be deleted. Rename it instead.');
              if ((venues?.length ?? 0) < 2) return alert('You need at least one venue.');
              await db.venues.delete(v.id!);
            }}>Delete</button>
          </div>
        ))}
        <button className="btn ghost" onClick={async () => { const n = prompt('New venue name'); if (n?.trim()) await db.venues.add({ name: n.trim(), lastUsed: 0 }); }}>+ Add venue</button>
      </div>

      <label className="f">Backup</label>
      <div className="card stack">
        <div className="sub">
          {counts?.w ?? 0} workouts · {counts?.s ?? 0} sets · {lastBackup ? `last backup ${new Date(lastBackup).toLocaleDateString()}` : 'never backed up'}
        </div>
        <p className="sub">Your data lives on this phone only. Save a backup file regularly (to Files, Drive, iCloud, email it to yourself) to be safe.</p>
        <button className="btn primary block" onClick={backup}>Save backup</button>
        <button className="btn block" onClick={() => restoreRef.current?.click()}>Restore from backup</button>
        <input ref={restoreRef} type="file" accept=".json,application/json" hidden onChange={(e) => { restore(e.target.files?.[0]); e.target.value = ''; }} />
      </div>

      <label className="f">Import from FitNotes</label>
      <div className="card stack">
        <p className="sub">In FitNotes: Settings → Spreadsheet Export → export the CSV, then pick it here. All imported workouts are assigned to the venue below.</p>
        <select value={fnVenue} onChange={(e) => setFnVenue(Number(e.target.value))}>
          {venues?.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
        <button className="btn block" onClick={() => fnRef.current?.click()}>Choose FitNotes CSV</button>
        <input ref={fnRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => { fitnotes(e.target.files?.[0]); e.target.value = ''; }} />
      </div>

      <label className="f">Appearance</label>
      <div className="seg">
        <button className={theme !== 'light' ? 'on' : ''} onClick={() => setTheme('dark')}>Dark</button>
        <button className={theme === 'light' ? 'on' : ''} onClick={() => setTheme('light')}>Light</button>
      </div>
      <p className="sub" style={{ marginTop: 24, textAlign: 'center' }}>Weights are in kg.</p>
    </div>
  );
}
