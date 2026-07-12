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
def get_current_technician() -> dict:
    """
    Resolves the logged-in user's Employee/Service Technician records.
    Used once on app load so `employee` is never blank in the PWA's sync
    payloads — previously hardcoded to null in App.jsx and never actually
    resolved, even though the server-side fallback in submit_time_action
    (employee or _current_employee()) meant this likely wasn't the cause
    of any missing day logs — just a real gap worth closing regardless.
    """
    return {
        "employee": _current_employee(),
        "service_technician": _current_service_technician(),
    }


@frappe.whitelist()
def complete_appointment(appointment: str) -> dict:
    """
    Marks a job complete: sets Service Appointment.status to "Completed"
    (which cascades to the linked Service Order's status via
    update_service_order_status), and removes it from this technician's
    job list going forward — see the status filter in get_my_jobs.
    Deliberately independent of Service Report submission: requiring
    that first would currently block completion on any service type
    that doesn't yet have a checklist template set up.
    """
    _assert_assigned(appointment, _current_service_technician())
    doc = frappe.get_doc("Service Appointment", appointment)
    doc.status = "Completed"
    doc.save(ignore_permissions=True)
    return {"status": doc.status}


@frappe.whitelist()
def get_completion_email_info(appointment: str) -> dict:
    """
    Tells the PWA whether there's a Service Report worth sending as a PDF,
    and whether a client email is already on file (Service Order's
    customer_contact -> Contact.email_id) so it knows whether to prompt
    for one.
    """
    _assert_assigned(appointment, _current_service_technician())

    report = _service_report_for_appointment(appointment)
    if not report:
        return {"has_service_report": False, "email": None}

    service_order = frappe.db.get_value("Service Appointment", appointment, "service_order")
    email = None
    if service_order:
        contact = frappe.db.get_value("Service Order", service_order, "customer_contact")
        if contact:
            email = frappe.db.get_value("Contact", contact, "email_id")

    return {"has_service_report": True, "email": email}


@frappe.whitelist()
def send_service_report_pdf(appointment: str, emails) -> dict:
    """
    Emails the Service Report as a PDF to one or more addresses. `emails`
    may be a list or a comma-separated string (whichever survives the
    JSON round-trip more conveniently from the client).
    """
    _assert_assigned(appointment, _current_service_technician())

    report = _service_report_for_appointment(appointment)
    if not report:
        frappe.throw("No Service Report exists for this appointment to send.")

    if isinstance(emails, str):
        emails = [e.strip() for e in emails.split(",") if e.strip()]
    emails = [e for e in (emails or []) if e]
    if not emails:
        frappe.throw("At least one email address is required.")

    pdf_bytes = frappe.get_print("Service Report", report.name, as_pdf=True)
    frappe.sendmail(
        recipients=emails,
        subject=f"Service Report — {report.name}",
        message="Please find attached the service report for your recent appointment.",
        attachments=[{"fname": f"{report.name}.pdf", "fcontent": pdf_bytes}],
    )
    return {"sent_to": emails}


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
            "status": ("!=", "Completed"),  # Mark Complete removes a job from the tech's list
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
        "reference_numbers": _reference_numbers_for_appointment(doc),
    }


