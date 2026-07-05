# Copyright (c) 2026, Left Coast Scales, LLC and contributors
# For license information, please see license.txt

"""
www/tech.py

Controller for the /tech route — the LCS Field Tech PWA shell. Requires
a logged-in session (Frappe Cloud handles the login redirect for guests
automatically via no_cache + the standard portal login flow) and requires
the user to have a linked Employee record, since every whitelisted API
in field_service_management.api.tech_pwa assumes one exists.
"""

import frappe

no_cache = 1


def get_context(context):
	if frappe.session.user == "Guest":
		frappe.throw("Please log in to use the Field Tech app.", frappe.PermissionError)

	employee = frappe.db.get_value("Employee", {"user_id": frappe.session.user}, "name")
	if not employee:
		frappe.throw(
			"No Employee record is linked to your account yet. Contact the office before using the Field Tech app.",
			frappe.PermissionError,
		)

	context.no_breadcrumbs = True
	context.no_header = True
	context.employee = employee
	return context
