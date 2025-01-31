# Copyright (c) 2025, Beveren Software and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class ServiceOrder(Document):
	@frappe.whitelist()
	def create_appointment(self, service_order):
		appointment = frappe.new_doc("Service Appointment")
		appointment.service_order = service_order
		appointment.customer = self.customer

		for service in self.services:  
			appointment.append("services", {
				"item_code": service.item_code,
				"qty": service.qty, 
				"rate": service.rate,
				"amount": service.amount
			})
		for parts in self.parts:  
			appointment.append("parts", {
				"item_code": parts.item_code,
				"qty": parts.qty,  
				"rate": parts.rate,
				"amount": parts.amount
			})
		
		self.update_status()
		appointment.insert()


		return appointment.name

	def update_status(self):
		self.status = "Appointment"

	def create_invoice(self):
		#TODO: Implement this
		pass