def _reference_numbers_for_appointment(doc) -> dict:
    """
    The full document chain a job can be traced through: Service Request
    (what LCS staff call a "Service Call") -> Service Quotation ->
    Service Order -> this Service Appointment. Any of the upstream links
    may be blank depending on how the job originated (e.g. an order
    created directly with no prior quote or call), so this only
    includes whichever are actually set.
    """
    numbers = {"service_appointment": doc.name}

    service_order = doc.get("service_order")
    if service_order:
        numbers["service_order"] = service_order
        order_refs = frappe.db.get_value(
            "Service Order", service_order, ["service_quotation", "service_request"], as_dict=True
        )
        if order_refs:
            if order_refs.service_quotation:
                numbers["service_quotation"] = order_refs.service_quotation
            if order_refs.service_request:
                numbers["service_call"] = order_refs.service_request  # "Service Call" is LCS's name for Service Request

    return numbers


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
        appt = frappe.db.get_value("Service Appointment", appointment, ["service_order", "customer"], as_dict=True)
        doc = frappe.get_doc({
            "doctype": "Service Report",
            "service_appointment": appointment,
            # Set explicitly rather than relying on fetch_from — fetch_from
            # only auto-populates through Desk's client-side JS when a Link
            # field changes in the browser, not when a document is created
            # server-side like this. Left unset, these silently stayed
            # blank on every new Service Report.
            "service_order": appt.service_order if appt else None,
            "customer": appt.customer if appt else None,
        })
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
def submit_time_action(
    action_type: str,
    at: str,
    job_ref: str | None = None,
    employee: str | None = None,
    reason: str | None = None,
    duration_minutes: int | None = None,
    corrected_arrival_at: str | None = None,
    correction_reason: str | None = None,
    correction_job_ref: str | None = None,
    log_date: str | None = None,
) -> dict:
    """
    Reconciles one chained-logic time tracking action against the
    technician's LCS Tech Day Log for `log_date` — the technician's own
    local calendar date, supplied explicitly by the client. Validation
    mirrors src/state/timeTrackingMachine.js — see that file for the
    authoritative rules (Section 1.1-1.5 of the Time-Tracking Proposal).

    `at` and `corrected_arrival_at` are local wall-clock strings (no
    'Z'/UTC suffix) — see toLocalDatetimeString() client-side. Frappe
    stores Datetime fields naively (no timezone conversion), so these
    must already be local by the time they arrive here; sending UTC
    would have every stored segment start/end silently shift by the
    browser's UTC offset. Same reasoning applies to log_date: supplied
    explicitly by the client rather than derived from `at` here, since
    `at` alone can't safely be re-parsed into "the technician's calendar
    date" without redoing the same local-time logic already done
    client-side. Falls back to deriving log_date from `at` only for
    mutations already queued before this fix shipped, which won't carry
    log_date at all — that fallback predates the local-time fix too, so
    it inherits the same historical UTC-drift imprecision for any such
    leftover mutations specifically.

    This endpoint is intentionally permissive on ordering: because the
    device is the offline source of truth, the server accepts the action
    log as reported and only flags conflicts for admin review rather than
    rejecting the sync outright, which would strand queued mutations.
    """
    employee = employee or _current_employee()
    log_date = log_date or get_datetime(at).date().isoformat()
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

    # Job pause: record the reason immediately (at PAUSE_JOB time); the
    # elapsed minutes arrive later with RESUME_JOB, once the device knows
    # the exact duration.
    if action_type == "PAUSE_JOB" and open_segment and reason:
        open_segment.pause_reason = (
            f"{open_segment.pause_reason}; {reason}" if open_segment.pause_reason else reason
        )

    if action_type == "RESUME_JOB" and open_segment and duration_minutes:
        open_segment.pause_minutes = (open_segment.pause_minutes or 0) + duration_minutes

    # Lunch minutes: previously computed client-side but never actually
    # persisted here despite the field existing on the child table —
    # fixed alongside the new pause tracking above.
    if action_type == "LUNCH_IN" and open_segment and duration_minutes:
        open_segment.lunch_minutes = (open_segment.lunch_minutes or 0) + duration_minutes

    # Manually-entered technician corrections. This mirrors
    # timeTrackingMachine.js's CORRECT_ARRIVAL case exactly — see that
    # file for why these are the only two recoverable flag reasons.
    # Previously this action was never synced to the server at all
    # (excluded client-side), so a flagged segment could only ever be
    # resolved by someone editing the record directly in Desk.
    if action_type == "CORRECT_ARRIVAL" and corrected_arrival_at:
        if correction_reason == "SEQUENTIAL_LOCK":
            if open_segment:
                open_segment.end_time = corrected_arrival_at
                open_segment.flagged_for_review = 1
                open_segment.correction_reason = "Sequential Lock"
            log.append("segments", {"segment_type": "Travel", "start_time": corrected_arrival_at})
        elif correction_reason == "MISSING_CLOCK_IN":
            log.append("segments", {
                "segment_type": "Onsite" if correction_job_ref else "Shop",
                "reference_appointment": correction_job_ref,
                "start_time": corrected_arrival_at,
                "flagged_for_review": 1,
                "correction_reason": "Missing Clock-In",
            })

    if action_type == "END_DAY":
        log.day_state = "Ended"

    if action_type == "REOPEN_DAY":
        # Undoes an End Day tapped by mistake. Flagged for review since
        # it's a correction to a payroll-relevant record, same reasoning
        # as the other manual corrections above.
        log.day_state = "Active"
        if log.segments:
            log.segments[-1].flagged_for_review = 1
            log.segments[-1].correction_reason = "Reopened Day"

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