import React, { useEffect, useState, useCallback } from 'react';
import * as api from '../api/client.js';
import { cacheJobs, getCachedJobs } from '../db/offlineStore.js';

function formatTime(iso) {
  if (!iso) return '--:--';
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function statusClass(status) {
  if (status === 'Completed') return 'completed';
  if (status === 'In Progress') return 'in-progress';
  return '';
}

export default function JobList({ onSelectJob }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (navigator.onLine) {
        const res = await api.getMyJobs();
        const jobList = res.message || [];
        setJobs(jobList);
        await cacheJobs(jobList);
      } else {
        setJobs(await getCachedJobs());
      }
      setError(null);
    } catch (err) {
      // Fall back to whatever we have cached if the live call fails.
      setJobs(await getCachedJobs());
      setError('Showing your last synced jobs — could not reach the server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const sorted = [...jobs].sort((a, b) => (a.scheduled_start || '').localeCompare(b.scheduled_start || ''));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: 18, margin: '4px 0 12px' }}>Today's Jobs</h2>
        <button className="btn btn-outline" style={{ minHeight: 36, padding: '0 12px', fontSize: 13 }} onClick={load}>
          Refresh
        </button>
      </div>

      {error && (
        <div className="card" style={{ borderColor: 'var(--lcs-gold)', fontSize: 13 }}>{error}</div>
      )}

      {loading && jobs.length === 0 && <p style={{ color: 'var(--lcs-text-muted)' }}>Loading your jobs…</p>}

      {!loading && sorted.length === 0 && (
        <div className="empty-state">
          <p style={{ fontSize: 15, fontWeight: 700 }}>No jobs assigned for today</p>
          <p style={{ fontSize: 13 }}>Pull to refresh, or check with dispatch if this looks wrong.</p>
        </div>
      )}

      {sorted.map((job) => (
        <button key={job.name} className="card job-card" onClick={() => onSelectJob(job.name)}>
          <div className="job-card-top">
            <span className="job-time">{formatTime(job.scheduled_start)}</span>
            <span className={`job-status ${statusClass(job.status)}`}>{job.status}</span>
          </div>
          <div className="job-customer">{job.customer_name}</div>
          <div className="job-address">{job.site_address}</div>
          {job.is_crew_leader ? (
            <div style={{ marginTop: 6, fontSize: 11, fontWeight: 700, color: 'var(--lcs-crimson)' }}>CREW LEADER</div>
          ) : null}
        </button>
      ))}
    </div>
  );
}
