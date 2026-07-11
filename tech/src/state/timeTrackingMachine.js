/**
 * timeTrackingMachine.js
 *
 * Implements the LCS chained-logic time tracking system described in
 * "Field Service Time-Tracking Restructure" (Proposal v.chained-logic).
 *
 * This is the single source of truth for time-tracking state on the
 * technician's device. It runs fully offline — every action appends to
 * an in-memory/IndexedDB-persisted day log, which is synced to the
 * "LCS Tech Day Log" DocType on Frappe Cloud when connectivity returns.
 *
 * Segment types: TRAVEL | PREP | ONSITE | SHOP | (LUNCH is a pause
 * within the active segment, not its own segment — see lunchBreaks[]).
 *
 * Day states: NOT_STARTED | ACTIVE | ENDED
 */

// ---- Action types -----------------------------------------------------

export const ACTIONS = {
  CLOCK_IN_LIGHT: 'CLOCK_IN_LIGHT',           // Start of day, light capacity -> begins Travel
  START_INSPECTION: 'START_INSPECTION',       // Heavy capacity truck inspection start -> begins Prep
  SUBMIT_INSPECTION: 'SUBMIT_INSPECTION',     // Ends Prep -> begins Travel
  ARRIVE: 'ARRIVE',                           // Clock in at job or shop -> ends Travel, begins Onsite/Shop
  LEAVE: 'LEAVE',                             // Clock out of job or shop -> ends Onsite/Shop, begins Travel
  LUNCH_OUT: 'LUNCH_OUT',                     // Pause active segment
  LUNCH_IN: 'LUNCH_IN',                       // Resume active segment
  PAUSE_JOB: 'PAUSE_JOB',                     // Pause an open Onsite segment for a given reason (parts, customer, etc.)
  RESUME_JOB: 'RESUME_JOB',                   // Resume from a job pause
  END_DAY: 'END_DAY',                         // Terminate all tracking
  CORRECT_ARRIVAL: 'CORRECT_ARRIVAL',         // Manual entry supplied after a missing-clock-in flag
};

export const SEGMENT_TYPES = {
  TRAVEL: 'TRAVEL',
  PREP: 'PREP',
  ONSITE: 'ONSITE',
  SHOP: 'SHOP',
};

export const DAY_STATES = {
  NOT_STARTED: 'NOT_STARTED',
  ACTIVE: 'ACTIVE',
  ENDED: 'ENDED',
};

// ---- Helpers ------------------------------------------------------------

