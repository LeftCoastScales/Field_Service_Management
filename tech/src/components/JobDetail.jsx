import React, { useEffect, useState } from 'react';
import * as api from '../api/client.js';
import { getCachedJob } from '../db/offlineStore.js';
import TimeTracker from './TimeTracker.jsx';
import NotesEditor from './NotesEditor.jsx';
import PhotoUpload from './PhotoUpload.jsx';

export default function JobDetail({ appointmentName, employee, capacity, onBack }) {
  const [job, setJob] = useState(null);

  useEffect(() => {
    (async () => {
      // Try live detail first (parts list, full customer record), fall
      // back to the cached summary from Today's Jobs if offline.
      try {
        if (navigator.onLine) {
          const res = await api.getJobDetail(appointmentName);
          setJob(res.message);
          return;
        }
        throw new Error('offline');
      } catch {
        setJob(await getCachedJob(appointmentName));
      }
    })();
  }, [appointmentName]);

  if (!job) return <p style={{ color: 'var(--lcs-text-muted)' }}>Loading job…</p>;

  const mapsUrl = job.site_address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.site_address)}`
    : null;

  return (
    <div>
      <button className="btn btn-outline" style={{ minHeight: 36, padding: '0 12px', fontSize: 13, marginBottom: 12 }} onClick={onBack}>
        ← Today's Jobs
      </button>

      <div className="card">
        <div className="job-status" style={{ marginBottom: 8, display: 'inline-block' }}>{job.status}</div>
        <div className="job-customer" style={{ fontSize: 19 }}>{job.customer_name}</div>
        <div className="job-address">{job.site_address}</div>
        {mapsUrl && (
          <a href={mapsUrl} target="_blank" rel="noreferrer" className="btn btn-outline btn-full" style={{ marginTop: 10 }}>
            Open in Maps
          </a>
        )}
        {job.equipment_summary && (
          <p style={{ fontSize: 13.5, marginTop: 10, marginBottom: 0 }}>{job.equipment_summary}</p>
        )}
      </div>

      <div className="section-label">Time Tracking</div>
      <TimeTracker employee={employee} jobRef={appointmentName} capacity={capacity} />

      <div className="section-label">Job Notes</div>
      <NotesEditor
        appointmentName={appointmentName}
        initialCustomerNotes={job.customer_notes}
        initialInternalNotes={job.internal_notes}
      />

      <div className="section-label">Photos</div>
      <PhotoUpload appointmentName={appointmentName} />

      {Array.isArray(job.parts) && job.parts.length > 0 && (
        <>
          <div className="section-label">Parts on Order</div>
          <div className="card">
            {job.parts.map((p, i) => (
              <div key={i} style={{ fontSize: 13.5, padding: '4px 0', borderBottom: i < job.parts.length - 1 ? '1px solid var(--lcs-border)' : 'none' }}>
                {p.item_name} × {p.qty}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
