import frappe
import json

@frappe.whitelist()
def create_service_invoice(doctype, docname, customer, items=[]):
	items = json.loads(items)
	invoice = frappe.new_doc("Sales Invoice")
	invoice.customer = customer
	invoice.due_date = frappe.utils.nowdate()
	invoice.custom_reference_service_doctype = doctype
	invoice.custom_reference_service_document = docname
	for item in items:
		invoice.append("items", {
			"item_code": item["item_code"],
			"qty": item["qty"],
			"rate": item["rate"],
			"amount": item["amount"]
		})
	invoice.insert()
	return invoice.name


def update_invoice_status(doc, method):
	'''
	This called when a Sales Invoice is submitted or cancelled.
	if the invoice is submitted, updates service items' invoice_status to 'Invoiced'
	if the invoice is cancelled, updates service items' invoice_status to 'Not Invoiced'
	'''
	if not doc.custom_reference_service_doctype or not doc.custom_reference_service_document:
		return
	
	items = frappe.get_all("Sales Invoice Item", filters={"parent": doc.name}, fields=["item_code"])
	reference_doctype = doc.custom_reference_service_doctype
	reference_docname = doc.custom_reference_service_document
	service_doc = frappe.get_doc(reference_doctype, reference_docname)

	child_tables = ["parts", "services"]
	updated = False
	for item in items:
		item_code = item.item_code

		for table in child_tables:
			if not hasattr(service_doc, table):
				frappe.throw(f"No '{table}' child table found in {reference_doctype}")

			for row in getattr(service_doc, table):
				if row.item_code == item_code:
					if method == "on_submit":
						row.invoice_status = 'Invoiced'
					elif method == "on_cancel":
						row.invoice_status = 'Not Invoiced'
					updated = True

	if updated:
		service_doc.save()
		frappe.msgprint(f"Updated invoice status for<strong>Services and Parts</strong> in <strong>{reference_doctype}</strong> {reference_docname}")

	# Update Invoice Status for Associated Service Order or Appointment
	update_service_order_or_appointment_invoice_status(doc, method)

def update_service_order_or_appointment_invoice_status(doc, method):
	'''
		If the Invoicing does not happen at Service Order level, 
		this function can be used to update the invoice status of the service items in the Service Order
		when the Appointment is invoiced. And VICE VERSA
	'''
	if not doc.custom_reference_service_doctype or not doc.custom_reference_service_document:
		return

	# Source document
	source_doc = frappe.get_doc(doc.custom_reference_service_doctype, doc.custom_reference_service_document)
	source_services = source_doc.get("services", [])
	source_parts = source_doc.get("parts", [])

	# Target doctype
	doctypes = ["Service Order", "Service Appointment"]
	target_doctype = list(set(doctypes) - {doc.custom_reference_service_doctype})[0]

	# Target document names
	if target_doctype == "Service Order":
		target_docnames = [source_doc.service_order]
	elif target_doctype == "Service Appointment":
		target_docnames = frappe.get_all(target_doctype, filters={"service_order": source_doc.name}, pluck="name")

	# If the source is a Service Appointment, update similar appointments
	if doc.custom_reference_service_doctype == "Service Appointment":
		similar_appointments = frappe.get_all(
			source_doc.doctype,
			filters={"service_order": source_doc.service_order, "name": ["!=", source_doc.name]},
			pluck="name"
		)
		for appointment_name in similar_appointments:
			update_target_documents(source_doc.doctype, appointment_name, source_services, source_parts)

	# Update target documents
	for docname in target_docnames:
		update_target_documents(target_doctype, docname, source_services, source_parts)

def update_target_documents(target_doctype, target_docname, source_services, source_parts):
	'''
	Update the invoice status of services and parts in the target document based on the source document.
	'''
	# Initialize flags
	services_updated = False
	parts_updated = False

	# Fetch the target document
	doc = frappe.get_doc(target_doctype, target_docname)

	# Create dictionaries for quick lookup
	doc_services = {row.item_code: row for row in doc.get("services", [])}
	doc_parts = {row.item_code: row for row in doc.get("parts", [])}

	# Update services
	for service in source_services:
		if service.item_code in doc_services:
			doc_services[service.item_code].invoice_status = service.invoice_status
			services_updated = True

	# Update parts
	for part in source_parts:
		if part.item_code in doc_parts:
			doc_parts[part.item_code].invoice_status = part.invoice_status
			parts_updated = True

	# Save the document if updates were made
	if services_updated or parts_updated:
		doc.save()
		frappe.msgprint(f"Updated invoice status for <strong>Services and Parts</strong> in <strong>{target_doctype}</strong> {target_docname}")