const uid = () => `seg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

function openSegment(dayLog) {
  if (!dayLog.segments.length) return null;
  const last = dayLog.segments[dayLog.segments.length - 1];
  return last.end ? null : last;
}

function isPaused(segment) {
  if (!segment) return false;
  const last = segment.lunchBreaks[segment.lunchBreaks.length - 1];
  return !!(last && !last.end);
}

/** Job-specific pause (parts, customer not home, etc.) — distinct from lunch. */
function isJobPaused(segment) {
  if (!segment) return false;
  const pauses = segment.pauses || [];
  const last = pauses[pauses.length - 1];
  return !!(last && !last.end);
}

/** True if the open segment is paused for any reason (lunch or job pause) — used to block Arrive/Leave/End Day/Submit Inspection until resumed. */
function onAnyBreak(segment) {
  return isPaused(segment) || isJobPaused(segment);
}

/** Creates a fresh, empty day log for a technician/date. */
export function createDayLog(employee, dateISO) {
  return {
    employee,
    date: dateISO,
    dayState: DAY_STATES.NOT_STARTED,
    segments: [],
    pendingCorrection: null, // { reason, requiredJobRef, at }
    needsReviewCount: 0,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Applies a technician action to a day log and returns a new day log
 * plus a result descriptor the UI uses to decide what to show next.
 *
 * @param {object} dayLog
 * @param {object} action - { type, at (ISO string), jobRef (appointment name|null), correctedArrivalAt (ISO, optional) }
 * @returns {{ dayLog: object, result: { ok: boolean, needsCorrection?: boolean, message?: string } }}
 */
export function applyAction(dayLog, action) {
  const at = action.at || new Date().toISOString();
  const log = structuredClone(dayLog);
  const open = openSegment(log);

  switch (action.type) {
    case ACTIONS.CLOCK_IN_LIGHT: {
      if (log.dayState !== DAY_STATES.NOT_STARTED) {
        return fail(log, 'Day already started.');
      }
      log.dayState = DAY_STATES.ACTIVE;
      log.segments.push(newSegment(SEGMENT_TYPES.TRAVEL, null, at));
      return ok(log);
    }

    case ACTIONS.START_INSPECTION: {
      if (log.dayState === DAY_STATES.ENDED) return fail(log, 'Day already ended.');
      if (open) return fail(log, 'Cannot start inspection while a segment is open.');
      log.dayState = DAY_STATES.ACTIVE; // no-op if already active
      log.segments.push(newSegment(SEGMENT_TYPES.PREP, null, at));
      return ok(log);
    }

    case ACTIONS.SUBMIT_INSPECTION: {
      if (!open || open.type !== SEGMENT_TYPES.PREP) {
        return fail(log, 'No open inspection/prep segment to submit.');
      }
      if (onAnyBreak(open)) return fail(log, 'Resume from lunch/pause before submitting inspection.');
      open.end = at;
      log.segments.push(newSegment(SEGMENT_TYPES.TRAVEL, null, at));
      return ok(log);
    }

    case ACTIONS.ARRIVE: {
      // Sequential Clock-In Lock: cannot arrive at a new job/shop while
      // a previous ONSITE/SHOP segment is still open.
      if (open && (open.type === SEGMENT_TYPES.ONSITE || open.type === SEGMENT_TYPES.SHOP)) {
        log.pendingCorrection = {
          reason: 'SEQUENTIAL_LOCK',
          message: 'You are still clocked in at a previous job/shop. Enter your actual clock-out time before arriving here.',
          openSegmentId: open.id,
          requestedAt: at,
          requestedJobRef: action.jobRef ?? null,
        };
        return { dayLog: log, result: { ok: false, needsCorrection: true, message: log.pendingCorrection.message } };
      }
      if (open && open.type === SEGMENT_TYPES.PREP) {
        return fail(log, 'Submit truck inspection before clocking in at a job or shop.');
      }
      if (onAnyBreak(open)) return fail(log, 'Resume from lunch/pause before clocking in.');
      if (open) open.end = at; // close Travel (or nothing open at all is fine too)
      const type = action.jobRef ? SEGMENT_TYPES.ONSITE : SEGMENT_TYPES.SHOP;
      log.segments.push(newSegment(type, action.jobRef ?? null, at));
      return ok(log);
    }

    case ACTIONS.LEAVE: {
      // Point-of-Action Override: no open Onsite/Shop segment to close.
      if (!open || (open.type !== SEGMENT_TYPES.ONSITE && open.type !== SEGMENT_TYPES.SHOP)) {
        log.pendingCorrection = {
          reason: 'MISSING_CLOCK_IN',
          message: 'You were not clocked in here. Enter your actual arrival time to continue.',
          requestedJobRef: action.jobRef ?? null,
          requestedAt: at,
        };
        return { dayLog: log, result: { ok: false, needsCorrection: true, message: log.pendingCorrection.message } };
      }
      if (onAnyBreak(open)) return fail(log, 'Resume from lunch/pause before clocking out.');
      open.end = at;
      log.segments.push(newSegment(SEGMENT_TYPES.TRAVEL, null, at));
      return ok(log);
    }

    case ACTIONS.CORRECT_ARRIVAL: {
      // Resolves either MISSING_CLOCK_IN or SEQUENTIAL_LOCK by inserting
      // the corrected segment; flagged for administrative review. This
      // action alone never ends a job — a second LEAVE/ARRIVE is required.
      if (!log.pendingCorrection) return fail(log, 'No correction is pending.');
      const corr = log.pendingCorrection;
      if (corr.reason === 'SEQUENTIAL_LOCK') {
        const prevOpen = log.segments.find((s) => s.id === corr.openSegmentId);
        if (prevOpen) {
          prevOpen.end = action.correctedArrivalAt;
          prevOpen.flaggedForReview = true;
        }
        log.segments.push(newSegment(SEGMENT_TYPES.TRAVEL, null, action.correctedArrivalAt));
        log.needsReviewCount += 1;
        log.pendingCorrection = null;
        return ok(log, 'Corrected. Please Clock In again to arrive at the new location.');
      }
      if (corr.reason === 'MISSING_CLOCK_IN') {
        const type = corr.requestedJobRef ? SEGMENT_TYPES.ONSITE : SEGMENT_TYPES.SHOP;
        const seg = newSegment(type, corr.requestedJobRef, action.correctedArrivalAt);
        seg.flaggedForReview = true;
        log.segments.push(seg);
        log.needsReviewCount += 1;
        log.pendingCorrection = null;
        return ok(log, 'Corrected. Please Clock Out again to actually end this job.');
      }
      return fail(log, 'Unknown correction type.');
    }

    case ACTIONS.LUNCH_OUT: {
      if (!open) return fail(log, 'No active segment to pause.');
      if (isPaused(open)) return fail(log, 'Already on lunch.');
      if (isJobPaused(open)) return fail(log, 'Resume the job before going to lunch.');
      open.lunchBreaks.push({ start: at, end: null });
      return ok(log);
    }

    case ACTIONS.LUNCH_IN: {
      if (!open || !isPaused(open)) return fail(log, 'Not currently on lunch.');
      open.lunchBreaks[open.lunchBreaks.length - 1].end = at;
      return ok(log);
    }

    case ACTIONS.PAUSE_JOB: {
      if (!open || open.type !== SEGMENT_TYPES.ONSITE) {
        return fail(log, 'Pausing only applies while clocked in at a job.');
      }
      if (isPaused(open)) return fail(log, 'Resume from lunch before pausing the job.');
      if (isJobPaused(open)) return fail(log, 'Already paused.');
      if (!action.reason || !action.reason.trim()) {
        return fail(log, 'A reason is required to pause a job.');
      }
      if (!open.pauses) open.pauses = []; // backward-compat: segments created before this feature shipped
      open.pauses.push({ reason: action.reason.trim(), start: at, end: null });
      return ok(log);
    }

    case ACTIONS.RESUME_JOB: {
      if (!open || !isJobPaused(open)) return fail(log, 'Not currently paused.');
      open.pauses[open.pauses.length - 1].end = at;
      return ok(log);
    }

    case ACTIONS.END_DAY: {
      if (!open) return fail(log, 'Nothing open to end.');
      if (open.type === SEGMENT_TYPES.ONSITE) {
        return fail(log, 'Clock out of the job before ending the day.');
      }
      if (open.type === SEGMENT_TYPES.PREP) {
        return fail(log, 'Submit truck inspection before ending the day.');
      }
      if (onAnyBreak(open)) return fail(log, 'Resume from lunch/pause before ending the day.');
      open.end = at;
      log.dayState = DAY_STATES.ENDED;
      return ok(log);
    }

    default:
      return fail(log, `Unknown action: ${action.type}`);
  }
}

function newSegment(type, jobRef, start) {
  return {
    id: uid(),
    type,
    jobRef: jobRef ?? null,
    start,
    end: null,
    lunchBreaks: [],
    pauses: [],
    flaggedForReview: false,
  };
}

function ok(log, message) {
  log.updatedAt = new Date().toISOString();
  return { dayLog: log, result: { ok: true, message } };
}

function fail(log, message) {
  return { dayLog: log, result: { ok: false, message } };
}

// ---- Derived state for the UI -------------------------------------------

/** What the UI should currently show as the primary action. */
export function currentContext(dayLog) {
  const open = openSegment(dayLog);
  const jobPaused = isJobPaused(open);
  const openPauses = open?.pauses || [];
  return {
    dayState: dayLog.dayState,
    openSegmentType: open ? open.type : null,
    onLunch: isPaused(open),
    onJobPause: jobPaused,
    currentPauseReason: jobPaused ? openPauses[openPauses.length - 1].reason : null,
    pendingCorrection: dayLog.pendingCorrection,
    activeJobRef: open && (open.type === SEGMENT_TYPES.ONSITE) ? open.jobRef : null,
  };
}

/** Minutes helper (rounded to nearest minute). */
function minutesBetween(startISO, endISO) {
  return Math.round((new Date(endISO) - new Date(startISO)) / 60000);
}

/**
 * Totals worked/travel/lunch/prep minutes for a day log. Segments still
 * open are excluded from totals (use `asOf` to compute a live in-progress total).
 */
export function summarizeDay(dayLog, asOf = new Date().toISOString()) {
  const totals = { travel: 0, prep: 0, onsite: 0, shop: 0, lunch: 0, paused: 0, flagged: 0 };
  for (const seg of dayLog.segments) {
    const end = seg.end || asOf;
    let lunchMinutes = 0;
    for (const lb of seg.lunchBreaks) {
      lunchMinutes += minutesBetween(lb.start, lb.end || asOf);
    }
    let pauseMinutes = 0;
    for (const p of seg.pauses || []) {
      pauseMinutes += minutesBetween(p.start, p.end || asOf);
    }
    const gross = minutesBetween(seg.start, end);
    const net = Math.max(0, gross - lunchMinutes - pauseMinutes);
    totals[seg.type.toLowerCase()] += net;
    totals.lunch += lunchMinutes;
    totals.paused += pauseMinutes;
    if (seg.flaggedForReview) totals.flagged += 1;
  }
  const worked = totals.prep + totals.onsite + totals.shop; // travel is paid too, tracked separately for analytics
  return { ...totals, worked, paid: worked + totals.travel };
}

/**
 * Applies regional OT/DT thresholds (Section 1.5 / Section 2 of the proposal).
 * schedule: 'CA_STANDARD' (8h) | 'CA_ALT' (10h) | 'AZ' (8h)
 */
export function classifyOvertime(paidMinutes, schedule) {
  const scheduledMinutes = schedule === 'CA_ALT' ? 600 : 480; // 10h vs 8h
  const doubleTimeThreshold = 720; // 12h, all schedules
  const regular = Math.min(paidMinutes, scheduledMinutes);
  const overtime = Math.min(Math.max(paidMinutes - scheduledMinutes, 0), doubleTimeThreshold - scheduledMinutes);
  const doubletime = Math.max(paidMinutes - doubleTimeThreshold, 0);
  return { regular, overtime, doubletime };
}
