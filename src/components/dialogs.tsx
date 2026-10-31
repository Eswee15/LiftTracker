import { useEffect, useState } from 'react';

type Req =
  | { kind: 'alert'; message: string; resolve: () => void }
  | { kind: 'confirm'; message: string; danger: boolean; resolve: (ok: boolean) => void }
  | { kind: 'prompt'; message: string; initial: string; resolve: (v: string | null) => void };

let queue: Req[] = [];
const listeners = new Set<() => void>();
const push = (r: Req) => { queue = [...queue, r]; listeners.forEach((l) => l()); };
const pop = () => { queue = queue.slice(1); listeners.forEach((l) => l()); };

/** In-app replacements for window.alert / confirm / prompt, which some webviews block. */
export const alertDialog = (message: string) => new Promise<void>((resolve) => push({ kind: 'alert', message, resolve }));
export const confirmDialog = (message: string, danger = true) => new Promise<boolean>((resolve) => push({ kind: 'confirm', message, danger, resolve }));
export const promptDialog = (message: string, initial = '') => new Promise<string | null>((resolve) => push({ kind: 'prompt', message, initial, resolve }));

export function DialogHost() {
  const [, set] = useState(0);
  useEffect(() => {
    const l = () => set((n) => n + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  const req = queue[0];
  if (!req) return null;
  return <DialogView key={queue.length + req.message} req={req} />;
}

function DialogView({ req }: { req: Req }) {
  const [text, setText] = useState(req.kind === 'prompt' ? req.initial : '');
  const close = (fn: () => void) => { pop(); fn(); };
  const cancel = () => close(() => {
    if (req.kind === 'confirm') req.resolve(false);
    else if (req.kind === 'prompt') req.resolve(null);
    else req.resolve();
  });
  const ok = () => close(() => {
    if (req.kind === 'confirm') req.resolve(true);
    else if (req.kind === 'prompt') req.resolve(text);
    else req.resolve();
  });
  return (
    <div className="sheet-bg dlg-bg" style={{ zIndex: 100 }} onClick={cancel}>
      <div className="dlg" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <p>{req.message}</p>
        {req.kind === 'prompt' && (
          <input type="text" value={text} autoFocus onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && ok()} style={{ marginBottom: 14 }} />
        )}
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          {req.kind !== 'alert' && <button className="btn" onClick={cancel}>Cancel</button>}
          <button className={'btn ' + (req.kind === 'confirm' && req.danger ? 'danger' : 'primary')} onClick={ok} autoFocus={req.kind !== 'prompt'}>
            {req.kind === 'confirm' ? 'Confirm' : 'OK'}
          </button>
        </div>
      </div>
    </div>
  );
}
