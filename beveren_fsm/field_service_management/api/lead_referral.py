import frappe
from frappe.utils import today


@frappe.whitelist(allow_guest=True)
def get_employee_list():
    """
    Returns active employees with only first/last name components.
    Called by the public Lead Referral webform dropdown.
    No PII beyond name fragments is returned.
    """
    employees = frappe.get_all(
        "Employee",
        filters={"status": "Active"},
        fields=["name", "first_name", "last_name"],
        order_by="first_name asc, last_name asc",
    )
    return employees


@frappe.whitelist()
def mark_incentive_paid(lead_name):
    """
    Called by the Lead form's 'Mark Qualified & Paid' button.
    1. Sets custom_incentive_paid and custom_incentive_paid_date
    2. Adds a timestamped note to the Lead
    3. Emails the referring employee their payout confirmation
    """
    if not frappe.has_permission("Lead", "write", lead_name):
        frappe.throw("You do not have permission to update this Lead.")

    lead = frappe.get_doc("Lead", lead_name)

    if lead.custom_incentive_paid:
        frappe.throw(f"Incentive for {lead_name} has already been recorded as paid.")

    if not lead.custom_referring_employee:
        frappe.throw("This lead has no referring employee on record.")

    paid_date = today()

    # 1. Update paid flags
    lead.db_set("custom_incentive_paid", 1, update_modified=True)
    lead.db_set("custom_incentive_paid_date", paid_date, update_modified=True)

    # 2. Resolve employee details
    emp = frappe.get_doc("Employee", lead.custom_referring_employee)
    emp_full_name = (
        emp.employee_name or
        ((emp.first_name or "") + " " + (emp.last_name or "")).strip()
    )
    emp_email = emp.company_email or emp.personal_email or ""

    referred_name = ((lead.first_name or "") + " " + (lead.last_name or "")).strip()
    referred_co   = lead.company_name or ""
    referred_city = lead.city or ""

    # 3. Add payout note to Lead
    note_text = (
        "QUALIFIED & PAID — " + paid_date + "\n\n"
        "Lead confirmed as qualified by Sales.\n"
        "Referring employee: " + emp_full_name + "\n"
        "Cash payout of $10 disbursed from petty cash.\n"
        "Recorded by: " + frappe.session.user
    )

    lead.reload()
    lead.append("notes", {
        "note": note_text,
        "added_by": frappe.session.user,
        "added_on": paid_date,
    })
    lead.save(ignore_permissions=True)

    # 4. Email employee confirmation
    if emp_email:
        frappe.sendmail(
            recipients=[emp_email],
            subject="Your LCS referral has been qualified — you've been paid!",
            message=(
                "<p>Hi " + (emp.first_name or emp_full_name) + ",</p>"
                "<p>Your referral has been reviewed by Sales and confirmed as qualified. "
                "Your <strong>$10 cash payout</strong> has been recorded and is ready at the office.</p>"
                "<table style='border-collapse:collapse;width:100%;max-width:480px;"
                "font-family:Arial,sans-serif;font-size:14px'>"
                "<tr style='background:#1B2A4A;color:#fff'>"
                "<td colspan='2' style='padding:10px 14px;font-weight:bold'>Payout Summary</td></tr>"
                "<tr style='background:#F2F4F8'>"
                "<td style='padding:8px 14px;font-weight:bold;width:40%'>Referred contact</td>"
                "<td style='padding:8px 14px'>" + referred_name + "</td></tr>"
                "<tr>"
                "<td style='padding:8px 14px;font-weight:bold'>Company</td>"
                "<td style='padding:8px 14px'>" + referred_co + (", " + referred_city if referred_city else "") + "</td></tr>"
                "<tr style='background:#F2F4F8'>"
                "<td style='padding:8px 14px;font-weight:bold'>Payout amount</td>"
                "<td style='padding:8px 14px'><strong>$10.00 cash</strong></td></tr>"
                "<tr>"
                "<td style='padding:8px 14px;font-weight:bold'>Date confirmed</td>"
                "<td style='padding:8px 14px'>" + paid_date + "</td></tr>"
                "</table>"
                "<p style='margin-top:16px;padding:12px 16px;background:#EAF3DE;"
                "border-left:4px solid #3B6D11;font-family:Arial,sans-serif;"
                "font-size:14px;color:#27500A'>"
                "Keep it going — every qualified lead earns you $10, and milestone bonuses "
                "stack at 10, 25, and 50 leads.</p>"
                "<p style='font-size:12px;color:#666;margin-top:24px'>— Left Coast Scales</p>"
            ),
            now=True,
        )

    frappe.db.commit()
    return {"status": "ok", "paid_date": paid_date, "employee": emp_full_name}