# LiftTracker

A minimalist, offline-first lift tracker in the spirit of FitNotes, with a few things FitNotes lacks:

- **Venues.** Every workout belongs to a gym. It defaults to the last one you used. Machines and cables are tracked per venue by default (a pulley at one gym is not a pulley at another); barbells and dumbbells combine across venues. Either can be flipped per exercise with the *This venue / All venues* toggle.
- **Programs.** Save multiple splits (e.g. a 6-month push/pull/legs) with the exercises, sets and reps for each day. The active program tells you what's next.
- **Swap exercises on the day.** Swapped-in or added exercises are flagged "out of plan" in the history.
- **Supersets**, a per-set **rest timer**, tick-off-as-done, deload marking.
- **Per-exercise weight step** (1 kg for lateral raises, 5 kg for cable stacks, …).
- **~150 pre-loaded exercises** with muscle groups; add your own or edit any of them.
- **Progress chart** (est. 1RM / top weight / volume), one line per venue.
- **FitNotes CSV import** and **JSON backup/restore**.

It's a PWA, so one codebase installs on both Android and iPhone, with no app store and no developer fees.

## Install (once the site is deployed)

The app lives at `https://<your-github-username>.github.io/LiftTracker/`.

- **iPhone:** open the link in **Safari** → Share → **Add to Home Screen**.
- **Android:** open the link in **Chrome** → ⋮ → **Install app** / **Add to Home screen**.

It works offline after the first load. Data is stored on the device, so **use Settings → Save backup regularly** (iOS can clear web storage in rare cases).

## Deploying

1. Merge to `main`.
2. In the repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. The workflow in `.github/workflows/deploy.yml` builds and publishes on every push to `main`.

## Importing from FitNotes

FitNotes → Settings → Spreadsheet Export. Then in LiftTracker: Settings → Import from FitNotes → choose the CSV. Everything is assigned to the venue you pick.

## Development

```
npm install
npm run dev      # http://localhost:5173/LiftTracker/
npm run build
```

Stack: React, TypeScript, Vite, Dexie (IndexedDB), Recharts, vite-plugin-pwa.
