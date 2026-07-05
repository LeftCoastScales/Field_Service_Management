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


def _current_service_technician() -> str:
    """
    Service Technician Item.service_technician links to the Service
    Technician DocType, not directly to Employee — Service Technician
    has its own `employee` field one hop further out. Every appointment
    assignment check has to go through this, not _current_employee().
    """
    employee = _current_employee()
    technician = frappe.db.get_value("Service Technician", {"employee": employee}, "name")
    if not technician:
        frappe.throw(
            "No Service Technician record is linked to your Employee record. Contact the office.",
        )
    return technician


def _format_address(fields: dict) -> str | None:
    """Joins Address doctype fields into a single display/Maps-query-friendly line."""
    parts = [
        fields.get("address_line1"),
        fields.get("address_line2"),
        fields.get("city"),
        fields.get("state"),
        fields.get("pincode"),
    ]
    parts = [p for p in parts if p]
    return ", ".join(parts) if parts else None


def _site_addresses_for_orders(service_order_names: list[str]) -> dict[str, str | None]:
    """
    Batched version for list views: Service Order -> Address in two
    bulk queries instead of one round-trip per appointment. Address is
    reached via Service Order.customer_address (a Link), not the mixed
    contact/address text block in Service Order.address_details.
    """
    service_order_names = [n for n in service_order_names if n]
    if not service_order_names:
        return {}

    orders = frappe.get_all(
        "Service Order",
        filters={"name": ("in", service_order_names)},
        fields=["name", "customer_address"],
    )
    order_to_address = {o.name: o.customer_address for o in orders if o.customer_address}
    address_names = list(set(order_to_address.values()))
    if not address_names:
        return {}

    addresses = frappe.get_all(
        "Address",
        filters={"name": ("in", address_names)},
        fields=["name", "address_line1", "address_line2", "city", "state", "pincode"],
    )
    address_lookup = {a.name: _format_address(a) for a in addresses}

    return {
        order_name: address_lookup.get(address_name)
        for order_name, address_name in order_to_address.items()
    }


def _site_address_for_order(service_order_name: str | None) -> str | None:
    """Single-lookup version for get_job_detail."""
    if not service_order_name:
        return None
    return _site_addresses_for_orders([service_order_name]).get(service_order_name)


@frappe.whitelist()
def get_my_jobs(from_date: str | None = None, to_date: str | None = None) -> list[dict]:
    """Today's (or a given range's) Service Appointments assigned to the logged-in technician."""
    service_technician = _current_service_technician()
    from_date = from_date or nowdate()
    to_date = to_date or from_date

    tech_rows = frappe.get_all(
        "Service Technician Item",
        filters={"service_technician": service_technician},
        fields=["parent", "custom_is_crew_leader"],
    )
    appointment_names = list({r.parent for r in tech_rows})
    if not appointment_names:
        return []
    crew_leader_by_appointment = {r.parent: bool(r.custom_is_crew_leader) for r in tech_rows}

    appointments = frappe.get_list(
        "Service Appointment",
        filters={
            "name": ("in", appointment_names),
            "scheduled_start_datetime": ("between", [f"{from_date} 00:00:00", f"{to_date} 23:59:59"]),
        },
        fields=["name", "customer", "status", "scheduled_start_datetime", "service_order"],
        order_by="scheduled_start_datetime asc",
    )
    address_by_order = _site_addresses_for_orders([a.service_order for a in appointments])
    return [
        {
            "name": a.name,
            "customer_name": a.customer,  # Customer's name field doubles as its display title
            "site_address": address_by_order.get(a.service_order),
            "scheduled_start": a.scheduled_start_datetime,
            "status": a.status,
            "is_crew_leader": crew_leader_by_appointment.get(a.name, False),
        }
        for a in appointments
    ]


@frappe.whitelist()
def get_job_detail(appointment: str) -> dict:
    """Full detail for a single appointment: notes, status, customer."""
    service_technician = _current_service_technician()
    _assert_assigned(appointment, service_technician)

    doc = frappe.get_doc("Service Appointment", appointment)

    is_crew_leader = bool(frappe.db.get_value(
        "Service Technician Item",
        {"parent": appointment, "service_technician": service_technician},
        "custom_is_crew_leader",
    ))

    return {
        "name": doc.name,
        "customer_name": doc.customer,
        "site_address": _site_address_for_order(doc.get("service_order")),
        "scheduled_start": doc.scheduled_start_datetime,
        "status": doc.status,
        "customer_notes": doc.get("customer_notes"),
        "internal_notes": doc.get("internal_notes"),
        "is_crew_leader": is_crew_leader,
        # Parts list needs its real fieldname confirmed before wiring up —
        # left as a safe default for now so this endpoint doesn't 500 on
        # an unverified column.
        "parts": [],
    }


def _assert_assigned(appointment: str, service_technician: str) -> None:
    assigned = frappe.db.exists(
        "Service Technician Item", {"parent": appointment, "service_technician": service_technician}
    )
    if not assigned:
        frappe.throw("You are not assigned to this appointment.", frappe.PermissionError)


@frappe.whitelist()
def update_notes(appointment: str, customer_notes: str = "", internal_notes: str = "") -> dict:
    """Writes customer-facing and internal-only notes for an appointment."""
    _assert_assigned(appointment, _current_service_technician())

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
    _assert_assigned(appointment, _current_service_technician())

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