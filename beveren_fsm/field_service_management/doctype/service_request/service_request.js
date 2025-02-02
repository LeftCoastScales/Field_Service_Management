// Copyright (c) 2025, Beveren Software and contributors
// For license information, please see license.txt

frappe.ui.form.on("Service Request", {
    customer: function(frm) {
        frm.set_query("customer_address", function (doc) {
            return {
                filters: {
                    link_doctype: "Customer",
                    link_name: doc.customer,
                },
            };
        });
        frm.set_query("customer_contact", function (doc) {
			return {
				query: "beveren_fsm.field_service_management.doctype.service_request.service_request.get_customer_contact",
				filters: {
					customer: doc.customer,
				},
			};
		});
    },
	customer_address: function(frm) {
        if (frm.doc.customer_address) {
            frappe.call({
                method:"beveren_fsm.field_service_management.doctype.service_request.service_request.address_details",
                args: {"customer_address" : frm.doc.customer_address},
                callback: function(r) {
                    address = r.message["address"]
                    email_id = r.message["email_id"]
                    phone = r.message["phone"]
                    fax = r.message["fax"]
                    frm.set_value("address_details", address + "\nEmail: " + email_id + "\nPhone: " + phone + "\nFax: " + fax);
                }
            });
        }
    },
    customer_contact: function(frm){
        if (frm.doc.customer_contact) {
            frappe.call({
                method:"beveren_fsm.field_service_management.doctype.service_request.service_request.contact_details",
                args: {"customer_contact" : frm.doc.customer_contact},
                callback: function(r) {
                    full_name = r.message["full_name"]
                    email_id = r.message["email_id"]
                    phone = r.message["phone"]
                    frm.set_value("contact_details", "Name: " + full_name + "\nEmail: " + email_id + "\nPhone: " + phone);
                }
            });
        }
    },
    refresh: function (frm) {
        if (frm.doc.docstatus === 1) {
            frm.add_custom_button(__('Hold'), function () {
                frm.set_value('status', 'On Hold');
                frm.save('Submit')
            }, __('Status'));
            frm.add_custom_button(__('Close'), function () {
                frm.set_value('status', 'Closed');
                frm.save('Submit')
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
