# Copyright (c) 2026, Left Coast Scales
# For license information, please see license.txt
#
# ZZTEST test data tools -- loads/removes a sample data set covering the
# LCS test plan (Customer/Contact/Address, Service Type/Area, Service
# Technicians, LCS Vehicle, LCS Scale Model + Customer Equipment pair,
# LCS Service Report Checklist Template, LCS Service Agreement, and a
# starter Service Request) directly through Frappe's ORM -- no external
# scripts, API keys, or REST calls needed. Runs entirely server-side,
# triggered from the "ZZTEST Data Tools" Desk page.
#
# Drop this file at:
#   beveren_fsm/field_service_management/api/zztest_data.py

import json
import os
from datetime import datetime

import frappe
from frappe import _
from frappe.utils import today, add_days

ZZTEST_PREFIX = "ZZTEST"


def _manifest_path():
    return frappe.get_site_path("private", "files", "zztest_manifest.json")


def _lock_path():
    return frappe.get_site_path("private", "files", "zztest_removed.lock")


def _load_manifest():
    path = _manifest_path()
    if not os.path.exists(path):
        return []
    with open(path) as f:
        return json.load(f)


def _save_manifest(manifest):
    with open(_manifest_path(), "w") as f:
        json.dump(manifest, f, indent=2)


def _require_system_manager():
    if "System Manager" not in frappe.get_roles():
        frappe.throw(_("Only a System Manager can run the ZZTEST data tools."), frappe.PermissionError)


def _default_company():
    company = frappe.db.get_single_value("Global Defaults", "default_company")
    if not company:
        companies = frappe.get_all("Company", pluck="name", limit=1)
        company = companies[0] if companies else None
    if not company:
        frappe.throw(
            _(
                "No Company exists on this site yet. Complete the ERPNext Setup Wizard "
                "(or create a Company record) before loading test data."
            )
        )
    return company


def _company_currency_and_country(company):
    doc = frappe.get_cached_doc("Company", company)
    return (doc.default_currency or "USD"), (doc.country or "United States")


class _Builder:
    """Tracks what this run creates and appends it to the on-disk manifest."""

    def __init__(self):
        self.manifest = _load_manifest()
        self.lines = []
        self.last_created = False

    def log(self, line):
        self.lines.append(line)

    def create(self, doctype, values, dedupe_filters=None, track=True):
        if dedupe_filters:
            existing = frappe.db.get_value(doctype, dedupe_filters)
            if existing:
                self.log(f"= {doctype} '{existing}' already exists, skipping")
                self.last_created = False
                return existing

        doc = frappe.get_doc({"doctype": doctype, **values})
        doc.insert(ignore_permissions=True)
        self.log(f"+ created {doctype} '{doc.name}'")
        if track:
            self.manifest.append({"doctype": doctype, "name": doc.name})
            _save_manifest(self.manifest)
        self.last_created = True
        return doc.name


@frappe.whitelist()
def get_status():
    """Used by the Desk page on load to show current state."""
    _require_system_manager()
    manifest = _load_manifest()
    return {
        "locked": os.path.exists(_lock_path()),
        "record_count": len(manifest),
        "lock_note": open(_lock_path()).read() if os.path.exists(_lock_path()) else None,
    }


