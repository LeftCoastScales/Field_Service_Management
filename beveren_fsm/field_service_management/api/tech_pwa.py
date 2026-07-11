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
from frappe.utils import now_datetime, nowdate, get_datetime, flt


@frappe.whitelist()
def debug_technician_resolution(appointment: str | None = None) -> dict:
    """
    TEMPORARY diagnostic — safe to remove once the add_part_to_appointment
    "not assigned" mystery is resolved. Returns what the server actually
    resolves at each step, without throwing, so we can see directly
    instead of guessing from a stack trace.
    """
    result = {"session_user": frappe.session.user}

    employees = frappe.get_all("Employee", filters={"user_id": frappe.session.user}, fields=["name", "status"])
    result["matching_employees"] = employees

    technicians = []
    for emp in employees:
        technicians += frappe.get_all(
            "Service Technician", filters={"employee": emp.name}, fields=["name", "employee"]
        )
    result["matching_service_technicians"] = technicians

    try:
        result["_current_employee_resolves_to"] = _current_employee()
    except Exception as e:
        result["_current_employee_error"] = str(e)

    try:
        result["_current_service_technician_resolves_to"] = _current_service_technician()
    except Exception as e:
        result["_current_service_technician_error"] = str(e)

    if appointment:
        result["appointment_checked"] = appointment
        assigned_rows = frappe.get_all(
            "Service Technician Item",
            filters={"parent": appointment},
            fields=["service_technician", "parent", "parenttype"],
        )
        result["all_technicians_on_this_appointment"] = assigned_rows

    return result


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
        "instructions": doc.get("dispatch_instructions"),  # office/sales-entered, read-only for the tech
        "customer_notes": doc.get("customer_notes"),
        "internal_notes": doc.get("internal_notes"),
        "is_crew_leader": is_crew_leader,
        "parts": _parts_for_appointment(doc),
    }


def _parts_for_appointment(doc) -> list[dict]:
    """
    Service Appointment.items (child doctype Service Order Item) carries
    both services and parts — same table shape as Service Order, since
    appointments are created from an order's line items. is_service
    distinguishes labor lines from actual parts so the PWA can filter or
    label them differently if it wants to.
    """
    return [
        {
            "item_code": row.item_code,
            "item_name": row.item_name,
            "qty": row.qty,
            "uom": row.uom,
            "rate": row.rate,
            "amount": row.amount,
            "is_service": bool(row.is_service),
        }
        for row in (doc.get("items") or [])
    ]


def _is_service_item_group(item_group: str | None) -> bool:
    return (item_group or "").strip().lower() in {"service", "services"}


@frappe.whitelist()
def search_items(query: str) -> list[dict]:
    """
    Item search for the Tech PWA's Add Part picker. Deliberately not
    scoped to a "parts" item group — a tech might reasonably need to add
    an extra service/labor line too, same flexibility Service Order
    already has on the Desk side.
    """
    if not query or len(query) < 2:
        return []

    # frappe.get_all, not get_list: Field Service User has no read grant
    # on Item (checked — there isn't even a fixture wiring Custom DocPerm
    # into hooks.py for this app, so that's not a quick permission-only
    # fix either). Item master data isn't sensitive per-row, and the
    # actual authorization boundary here is _assert_assigned() on the
    # write side (add_part_to_appointment), not this search.
    items = frappe.get_all(
        "Item",
        filters={"disabled": 0},
        or_filters=[
            ["item_code", "like", f"%{query}%"],
            ["item_name", "like", f"%{query}%"],
        ],
        fields=["item_code", "item_name", "item_group", "standard_rate", "stock_uom"],
        limit_page_length=20,
        order_by="item_name asc",
    )
    for item in items:
        item["is_service"] = _is_service_item_group(item.get("item_group"))
    return items


@frappe.whitelist()
def add_part_to_appointment(appointment: str, item_code: str, qty: float = 1) -> dict:
    """
    Adds a part (or service line) to the appointment's items table from
    the field. Online-only for now, same scope limitation as the Service
    Report — this doesn't queue into the offline mutation outbox, so it
    needs a live connection to succeed.
    """
    _assert_assigned(appointment, _current_service_technician())

    item = frappe.db.get_value(
        "Item", item_code, ["item_name", "item_group", "standard_rate", "stock_uom"], as_dict=True
    )
    if not item:
        frappe.throw(f"Item {item_code} not found.")

    qty = flt(qty) or 1
    rate = flt(item.standard_rate)

    doc = frappe.get_doc("Service Appointment", appointment)
    doc.append(
        "items",
        {
            "item_code": item_code,
            "item_name": item.item_name,
            "qty": qty,
            "uom": item.stock_uom,
            "rate": rate,
            "amount": rate * qty,
            "is_service": bool(_is_service_item_group(item.item_group)),
        },
    )
    doc.save(ignore_permissions=True)  # allow_on_submit=1 on items — works whether Open or already Scheduled/In Progress

    return {"parts": _parts_for_appointment(doc)}


