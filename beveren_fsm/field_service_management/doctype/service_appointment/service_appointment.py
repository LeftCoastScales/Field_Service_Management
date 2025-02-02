# Copyright (c) 2025, Beveren Software and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class ServiceAppointment(Document):
	def before_save(self):
		self.set_scheduled_status()
	def validate(self):
		self.set_scheduled_status()
		pass
	def set_scheduled_status(self):
		if self.status == "Open" and self.scheduled_start_datetime and self.scheduled_finish_datetime:
			self.status = "Scheduled"
	
		