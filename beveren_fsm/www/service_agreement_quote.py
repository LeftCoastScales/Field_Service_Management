# beveren_fsm/field_service_management/www/service-agreement-quote.py
#
# Controller for the LCS Service Agreement Quote web page.
# Route: /service-agreement-quote
#
# Requires login — only LCS staff should access this page.
# Frappe serves this alongside service-agreement-quote.html automatically.

import frappe


def get_context(context):
    # Enforce authentication — redirect to login if not logged in
    if frappe.session.user == "Guest":
        frappe.local.flags.redirect_location = "/login?redirect-to=/service-agreement-quote"
        raise frappe.Redirect

    context.no_cache = 1
    context.show_sidebar = False
    context.title = "LCS Service Agreement Quote"

    # Pass the current user's full name and email to the template
    # so the form can pre-fill the Sales Rep field
    user = frappe.get_doc("User", frappe.session.user)
    context.sales_rep_name = user.full_name or frappe.session.user
    context.sales_rep_email = user.email or ""

    # Pre-populate today's date and default valid-until (30 days)
    from frappe.utils import today, add_days, getdate
    context.today = today()
    context.valid_until = add_days(today(), 30)

    # Default rate schedule values — these match what the DocType shows
    context.default_rate_regular = 115.00
    context.default_rate_overtime = 172.50
    context.default_rate_holiday = 230.00

    # LCS standard terms (matches the pre-populated text in the DocType)
    context.default_terms = (
        "Left Coast Scales will inspect and test with certified weights and standards all assets "
        "listed above, according to the schedule stated above.\n"
        "All units will be tested with approved standards in accordance with NIST Handbook 44 "
        "tolerances set forth by the National Institute of Standards and Technology.\n"
        "Upon completion of all 'as found' and 'as left' conditions of your assets will be "
        "provided after the completion of inspection. All reports and certifications are stored "
        "digitally for future reference.\n"
        "Any additional services required that are beyond the scope mentioned above, including "
        "repairs, parts, installation, and labor, will be performed with your authorization at "
        "our agreed-upon labor rates. A certified and trained technician will perform all work.\n"
        "Emergency service will be billed using the enclosed rate schedule. This includes "
        "mechanic time, travel time, and mileage.\n"
        "This agreement will renew automatically at the end of the duration listed. A written "
        "notice is required to terminate this service agreement, and must be sent to us at least "
        "30 days prior to the next scheduled service."
    )
