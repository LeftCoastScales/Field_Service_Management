# Copyright (c) 2025, Beveren Software and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import now_datetime


class ServiceReport(Document):
	def validate(self):
		self._populate_checklist_from_template()

	def on_submit(self):
		self._assert_checklist_complete()
		if not self.submitted_at:
			self.submitted_at = now_datetime()
		if not self.submitted_by:
			self.submitted_by = _service_technician_for_session_user()

	def _populate_checklist_from_template(self):
		"""
		First save only: if the checklist table is still empty, copy the
		default item list from the template matching this appointment's
		Service Order's Service Type. Later edits (adding/removing rows,
		or a Service Type with no template at all) are left alone —
		this only ever fills in an empty table, never overwrites one
		already in progress.
		"""
		if self.checklist:
			return
		if not self.service_order:
			return

		service_type = frappe.db.get_value("Service Order", self.service_order, "type")
		if not service_type or not frappe.db.exists("LCS Service Report Checklist Template", service_type):
			return

		template = frappe.get_doc("LCS Service Report Checklist Template", service_type)
		for item in template.items:
			self.append("checklist", {"checklist_item": item.item_text})

	def _assert_checklist_complete(self):
		unanswered = [row for row in self.checklist if not row.response]
		if unanswered:
			frappe.throw(
				_("Every checklist item needs a response (Pass / Fail / N/A) before this report can be submitted.")
			)


def _service_technician_for_session_user() -> str | None:
	employee = frappe.db.get_value("Employee", {"user_id": frappe.session.user}, "name")
	if not employee:
		return None
	return frappe.db.get_value("Service Technician", {"employee": employee}, "name")
