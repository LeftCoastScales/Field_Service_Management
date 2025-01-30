# Copyright (c) 2025, Beveren Software and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class ServiceRequest(Document):
	pass

@frappe.whitelist()
def address_and_contact_details(customer_address):
    address_data = frappe.get_all("Address", filters={"name": customer_address}, fields=["address_line1", "address_line2", "city", "county", "state", "country", "pincode"])
    email_id = frappe.get_all("Address", filters={"name": customer_address}, fields=["email_id"])[0]["email_id"] or ''
    phone = frappe.get_all("Address", filters={"name": customer_address}, fields=["phone"])[0]["phone"] or ''
    fax = frappe.get_all("Address", filters={"name": customer_address}, fields=["fax"])[0]["fax"] or ''
    address = address_data[0]
    address_parts = [str(address[field]) for field in address if address[field]]
    address = ", ".join(address_parts)
    return {"address" : address, "email_id" : email_id, "phone" : phone, "fax" : fax}
