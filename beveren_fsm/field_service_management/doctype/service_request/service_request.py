# Copyright (c) 2025, Beveren Software and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import today, add_days, getdate
from frappe import _, msgprint, qb

class ServiceRequest(Document):
	pass

@frappe.whitelist()
def address_details(customer_address):
    address_data = frappe.get_all("Address", filters={"name": customer_address}, fields=["address_line1", "address_line2", "city", "county", "state", "country", "pincode"])
    email_id = frappe.get_all("Address", filters={"name": customer_address}, fields=["email_id"])[0]["email_id"] or ''
    phone = frappe.get_all("Address", filters={"name": customer_address}, fields=["phone"])[0]["phone"] or ''
    fax = frappe.get_all("Address", filters={"name": customer_address}, fields=["fax"])[0]["fax"] or ''
    address = address_data[0]
    address_parts = [str(address[field]) for field in address if address[field]]
    address = ", ".join(address_parts)
    return {"address" : address, "email_id" : email_id, "phone" : phone, "fax" : fax}

@frappe.whitelist()
@frappe.validate_and_sanitize_search_inputs
def get_customer_contact(doctype, txt, searchfield, start, page_len, filters):
	customer = filters.get("customer")
	con = qb.DocType("Contact")
	dlink = qb.DocType("Dynamic Link")

	return (
		qb.from_(con)
		.join(dlink)
		.on(con.name == dlink.parent)
		.select(con.name, con.email_id)
		.where((dlink.link_name == customer) & (con.name.like(f"%{txt}%")))
		.run()
	)

@frappe.whitelist()
def contact_details(customer_contact):
    full_name = frappe.get_all("Contact", filters={"name": customer_contact}, fields=["first_name", "middle_name", "last_name"])
    email_id = frappe.get_all("Contact", filters={"name": customer_contact}, fields=["email_id"])[0]["email_id"] or ''
    phone = frappe.get_all("Contact", filters={"name": customer_contact}, fields=["phone"])[0]["phone"] or ''
    full_name = full_name[0]
    full_name = [str(full_name[field]) for field in full_name if full_name[field]]
    full_name = " ".join(full_name)
    return {"full_name" : full_name, "email_id" : email_id, "phone" : phone}

def update_status():
    two_days_from_now = add_days(today(), 2)
    current_date = getdate(today())

    docs_to_update_soon = frappe.get_all(
        "Service Request",
        filters={
            "due_date": two_days_from_now,
            "status": ["!=", "Due Soon"]
        },
        fields=["name"]
    )
    
    docs_to_update_overdue = frappe.get_all(
        "Service Request",
        filters={
            "due_date": ["<", current_date],
            "status": ["!=", "Overdue"]
        },
        fields=["name"]
    )
    
    for doc in docs_to_update_soon:
        document = frappe.get_doc("Service Request", doc["name"])
        document.status = "Due Soon"
        document.save()

    for doc in docs_to_update_overdue:
        document = frappe.get_doc("Service Request", doc["name"])
        document.status = "Overdue"
        document.save()

    frappe.db.commit()