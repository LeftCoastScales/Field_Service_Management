// Copyright (c) 2025, Beveren Software and contributors
// For license information, please see license.txt

frappe.ui.form.on("Service Request", {
    onload: function(frm) {
        //frm.doc.status = "Overdue"
    },
	customer: function(frm) {
        if (frm.doc.customer_address) {
            frappe.call({
                method:"beveren_fsm.field_service_management.doctype.service_request.service_request.address_and_contact_details",
                args: {"customer_address" : frm.doc.customer_address},
                callback: function(r) {
                    address = r.message["address"]
                    email_id = r.message["email_id"]
                    phone = r.message["phone"]
                    fax = r.message["fax"]
                    frm.set_value("address_details", address);
                    frm.set_value("email_id", email_id);
                    frm.set_value("phone", phone);
                    frm.set_value("fax", fax);
                }
            });
        }
    },
    refresh: function (frm) {
        if (frm.doc.docstatus === 1) {
            frm.add_custom_button(__('Hold'), function () {
                frm.set_value('status', 'On Hold');
                frm.save()
            }, __('Status'));
            frm.add_custom_button(__('Close'), function () {
                frm.set_value('status', 'Closed');
                frm.save()
            }, __('Status'));
            frm.add_custom_button(__('Create Service Order'), function () {
                frm.doc.status = "Converted"
                frm.save('Submit');
                frappe.new_doc('Service Order', {
                    service_request: frm.doc.name,
                    customer: frm.doc.customer,
                    due_date: frm.doc.due_date
                });
            }, __('Actions'));
        }
    }
});
