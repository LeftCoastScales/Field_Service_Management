/**
 * client.js
 *
 * Thin wrapper over the Frappe REST API. The PWA is served from the same
 * origin (e.g. https://lcscales.v.frappe.cloud/tech), so session cookie
 * auth applies automatically — no API keys needed on-device. Every write
 * call must send the CSRF token, read fresh from the cookie, matching the
 * pattern established for the SAQ portal form (see SOP-SAQ-001).
 */

function getCsrfToken() {
  // Frappe injects frappe.csrf_token as a global on Desk pages, but on a
  // pure www/ route or a mounted SPA we read it from the cookie Frappe sets.
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : (window.frappe?.csrf_token ?? '');
}

async function request(path, { method = 'GET', body, isForm = false } = {}) {
  const headers = {};
  if (method !== 'GET') headers['X-Frappe-CSRF-Token'] = getCsrfToken();
  if (!isForm && body) headers['Content-Type'] = 'application/json';

  const res = await fetch(path, {
    method,
    headers,
    credentials: 'same-origin',
    body: isForm ? body : body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(`Frappe API ${method} ${path} failed: ${res.status}`);
    err.status = res.status;
    err.detail = text;
    throw err;
  }
  return res.json();
}

// ---- Whitelisted methods (see beveren_fsm/field_service_management/api/tech_pwa.py) --------------------

/** Today's (and optionally upcoming) appointments assigned to the logged-in tech. */
export function getMyJobs({ from, to } = {}) {
  const params = new URLSearchParams();
  if (from) params.set('from_date', from);
  if (to) params.set('to_date', to);
  return request(`/api/method/beveren_fsm.field_service_management.api.tech_pwa.get_my_jobs?${params.toString()}`);
}

/** Full detail for a single Service Appointment, including customer/site/parts. */
export function getJobDetail(appointmentName) {
  return request(`/api/method/beveren_fsm.field_service_management.api.tech_pwa.get_job_detail?appointment=${encodeURIComponent(appointmentName)}`);
}

/**
 * Applies one chained-logic time tracking action server-side and returns
 * the reconciled day log. `action` shape: { action_type, at, job_ref, employee }
 */
export function submitTimeAction(action) {
  return request('/api/method/beveren_fsm.field_service_management.api.tech_pwa.submit_time_action', {
    method: 'POST',
    body: action,
  });
}

/** Pushes a customer/internal notes update for an appointment. */
export function updateNotes({ appointmentName, customerNotes, internalNotes }) {
  return request('/api/method/beveren_fsm.field_service_management.api.tech_pwa.update_notes', {
    method: 'POST',
    body: { appointment: appointmentName, customer_notes: customerNotes, internal_notes: internalNotes },
  });
}

/** Uploads a single photo blob against LCS Appointment Photo, linked to the appointment. */
export function uploadPhoto({ appointmentName, blob, caption }) {
  const form = new FormData();
  form.append('file', blob, `job-photo-${Date.now()}.jpg`);
  form.append('appointment', appointmentName);
  form.append('caption', caption || '');
  return request('/api/method/beveren_fsm.field_service_management.api.tech_pwa.upload_job_photo', {
    method: 'POST',
    isForm: true,
    body: form,
  });
}

/**
 * Frappe error responses are a JSON body with either a top-level
 * "message", or a "_server_messages" field (a JSON-stringified array of
 * JSON-stringified {message, indicator, ...} objects — yes, double
 * encoded). This pulls out the actual human-readable text instead of
 * showing a generic "something went wrong" that hides what the server
 * actually said.
 */
export function extractErrorMessage(err, fallback = 'Something went wrong — try again.') {
  try {
    const body = JSON.parse(err.detail || '');
    if (body._server_messages) {
      const messages = JSON.parse(body._server_messages);
      if (messages.length) {
        const first = JSON.parse(messages[0]);
        if (first.message) return first.message;
      }
    }
    if (body.message) return body.message;
    if (body.exc_type) return `${body.exc_type}: ${fallback}`;
  } catch {
    // response wasn't the shape we expected — fall through to fallback
  }
  return fallback;
}

export function whoAmI() {
  return request('/api/method/frappe.auth.get_logged_user');
}

/** Resolves the logged-in user's Employee ID — used once on app load. */
export function getCurrentTechnician() {
  return request('/api/method/beveren_fsm.field_service_management.api.tech_pwa.get_current_technician');
}

/** Item search for the Add Part picker. */
export function searchItems(query) {
  return request(`/api/method/beveren_fsm.field_service_management.api.tech_pwa.search_items?query=${encodeURIComponent(query)}`);
}

/** Adds a part/item to the appointment. Online-only — no offline queue. */
export function addPartToAppointment({ appointmentName, itemCode, qty }) {
  return request('/api/method/beveren_fsm.field_service_management.api.tech_pwa.add_part_to_appointment', {
    method: 'POST',
    body: { appointment: appointmentName, item_code: itemCode, qty },
  });
}

/** Fetches (or creates, on first open) the Service Report for an appointment. */
export function getServiceReport(appointmentName) {
  return request(`/api/method/beveren_fsm.field_service_management.api.tech_pwa.get_service_report?appointment=${encodeURIComponent(appointmentName)}`);
}

/** Saves in-progress checklist responses/notes without submitting. */
export function saveServiceReport({ appointmentName, checklist, technicianNotes }) {
  return request('/api/method/beveren_fsm.field_service_management.api.tech_pwa.save_service_report', {
    method: 'POST',
    body: { appointment: appointmentName, checklist, technician_notes: technicianNotes },
  });
}

/** Applies final edits and submits the Service Report — no further edits after this. */
export function submitServiceReport({ appointmentName, checklist, technicianNotes }) {
  return request('/api/method/beveren_fsm.field_service_management.api.tech_pwa.submit_service_report', {
    method: 'POST',
    body: { appointment: appointmentName, checklist, technician_notes: technicianNotes },
  });
}
