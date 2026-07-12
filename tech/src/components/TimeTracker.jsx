import React, { useEffect, useState, useCallback } from 'react';
import {
  ACTIONS,
  DAY_STATES,
  SEGMENT_TYPES,
  applyAction,
  createDayLog,
  currentContext,
  summarizeDay,
} from '../state/timeTrackingMachine.js';
import { loadDayLog, saveDayLog, enqueueMutation } from '../db/offlineStore.js';
import ClockCorrectionModal from './ClockCorrectionModal.jsx';
import PauseJobModal from './PauseJobModal.jsx';

const todayISO = () => new Date().toISOString().slice(0, 10);

const BANNER_LABEL = {
  [SEGMENT_TYPES.TRAVEL]: 'Traveling',
  [SEGMENT_TYPES.PREP]: 'Truck inspection',
  [SEGMENT_TYPES.ONSITE]: 'On site',
  [SEGMENT_TYPES.SHOP]: 'At shop',
};

/**
 * TimeTracker is context-aware: if `jobRef` is set (rendered inside a Job
 * Detail screen), Arrive/Leave actions tie to that appointment. If not
 * (rendered on the Today's Jobs / global screen), Arrive/Leave apply to
 * the shop, and Start of Day / End of Day controls are shown instead.
 */
export default function TimeTracker({ employee, jobRef = null, capacity = 'light', onChanged }) {
  const [dayLog, setDayLog] = useState(null);
  const [pauseModalOpen, setPauseModalOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const existing = await loadDayLog(todayISO());
      setDayLog(existing || createDayLog(employee, todayISO()));
    })();
  }, [employee]);

  const persist = useCallback(async (log) => {
    setDayLog(log);
    await saveDayLog(log);
    onChanged?.(log);
  }, [onChanged]);

  const dispatch = useCallback(async (type, extra = {}) => {
    if (!dayLog) return;
    const { dayLog: next, result } = applyAction(dayLog, { type, at: new Date().toISOString(), jobRef, ...extra });
    await persist(next);
    if (result.ok) {
      const payload = { action_type: type, at: new Date().toISOString(), job_ref: jobRef, employee };

      if (type === ACTIONS.CORRECT_ARRIVAL) {
        // Previously this action was never synced at all — a flagged
        // segment could only be resolved by someone editing the record
        // directly in Desk. Distinct field names from the payload
        // above, since these describe a manually-entered correction,
        // not a normal action's own timestamp/job.
        payload.corrected_arrival_at = extra.correctedArrivalAt;
        payload.correction_reason = extra.correctionReason;
        payload.correction_job_ref = extra.correctionJobRef || null;
      } else {
        Object.assign(payload, extra);
      }

      // RESUME_JOB/LUNCH_IN close out a break — compute its exact duration
      // here (the device has precise start/end) so the server doesn't
      // have to reconstruct timing from two separate PAUSE/RESUME calls.
      if (type === ACTIONS.RESUME_JOB || type === ACTIONS.LUNCH_IN) {
        const openSeg = next.segments[next.segments.length - 1];
        const list = type === ACTIONS.RESUME_JOB ? (openSeg.pauses || []) : openSeg.lunchBreaks;
        const last = list[list.length - 1];
        if (last?.end) {
          payload.duration_minutes = Math.round((new Date(last.end) - new Date(last.start)) / 60000);
        }
      }

      await enqueueMutation({ type: 'TIME_ACTION', payload });
    }
    return result;
  }, [dayLog, jobRef, persist, employee]);

  if (!dayLog) return null;

  const ctx = currentContext(dayLog);
  const summary = summarizeDay(dayLog);

  const bannerClass = ctx.pendingCorrection
    ? 'not-started'
    : ctx.dayState === DAY_STATES.ENDED
      ? 'ended'
      : ctx.onJobPause
        ? 'paused'
        : ctx.onLunch
          ? 'lunch'
          : (ctx.openSegmentType || 'not-started').toLowerCase();

  const bannerLabel = ctx.pendingCorrection
    ? 'Correction needed'
    : ctx.dayState === DAY_STATES.NOT_STARTED
      ? 'Not clocked in'
      : ctx.dayState === DAY_STATES.ENDED
        ? 'Day ended'
        : ctx.onJobPause
          ? `Paused — ${ctx.currentPauseReason}`
          : ctx.onLunch
            ? 'On lunch'
            : BANNER_LABEL[ctx.openSegmentType] || '—';

  const handleCorrection = async (correctedArrivalAt) => {
    const corr = dayLog.pendingCorrection;
    await dispatch(ACTIONS.CORRECT_ARRIVAL, {
      correctedArrivalAt,
      correctionReason: corr?.reason,
      correctionJobRef: corr?.requestedJobRef || null,
    });
  };

  const atThisJob = jobRef && ctx.activeJobRef === jobRef;
  const openElsewhere = ctx.openSegmentType === SEGMENT_TYPES.ONSITE && ctx.activeJobRef && ctx.activeJobRef !== jobRef;

  return (
    <div>
      <div className={`tracker-banner ${bannerClass}`}>
        <div className="state-label">Time status</div>
        <div className="state-value">{bannerLabel}</div>
        {ctx.dayState !== DAY_STATES.NOT_STARTED && (
          <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>
            {Math.round(summary.paid / 60 * 10) / 10}h paid so far
            {summary.flagged > 0 ? ` · ${summary.flagged} flagged for review` : ''}
          </div>
        )}
      </div>

      {jobRef ? (
        // --- Job Detail context: Arrive / Leave tied to this appointment ---
        <div className="action-row">
          {!atThisJob && (
            <button
              className="btn btn-primary btn-full"
              disabled={ctx.dayState === DAY_STATES.NOT_STARTED || ctx.dayState === DAY_STATES.ENDED}
              onClick={() => dispatch(ACTIONS.ARRIVE)}
            >
              Clock In (Arrive at Job)
            </button>
          )}
          {atThisJob && !ctx.onJobPause && (
            <button className="btn btn-danger btn-full" onClick={() => dispatch(ACTIONS.LEAVE)}>
              Clock Out (Complete Job)
            </button>
          )}
          {atThisJob && !ctx.onLunch && !ctx.onJobPause && (
            <button className="btn btn-outline btn-full" onClick={() => dispatch(ACTIONS.LUNCH_OUT)}>
              Clock Out for Lunch
            </button>
          )}
          {atThisJob && ctx.onLunch && (
            <button className="btn btn-gold btn-full" onClick={() => dispatch(ACTIONS.LUNCH_IN)}>
              Clock In from Lunch
            </button>
          )}
          {atThisJob && !ctx.onLunch && !ctx.onJobPause && (
            <button className="btn btn-outline btn-full" onClick={() => setPauseModalOpen(true)}>
              Pause Job
            </button>
          )}
          {atThisJob && ctx.onJobPause && (
            <button className="btn btn-gold btn-full" onClick={() => dispatch(ACTIONS.RESUME_JOB)}>
              Resume Job
            </button>
          )}
          {openElsewhere && (
            <p style={{ fontSize: 12.5, color: 'var(--lcs-crimson)' }}>
              You're still clocked in elsewhere. Clock out there before arriving here.
            </p>
          )}
        </div>
      ) : (
        // --- Global context: Start/End of day, Shop clock in/out ---
        <div className="action-row">
          {ctx.dayState === DAY_STATES.NOT_STARTED && capacity === 'light' && (
            <button className="btn btn-primary btn-full" onClick={() => dispatch(ACTIONS.CLOCK_IN_LIGHT)}>
              Clock In — Start of Day
            </button>
          )}
          {ctx.dayState === DAY_STATES.NOT_STARTED && capacity === 'heavy' && (
            <button className="btn btn-primary btn-full" onClick={() => dispatch(ACTIONS.START_INSPECTION)}>
              Start Truck Inspection
            </button>
          )}
          {ctx.openSegmentType === SEGMENT_TYPES.PREP && (
            <button className="btn btn-gold btn-full" onClick={() => dispatch(ACTIONS.SUBMIT_INSPECTION)}>
              Submit Truck Inspection
            </button>
          )}
          {capacity === 'heavy' && ctx.dayState === DAY_STATES.ACTIVE && ctx.openSegmentType !== SEGMENT_TYPES.PREP && (
            <button className="btn btn-outline btn-full" onClick={() => dispatch(ACTIONS.START_INSPECTION)}>
              Log Truck Inspection
            </button>
          )}
          {ctx.openSegmentType === SEGMENT_TYPES.TRAVEL && !ctx.onLunch && (
            <button className="btn btn-primary btn-full" onClick={() => dispatch(ACTIONS.ARRIVE)}>
              Clock In at Shop
            </button>
          )}
          {ctx.openSegmentType === SEGMENT_TYPES.SHOP && !ctx.onLunch && (
            <button className="btn btn-danger btn-full" onClick={() => dispatch(ACTIONS.LEAVE)}>
              Clock Out of Shop
            </button>
          )}
          {(ctx.openSegmentType === SEGMENT_TYPES.TRAVEL || ctx.openSegmentType === SEGMENT_TYPES.SHOP) && !ctx.onLunch && (
            <button className="btn btn-outline btn-full" onClick={() => dispatch(ACTIONS.LUNCH_OUT)}>
              Clock Out for Lunch
            </button>
          )}
          {ctx.onLunch && (
            <button className="btn btn-gold btn-full" onClick={() => dispatch(ACTIONS.LUNCH_IN)}>
              Clock In from Lunch
            </button>
          )}
          {(ctx.openSegmentType === SEGMENT_TYPES.TRAVEL || ctx.openSegmentType === SEGMENT_TYPES.SHOP) &&
            !ctx.onLunch && ctx.dayState === DAY_STATES.ACTIVE && (
            <button className="btn btn-outline btn-full" onClick={() => dispatch(ACTIONS.END_DAY)}>
              End of Day
            </button>
          )}
        </div>
      )}

      <ClockCorrectionModal
        pendingCorrection={ctx.pendingCorrection}
        onSubmit={handleCorrection}
        onCancel={async () => {
          // Dismiss without resolving — the technician can reopen it by
          // repeating the same Arrive/Leave tap. Nothing is written yet,
          // so it's safe to just clear the local flag.
          const next = structuredClone(dayLog);
          next.pendingCorrection = null;
          await persist(next);
        }}
      />

      <PauseJobModal
        open={pauseModalOpen}
        onConfirm={async (reason) => {
          setPauseModalOpen(false);
          await dispatch(ACTIONS.PAUSE_JOB, { reason });
        }}
        onCancel={() => setPauseModalOpen(false)}
      />
    </div>
  );
}
