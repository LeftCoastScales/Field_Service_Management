import React, { useEffect, useState, useCallback } from 'react';
import JobList from './components/JobList.jsx';
import JobDetail from './components/JobDetail.jsx';
import TimeTracker from './components/TimeTracker.jsx';
import { syncNow } from './db/sync.js';
import { getQueuedMutations } from './db/offlineStore.js';
import * as api from './api/client.js';
import { useTheme } from './hooks/useTheme.js';

export default function App() {
  const [screen, setScreen] = useState('jobs'); // 'jobs' | 'jobDetail' | 'day'
  const [selectedJob, setSelectedJob] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [capacity, setCapacity] = useState('light'); // resolved from employee/vehicle assignment server-side
  const [online, setOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [theme, toggleTheme] = useTheme();

  const refreshPending = useCallback(async () => {
    const q = await getQueuedMutations();
    setPendingCount(q.length);
  }, []);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  useEffect(() => {
    refreshPending();
    const interval = setInterval(refreshPending, 5000);
    return () => clearInterval(interval);
  }, [refreshPending]);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.whoAmI();
        setEmployee(res.message);
      } catch {
        // Session cookie will still be present when back online; the
        // app works fully offline off the last known identity/cache.
      }
    })();
  }, []);

  const syncPillClass = !online ? 'offline' : pendingCount > 0 ? 'pending' : 'synced';
  const syncPillLabel = !online ? 'Offline' : pendingCount > 0 ? `${pendingCount} syncing…` : 'Synced';

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>LCS Field Tech</h1>
        <div className="header-actions">
          <button
            type="button"
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? '☀' : '☾'}
          </button>
          <span
            className={`sync-pill ${syncPillClass}`}
            onClick={() => online && syncNow().then(refreshPending)}
          >
            ● {syncPillLabel}
          </span>
        </div>
      </header>

      <main className="app-main">
        {screen === 'jobs' && (
          <JobList
            onSelectJob={(name) => {
              setSelectedJob(name);
              setScreen('jobDetail');
            }}
          />
        )}

        {screen === 'jobDetail' && selectedJob && (
          <JobDetail
            appointmentName={selectedJob}
            employee={employee}
            capacity={capacity}
            onBack={() => setScreen('jobs')}
          />
        )}

        {screen === 'day' && (
          <div>
            <h2 style={{ fontSize: 18, margin: '4px 0 12px' }}>My Day</h2>
            <TimeTracker employee={employee} capacity={capacity} />
          </div>
        )}
      </main>

      <nav className="bottom-tabbar">
        <button className={screen === 'jobs' || screen === 'jobDetail' ? 'active' : ''} onClick={() => setScreen('jobs')}>
          Jobs
        </button>
        <button className={screen === 'day' ? 'active' : ''} onClick={() => setScreen('day')}>
          My Day
        </button>
      </nav>
    </div>
  );
}