@frappe.whitelist()
def create_test_data():
    _require_system_manager()

    if os.path.exists(_lock_path()):
        frappe.throw(
            _(
                "Test data was already created and removed once on this site, and was "
                "locked to stop it being silently re-applied. Use the 'Unlock' button on "
                "the ZZTEST Data Tools page if you deliberately want to re-seed it."
            )
        )

    b = _Builder()
    company = _default_company()
    currency, country = _company_currency_and_country(company)

    b.log("1. Manufacturer")
    manufacturer = b.create(
        "Manufacturer",
        {"short_name": f"{ZZTEST_PREFIX} Manufacturer"},
        dedupe_filters={"short_name": f"{ZZTEST_PREFIX} Manufacturer"},
    )

    b.log("2. LCS Scale Models (Base + Display)")
    base_model = b.create(
        "LCS Scale Model",
        {
            "manufacturer": manufacturer,
            "model_number": f"{ZZTEST_PREFIX} Base 500x0.1",
            "equipment_type": "Base",
            "capacity": 500,
            "capacity_unit": "lb",
            "resolution": 0.1,
            "resolution_unit": "lb",
        },
        dedupe_filters={"model_number": f"{ZZTEST_PREFIX} Base 500x0.1"},
    )
    display_model = b.create(
        "LCS Scale Model",
        {
            "manufacturer": manufacturer,
            "model_number": f"{ZZTEST_PREFIX} Display 500x0.1",
            "equipment_type": "Display",
            "capacity": 500,
            "capacity_unit": "lb",
            "resolution": 0.1,
            "resolution_unit": "lb",
        },
        dedupe_filters={"model_number": f"{ZZTEST_PREFIX} Display 500x0.1"},
    )

    b.log("3. Service Type")
    service_type_name = f"{ZZTEST_PREFIX} Calibration Service"
    service_type = b.create(
        "Service Type",
        {"name": service_type_name, "description": "QA test service type"},
        dedupe_filters={"name": service_type_name},
    )

    b.log("4. Service Area")
    service_area_name = f"{ZZTEST_PREFIX} Test Area"
    service_area = b.create(
        "Service Area",
        {"service_area": service_area_name},
        dedupe_filters={"name": service_area_name},
    )

    b.log("5. Customer")
    customer_name = f"{ZZTEST_PREFIX} Acme Scale Co"
    customer = b.create(
        "Customer",
        {"customer_name": customer_name, "customer_type": "Company"},
        dedupe_filters={"customer_name": customer_name},
    )

    b.log("6. Address")
    address_title = f"{ZZTEST_PREFIX} Acme Scale Co"
    address = b.create(
        "Address",
        {
            "address_title": address_title,
            "address_type": "Office",
            "address_line1": "123 Test Way",
            "city": "Perris",
            "state": "CA",
            "pincode": "92570",
            "country": country,
            "links": [{"link_doctype": "Customer", "link_name": customer}],
        },
        dedupe_filters={"address_title": address_title, "address_type": "Office"},
    )

    b.log("7. Contact")
    contact = b.create(
        "Contact",
        {
            "first_name": ZZTEST_PREFIX,
            "last_name": "Contact",
            "links": [{"link_doctype": "Customer", "link_name": customer}],
            "email_ids": [{"email_id": "zztest.contact@example.com", "is_primary": 1}],
            "phone_nos": [{"phone": "555-010-0100", "is_primary_phone": 1}],
        },
        dedupe_filters={"first_name": ZZTEST_PREFIX, "last_name": "Contact"},
    )

    b.log("8. Service Technicians (for crew-leader / overlap tests)")
    b.create(
        "Service Technician",
        {"full_name": f"{ZZTEST_PREFIX} Tech One", "service_area": service_area},
        dedupe_filters={"full_name": f"{ZZTEST_PREFIX} Tech One"},
    )
    b.create(
        "Service Technician",
        {"full_name": f"{ZZTEST_PREFIX} Tech Two", "service_area": service_area},
        dedupe_filters={"full_name": f"{ZZTEST_PREFIX} Tech Two"},
    )

    b.log("9. LCS Vehicle (fleet / non-human resource)")
    b.create(
        "LCS Vehicle",
        {
            "unit_number": f"{ZZTEST_PREFIX}-99",
            "nickname": "Test Truck",
            "vehicle_type": "Straight Truck",
            "form_type": "DOT",
            "status": "Active",
            "service_area": service_area,
            "branch": "Perris",
            "year": 2022,
            "make": "Freightliner",
            "model": "M2",
        },
        dedupe_filters={"unit_number": f"{ZZTEST_PREFIX}-99"},
    )

    b.log("10. LCS Customer Equipment - Display (auto-pairs a Base)")
    display_serial = f"{ZZTEST_PREFIX}-DISP-0001"
    display_equipment = b.create(
        "LCS Customer Equipment",
        {
            "customer": customer,
            "service_address": address,
            "status": "Active",
            "equipment_type": "Display",
            "manufacturer": manufacturer,
            "scale_model": display_model,
            "serial_number": display_serial,
            "base_manufacturer": manufacturer,
            "base_scale_model": base_model,
            "base_serial_number": f"{ZZTEST_PREFIX}-BASE-0001",
            "calibration_interval_months": 12,
            "last_calibration_date": add_days(today(), -180),
        },
        dedupe_filters={"serial_number": display_serial},
    )
    # after_insert on the Display record auto-creates the paired Base --
    # only capture/track it when THIS call actually just created the
    # Display (not on a re-run where it was found via dedupe_filters),
    # otherwise re-running this would append a duplicate manifest entry
    # for a Base record already being tracked.
    if b.last_created:
        paired_base = frappe.db.get_value("LCS Customer Equipment", display_equipment, "paired_component")
        if paired_base:
            b.log(f"+ auto-paired Base record '{paired_base}'")
            b.manifest.append({"doctype": "LCS Customer Equipment", "name": paired_base})
            _save_manifest(b.manifest)

    b.log("11. LCS Customer Equipment - overdue calibration (for scheduler test)")
    overdue_serial = f"{ZZTEST_PREFIX}-OVERDUE-0001"
    b.create(
        "LCS Customer Equipment",
        {
            "customer": customer,
            "service_address": address,
            "status": "Active",
            "equipment_type": "Unit",
            "manufacturer": manufacturer,
            "scale_model": base_model,
            "serial_number": overdue_serial,
            "calibration_interval_months": 1,
            "last_calibration_date": add_days(today(), -400),
        },
        dedupe_filters={"serial_number": overdue_serial},
    )

    b.log("12. LCS Service Report Checklist Template")
    b.create(
        "LCS Service Report Checklist Template",
        {
            "service_type": service_type,
            "items": [
                {"checklist_item": "Zero-balance check"},
                {"checklist_item": "Load test at 50% capacity"},
                {"checklist_item": "Load test at full capacity"},
                {"checklist_item": "Calibration sticker applied"},
            ],
        },
        dedupe_filters={"name": service_type},
    )

    b.log("13. LCS Service Agreement (Active, due today, auto-create ON)")
    b.create(
        "LCS Service Agreement",
        {
            "agreement_name": f"{ZZTEST_PREFIX} Monthly Calibration Agreement",
            "status": "Active",
            "customer": customer,
            "company": company,
            "contract_start_date": add_days(today(), -30),
            "next_service_order_date": today(),
            "recurrence_type": "Interval",
            "recurrence_interval": 1,
            "recurrence_unit": "Month",
            "auto_create_service_orders": 1,
            "due_date_type": "Last Service + Interval",
            "service_type": service_type,
            "service_area": service_area,
            "priority": "Medium",
            "sites": [{"site_name": "Main Site", "address": address}],
            "equipment": [
                {
                    "equipment_description": "ZZTEST Bench Scale",
                    "serial_no": display_serial,
                    "model": display_model,
                }
            ],
        },
        dedupe_filters={
            "agreement_name": f"{ZZTEST_PREFIX} Monthly Calibration Agreement",
            "customer": customer,
        },
    )

    b.log("14. Starter Service Request (walk the rest of the lifecycle manually)")
    b.create(
        "Service Request",
        {
            "subject": f"{ZZTEST_PREFIX} Sample Service Request",
            "priority": "Medium",
            "due_date": add_days(today(), 7),
            "customer": customer,
            "company": company,
            "type": service_type,
            "currency": currency,
            "posting_date": today(),
            "status": "Open",
        },
        dedupe_filters={"subject": f"{ZZTEST_PREFIX} Sample Service Request"},
    )

    b.log(f"\nDone. {len(b.manifest)} record(s) tracked in zztest_manifest.json.")
    frappe.db.commit()
    return {"lines": b.lines, "manifest_count": len(b.manifest)}


