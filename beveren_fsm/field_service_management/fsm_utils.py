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

		
		# TODO: Check and update for either service order or appointment as well
		'''
		if the invoice is created from a service order, we should check if there is any appointment 
		linked to the service order, if yes, we should update the invoice status of the items in the
		appointment to 'Invoiced'
		'''

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
		frappe.msgprint(f"Updated invoice status for item <strong>{item_code}</strong> in <strong>{reference_doctype}</strong> {reference_docname}")
		
		
			
	