# Copyright (c) 2025, Beveren Software and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.model.mapper import get_mapped_doc


class ServiceAppointment(Document):
	def before_submit(self):
		self.set_scheduled_status()
		self.set_service_order_status()

	def validate(self):
		self.validate_items()
		self.validate_technicians()
		self.validate_crew_leader()
		self.validate_overlap()
		self.validate_resource_overlap()
		self.set_scheduled_status()

	def before_update_after_submit(self):
		self.validate_overlap()
		self.validate_resource_overlap()
		self.update_service_order_status()

	def on_cancel(self):
		self.cancel_linked_order()

	def validate_items(self):
		if not self.items:
			frappe.throw(_("Please add at least one item"))

	def validate_technicians(self):
		if not self.get("service_technicians"):
			frappe.throw(_("Please add at least one technician"))

	def validate_crew_leader(self):
		"""Enforce that at most one technician per appointment carries the Crew Leader flag."""
		leaders = [
			row for row in self.get("service_technicians")
			if row.get("custom_is_crew_leader")
		]
		if len(leaders) > 1:
			names = ", ".join(
				row.get("full_name") or row.get("service_technician") for row in leaders
			)
			frappe.throw(
				_("Only one Crew Leader is allowed per appointment. Currently flagged: {0}").format(names)
			)

	def validate_overlap(self):
		# Collect all parent Service Appointments tied to the same technicians
		child_parents = frappe.get_all(
			"Service Technician Item",
			filters={"service_technician": ["in", [d.service_technician for d in self.service_technicians]]},
			pluck="parent",
		)

		# filters = {
		# 	"name": ["!=", self.name],
		# 	"name": ["in", child_parents],
		# 	"status": ["not in", ["Closed", "Cancelled"]],
		# 	"scheduled_start_datetime": ["<", self.scheduled_finish_datetime],
		# 	"scheduled_finish_datetime": [">", self.scheduled_start_datetime],
		# }
		filters = [
			["name", "!=", self.name],
			["name", "in", child_parents],
			["status", "not in", ["Closed", "Cancelled"]],
			["scheduled_start_datetime", "<", self.scheduled_finish_datetime],
			["scheduled_finish_datetime", ">", self.scheduled_start_datetime],
		]

		overlapping_basic = frappe.get_all(
			"Service Appointment",
			filters=filters,
			fields=["name", "scheduled_start_datetime", "scheduled_finish_datetime"],
		)
		conflicting = [d for d in overlapping_basic if d.name != self.name]
		if conflicting:
			# Build a more specific error mentioning the first conflicting appointment and overlapping technicians
			self_tech_ids = {d.service_technician for d in self.service_technicians}
			first = None
			first_overlap_techs = []

			for cand in conflicting:
				cand_doc = frappe.get_doc("Service Appointment", cand.name)
				cand_tech_ids = {d.service_technician for d in cand_doc.get("service_technicians")}
				common = list(self_tech_ids.intersection(cand_tech_ids))
				if common:
					first = cand
					# Map tech ids to full names where possible
					id_to_name = {
						d.service_technician: getattr(d, "full_name", d.service_technician)
						for d in cand_doc.get("service_technicians")
					}
					first_overlap_techs = [id_to_name.get(tid, tid) for tid in common]
					break
			# Fallback: if we didn't find intersecting technicians (shouldn't happen), still throw a basic error
			if not first:
				frappe.throw(_("There is an overlap with another appointment"))
				return
			tech_list = ", ".join(first_overlap_techs) if first_overlap_techs else _("assigned technicians")
			msg = _("Overlap with appointment {apt} ({start} - {end}) for technician(s): {techs}").format(
				apt=first.name,
				start=first.scheduled_start_datetime,
				end=first.scheduled_finish_datetime,
				techs=tech_list,
			)

			frappe.throw(msg)
			return msg
		overlapping_appointments = frappe.get_all("Service Appointment", filters=filters)
		overlapping_appointments = [d.name for d in overlapping_appointments if d.name != self.name]
		if overlapping_appointments:
			print("\n\n\n OVERLAP ERROR\n\n", overlapping_appointments, "\n\n")
			error_message = _("There is an overlap with another appointment")
			print("\n\n\n OVERLAP ERROR\n\n", error_message, "\n\n")
			frappe.throw(error_message)
			return error_message  # Return for consistency

	def validate_resource_overlap(self):
		"""
		Block saving if any non-human resource on this appointment is already
		assigned to another overlapping appointment in the same time window.

		Mirrors the logic of validate_overlap() but operates on the
		appointment_resources child table (LCS Appointment Resource) instead of
		service_technicians.
		"""
		resources = self.get("appointment_resources")
		if not resources:
			return  # No resources assigned — nothing to check

		# Collect the names of all resources on this appointment
		self_resource_names = [r.resource_name for r in resources]

		# Find all Service Appointments that share at least one of these resource
		# names AND overlap this appointment's time window
		child_parents = frappe.get_all(
			"LCS Appointment Resource",
			filters={"resource_name": ["in", self_resource_names]},
			pluck="parent",
		)

		if not child_parents:
			return

		filters = [
			["name", "!=", self.name],
			["name", "in", child_parents],
			["status", "not in", ["Closed", "Cancelled"]],
			["scheduled_start_datetime", "<", self.scheduled_finish_datetime],
			["scheduled_finish_datetime", ">", self.scheduled_start_datetime],
		]

		overlapping = frappe.get_all(
			"Service Appointment",
			filters=filters,
			fields=["name", "scheduled_start_datetime", "scheduled_finish_datetime"],
		)
		conflicting = [d for d in overlapping if d.name != self.name]

		if not conflicting:
			return

		# Identify which specific resource(s) are double-booked for the first conflict
		first = conflicting[0]
		cand_doc = frappe.get_doc("Service Appointment", first.name)
		cand_resource_names = {r.resource_name for r in cand_doc.get("appointment_resources")}
		common_resources = sorted(set(self_resource_names).intersection(cand_resource_names))

		resource_list = ", ".join(common_resources) if common_resources else _("assigned resources")

		frappe.throw(
			_("Resource conflict with appointment {apt} ({start} \u2013 {end}) for: {resources}").format(
				apt=first.name,
				start=first.scheduled_start_datetime,
				end=first.scheduled_finish_datetime,
				resources=resource_list,
			)
		)

	def set_scheduled_status(self):
		if self.scheduled_start_datetime and self.scheduled_finish_datetime:
			if self.get("service_technicians") and len(self.get("service_technicians")) > 0:
				self.status = "Scheduled"
			elif self.status == "Open":
				self.status = "Scheduled"

	def set_service_order_status(self):
		if self.service_order:
			order = frappe.get_doc("Service Order", self.service_order)
			order.status = "Scheduled"
			order.save()

	def update_service_order_status(self):
		if not self.service_order:
			return

		order = frappe.get_doc("Service Order", self.service_order)
		status_mapping = {
			"Scheduled": "Scheduled",
			"Dispatched": "Dispatched",
			"In Progress": "In Progress",
			"Completed": "Review",
		}

		if self.status in status_mapping:
			order.status = status_mapping[self.status]
			order.save()

	def cancel_linked_order(self):
		if not self.service_order:
			return
		order = frappe.get_doc("Service Order", self.service_order)
		order.status = "Open"
		self.service_order = ""
		order.save()


@frappe.whitelist()
def make_appointment_from_order(source_name, target_doc=None, selected_items=None):
	mapping = {
		"Service Order": {
			"doctype": "Service Appointment",
			"field_map": {
				"name": "service_quotation",
				"party_name": "customer",
				"company": "company",
				"type": "service_type",
				"priority": "priority",
				"due_date": "due_date",
				"service_address": "customer_address",
				"cost_center": "cost_center",
				"project": "project",
				"currency": "currency",
				"serial_no": "serial_no",
				"preferred_date_1": "preferred_date_1",
				"preferred_time": "preferred_time",
				"preference_note": "preference_note",
			},
		},
		"Service Order Item": {
			"doctype": "Service Order Item",
			"field_map": {
				"item_code": "item_code",
				"description": "description",
				"qty": "qty",
				"rate": "rate",
				"amount": "amount",
				"invoice_status": "invoice_status",
			},
			"add_if_empty": True,
		},
	}
	doc = get_mapped_doc("Service Order", source_name, mapping, target_doc)
	return doc