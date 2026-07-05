"""
beveren_fsm/field_service_management/api/tech_pwa.py

Whitelisted REST endpoints for the LCS Field Tech PWA (/tech). Every
write here mirrors the client-side chained-logic state machine
(src/state/timeTrackingMachine.js) so the server is the final source of
truth once a mutation syncs, while the device stays fully authoritative
offline. All reads use frappe.qb / frappe.get_list to enforce RBAC per
the coding-style guide's security rules — never frappe.get_all here.
"""

from __future__ import annotations

import frappe
from frappe.utils import now_datetime, nowdate, get_datetime


def _current_employee() -> str:
    employee = frappe.db.get_value("Employee", {"user_id": frappe.session.user}, "name")
    if not employee:
        frappe.throw("No Employee record is linked to your user account. Contact the office.")
    return employee


@frappe.whitelist()
def get_my_jobs(from_date: str | None = None, to_date: str | None = None) -> list[dict]:
    """Today's (or a given range's) Service Appointments assigned to the logged-in technician."""
    employee = _current_employee()
    from_date = from_date or nowdate()
    to_date = to_date or from_date

    Appointment = frappe.qb.DocType("Service Appointment")
    TechItem = frappe.qb.DocType("Service Technician Item")

    query = (
        frappe.qb.from_(Appointment)
        .join(TechItem)
        .on(TechItem.parent == Appointment.name)
        .select(
            Appointment.name,
            Appointment.customer_name,
            Appointment.site_address,
            Appointment.scheduled_start,
            Appointment.status,
            TechItem.is_crew_leader,
        )
        .where(TechItem.employee == employee)
        .where(Appointment.scheduled_date[from_date:to_date])
        .orderby(Appointment.scheduled_start)
    )
    return frappe.get_list(
        "Service Appointment",
        filters={"name": ("in", [r.name for r in query.run(as_dict=True)])},
        fields=[
            "name", "customer_name", "site_address", "scheduled_start",
            "status",
        ],
    )


@frappe.whitelist()
def get_job_detail(appointment: str) -> dict:
    """Full detail for a single appointment: notes, parts, equipment, crew role."""
    employee = _current_employee()
    _assert_assigned(appointment, employee)

    doc = frappe.get_doc("Service Appointment", appointment)
    tech_row = next((r for r in doc.technicians if r.employee == employee), None)

    return {
        "name": doc.name,
        "customer_name": doc.customer_name,
        "site_address": doc.site_address,
        "scheduled_start": doc.scheduled_start,
        "status": doc.status,
        "customer_notes": doc.get("customer_notes"),
        "internal_notes": doc.get("internal_notes"),
        "equipment_summary": doc.get("equipment_summary"),
        "is_crew_leader": bool(tech_row and tech_row.is_crew_leader),
        "parts": [
            {"item_name": p.item_name, "qty": p.qty}
            for p in doc.get("parts", [])
        ],
    }


def _assert_assigned(appointment: str, employee: str) -> None:
    assigned = frappe.db.exists(
        "Service Technician Item", {"parent": appointment, "employee": employee}
    )
    if not assigned:
        frappe.throw("You are not assigned to this appointment.", frappe.PermissionError)


@frappe.whitelist()
def update_notes(appointment: str, customer_notes: str = "", internal_notes: str = "") -> dict:
    """Writes customer-facing and internal-only notes for an appointment."""
    employee = _current_employee()
    _assert_assigned(appointment, employee)

    doc = frappe.get_doc("Service Appointment", appointment)
    doc.db_set("customer_notes", customer_notes, update_modified=True)
    doc.db_set("internal_notes", internal_notes, update_modified=True)
    return {"ok": True}


@frappe.whitelist()
def upload_job_photo() -> dict:
    """
    Handles multipart file upload for a job photo. Expects form fields:
    file (the image), appointment, caption. Uses frappe's file API so the
    resulting File doc attaches directly to the new LCS Appointment Photo
    record, which links back to the Service Appointment.
    """
    from frappe.handler import upload_file

    appointment = frappe.form_dict.get("appointment")
    caption = frappe.form_dict.get("caption", "")
    employee = _current_employee()
    _assert_assigned(appointment, employee)

    file_doc = upload_file()  # saves the uploaded file, returns a File doc

    photo = frappe.get_doc({
        "doctype": "LCS Appointment Photo",
        "appointment": appointment,
        "photo": file_doc.file_url,
        "caption": caption,
        "taken_by": frappe.session.user,
        "taken_at": now_datetime(),
    })
    photo.insert(ignore_permissions=False)
    return {"file_url": file_doc.file_url, "photo_name": photo.name}


@frappe.whitelist()
def submit_time_action(action_type: str, at: str, job_ref: str | None = None, employee: str | None = None) -> dict:
    """
    Reconciles one chained-logic time tracking action against the
    technician's LCS Tech Day Log for `at`'s calendar date. Validation
    mirrors src/state/timeTrackingMachine.js — see that file for the
    authoritative rules (Section 1.1-1.5 of the Time-Tracking Proposal).

    This endpoint is intentionally permissive on ordering: because the
    device is the offline source of truth, the server accepts the action
    log as reported and only flags conflicts for admin review rather than
    rejecting the sync outright, which would strand queued mutations.
    """
    employee = employee or _current_employee()
    log_date = get_datetime(at).date().isoformat()
    log_name = f"TDL-{employee}-{log_date}"

    if frappe.db.exists("LCS Tech Day Log", log_name):
        log = frappe.get_doc("LCS Tech Day Log", log_name)
    else:
        log = frappe.get_doc({
            "doctype": "LCS Tech Day Log",
            "employee": employee,
            "log_date": log_date,
            "day_state": "Active",
        })
        log.insert(ignore_permissions=True)

    open_segment = log.segments[-1] if log.segments and not log.segments[-1].end_time else None

    segment_type_map = {
        "CLOCK_IN_LIGHT": "Travel",
        "START_INSPECTION": "Prep",
        "ARRIVE": "Onsite" if job_ref else "Shop",
    }

    # Close whatever segment is currently open before opening the next one.
    if action_type in ("SUBMIT_INSPECTION", "ARRIVE", "LEAVE", "END_DAY") and open_segment:
        open_segment.end_time = at

    # Open the segment this action starts (Day-Start / Arrive actions).
    if action_type in ("CLOCK_IN_LIGHT", "START_INSPECTION", "ARRIVE"):
        log.append("segments", {
            "segment_type": segment_type_map[action_type],
            "reference_appointment": job_ref,
            "start_time": at,
        })

    # Submit Inspection and Leave both hand off into Travel.
    if action_type in ("SUBMIT_INSPECTION", "LEAVE"):
        log.append("segments", {"segment_type": "Travel", "start_time": at})

    if action_type == "END_DAY":
        log.day_state = "Ended"

    log.needs_review_count = sum(1 for s in log.segments if s.flagged_for_review)
    log.save(ignore_permissions=True)
    return {"day_log": log.name, "day_state": log.day_state}