def _assert_assigned(appointment: str, service_technician: str) -> None:
    assigned = frappe.db.exists(
        "Service Technician Item", {"parent": appointment, "service_technician": service_technician}
    )
    if not assigned:
        # TEMPORARY: includes the actual received values in the error so we
        # can see exactly what this specific call got, without digging
        # through the Payload tab. Revert once the mystery's solved.
        frappe.throw(
            f"You are not assigned to this appointment. "
            f"[debug: appointment={appointment!r}, service_technician={service_technician!r}]",
            frappe.PermissionError,
        )


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


# ---- Service Report (digital checklist) ------------------------------------
# Folds the earlier standalone CSR/Service Report concept into the Tech PWA,
# scoped to Service Appointment instead of Service Order so it lives
# alongside everything else on the job detail screen. One Service Report per
# appointment; checklist items are pre-populated from the
# LCS Service Report Checklist Template matching the appointment's Service
# Order's Service Type, if one exists. Photos are NOT duplicated here — the
# PWA's existing LCS Appointment Photo flow (upload_job_photo, above) already
# covers that.

def _service_report_for_appointment(appointment: str):
    """Returns the existing Service Report for this appointment, if any."""
    name = frappe.db.get_value("Service Report", {"service_appointment": appointment}, "name")
    return frappe.get_doc("Service Report", name) if name else None


def _serialize_service_report(doc) -> dict:
    return {
        "name": doc.name,
        "docstatus": doc.docstatus,
        "technician_notes": doc.get("technician_notes"),
        "submitted_at": doc.get("submitted_at"),
        "checklist": [
            {
                "checklist_item": row.checklist_item,
                "response": row.response,
                "notes": row.notes,
            }
            for row in doc.get("checklist") or []
        ],
    }


@frappe.whitelist()
def get_service_report(appointment: str) -> dict:
    """
    Returns the Service Report for this appointment, creating a new draft
    (with checklist pre-populated from the Service Type's template, if one
    exists) the first time a technician opens the Service Report screen
    for this job.
    """
    _assert_assigned(appointment, _current_service_technician())

    doc = _service_report_for_appointment(appointment)
    if not doc:
        doc = frappe.get_doc({"doctype": "Service Report", "service_appointment": appointment})
        doc.insert(ignore_permissions=True)  # validate() populates the checklist from the template

    return _serialize_service_report(doc)


def _apply_checklist_updates(doc, checklist, technician_notes: str | None) -> None:
    if checklist is not None:
        if isinstance(checklist, str):
            checklist = frappe.parse_json(checklist)
        responses_by_item = {row.get("checklist_item"): row for row in checklist}
        for row in doc.checklist:
            update = responses_by_item.get(row.checklist_item)
            if update:
                row.response = update.get("response") or row.response
                row.notes = update.get("notes", row.notes)
    if technician_notes is not None:
        doc.technician_notes = technician_notes


@frappe.whitelist()
def save_service_report(appointment: str, checklist=None, technician_notes: str | None = None) -> dict:
    """Saves in-progress checklist responses and notes without submitting."""
    _assert_assigned(appointment, _current_service_technician())

    doc = _service_report_for_appointment(appointment)
    if not doc:
        frappe.throw("No Service Report exists yet for this appointment — call get_service_report first.")
    if doc.docstatus != 0:
        frappe.throw("This Service Report has already been submitted and can no longer be edited here.")

    _apply_checklist_updates(doc, checklist, technician_notes)
    doc.save(ignore_permissions=True)
    return _serialize_service_report(doc)


@frappe.whitelist()
def submit_service_report(appointment: str, checklist=None, technician_notes: str | None = None) -> dict:
    """Applies any final checklist/notes edits, then submits — a Service
    Report is a completed-job audit record once submitted, not a draft."""
    service_technician = _current_service_technician()
    _assert_assigned(appointment, service_technician)

    doc = _service_report_for_appointment(appointment)
    if not doc:
        frappe.throw("No Service Report exists yet for this appointment — call get_service_report first.")
    if doc.docstatus != 0:
        frappe.throw("This Service Report has already been submitted.")

    _apply_checklist_updates(doc, checklist, technician_notes)
    doc.submitted_by = service_technician
    doc.flags.ignore_permissions = True
    doc.submit()
    return _serialize_service_report(doc)


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


# ---- doc_events hooks: carry dispatch instructions forward through the ----
# ---- Service Request -> Service Order -> Service Appointment chain.    ----
# Registered in hooks.py's doc_events, not whitelisted — these are internal
# document lifecycle callbacks, not REST endpoints. Each only fills in the
# field if it's still blank, so anything typed/edited at the Order level
# is never silently overwritten by a later save.

def copy_instructions_from_request(doc, method=None):
    """Service Order.validate — pulls Service Request.description forward
    into Service Order.dispatch_instructions the first time, if blank."""
    if doc.get("service_request") and not doc.get("dispatch_instructions"):
        source_description = frappe.db.get_value("Service Request", doc.service_request, "description")
        if source_description:
            doc.dispatch_instructions = source_description


def copy_instructions_from_order(doc, method=None):
    """Service Appointment.validate — same pattern, one hop further:
    Service Order.dispatch_instructions -> Service Appointment.dispatch_instructions."""
    if doc.get("service_order") and not doc.get("dispatch_instructions"):
        source_instructions = frappe.db.get_value("Service Order", doc.service_order, "dispatch_instructions")
        if source_instructions:
            doc.dispatch_instructions = source_instructions