@frappe.whitelist()
def remove_test_data():
    _require_system_manager()

    manifest = _load_manifest()
    if not manifest:
        return {
            "lines": ["Nothing tracked -- nothing to remove."],
            "manifest_count": 0,
            "locked": os.path.exists(_lock_path()),
        }

    lines = []
    remaining = list(manifest)
    for entry in reversed(manifest):
        doctype, name = entry["doctype"], entry["name"]
        try:
            if not frappe.db.exists(doctype, name):
                lines.append(f"= {doctype} '{name}' already gone, skipping")
                remaining.remove(entry)
                continue
            docstatus = frappe.db.get_value(doctype, name, "docstatus")
            if docstatus == 1:
                frappe.get_doc(doctype, name).cancel()
                lines.append(f"- cancelled {doctype} '{name}'")
            frappe.delete_doc(doctype, name, ignore_permissions=True, force=True)
            lines.append(f"- deleted {doctype} '{name}'")
            remaining.remove(entry)
        except Exception:
            frappe.log_error(title=f"ZZTEST cleanup failed: {doctype} {name}", message=frappe.get_traceback())
            lines.append(f"! FAILED to delete {doctype} '{name}' -- see Error Log")

    _save_manifest(remaining)
    locked = False
    if not remaining:
        os.remove(_manifest_path())
        with open(_lock_path(), "w") as f:
            f.write(
                f"Test data fully removed on {datetime.now().isoformat(timespec='seconds')}.\n"
                f"create_test_data will refuse to run while this file exists.\n"
                f"Use the Unlock button on the ZZTEST Data Tools page if you deliberately "
                f"want to re-seed test data.\n"
            )
        lines.append("\nAll test data removed. Site is now locked against re-seeding.")
        locked = True
    else:
        lines.append(f"\n{len(remaining)} record(s) failed to delete -- left tracked for retry.")

    frappe.db.commit()
    return {"lines": lines, "manifest_count": len(remaining), "locked": locked}


@frappe.whitelist()
def unlock():
    """Deliberate override: remove the lock so create_test_data can run again."""
    _require_system_manager()
    if os.path.exists(_lock_path()):
        os.remove(_lock_path())
        return {"lines": ["Lock removed. You can load test data again."]}
    return {"lines": ["Not locked -- nothing to do."]}