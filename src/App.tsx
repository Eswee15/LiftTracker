import { useEffect, useState } from 'react';
import { HashRouter, NavLink, Route, Routes } from 'react-router-dom';
import { ensureSeed } from './data';
import { getSetting } from './db';
import Today from './pages/Today';
import ExerciseScreen from './pages/ExerciseScreen';
import { ProgramEditor, Programs } from './pages/Programs';
import Library from './pages/Library';
import Settings from './pages/Settings';

const icon = (d: string) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
);
const TABS = [
  { to: '/', label: 'Workout', d: 'M6.5 6.5v11M17.5 6.5v11M3 9v6M21 9v6M6.5 12h11' },
  { to: '/programs', label: 'Programs', d: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01' },
  { to: '/exercises', label: 'Exercises', d: 'M12 2l3 7h7l-5.5 4.5L18.5 21 12 16.5 5.5 21 7.5 13.5 2 9h7z' },
  { to: '/settings', label: 'Settings', d: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z' },
];

export default function App() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    (async () => {
      await ensureSeed();
      document.documentElement.dataset.theme = await getSetting('theme', 'dark');
      // Ask the browser not to evict our data (matters most on iOS).
      navigator.storage?.persist?.().catch(() => {});
      setReady(true);
    })();
  }, []);
  if (!ready) return null;
  return (
    <HashRouter>
      <div className="app">
        <Routes>
          <Route path="/" element={<Today />} />
          <Route path="/workout/:wid/:weid" element={<ExerciseScreen />} />
          <Route path="/programs" element={<Programs />} />
          <Route path="/programs/:id" element={<ProgramEditor />} />
          <Route path="/exercises" element={<Library />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
        <nav className="tabbar">
          {TABS.map((t) => (
            <NavLink key={t.to} to={t.to} end={t.to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
              {icon(t.d)}{t.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </HashRouter>
  );
}
