# Copyright (c) 2025, Beveren Software and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class ServiceAppointment(Document):
	def before_save(self):
		self.set_scheduled_status()
	def validate(self):
		self.set_scheduled_status()
	def on_update_after_submit(self):
		# self.update_service_order_status()
		pass
	def set_scheduled_status(self):
		if self.status == "Open" and self.scheduled_start_datetime and self.scheduled_finish_datetime:
			self.status = "Scheduled"
	def update_service_order_status(self):
		service_order = frappe.get_doc('Service Order', self.service_order)

		# Update Service Order Status
		if self.status == "Open": service_order.status = "Appointment"
		if self.status == "Scheduled": service_order.status = "Scheduled"
		if self.status == "In Progress": service_order.status = "In Progress"
		if self.status == "Completed": service_order.status = "Completed"
		service_order.save('Update')

		