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
				filters: {
                    link_doctype: "Customer",
                    link_name: doc.customer,
				},
			};
		});
    },
	customer_address: function(frm) {
        if (frm.doc.customer_address) {
            frappe.call({
                method:"beveren_fsm.field_service_management.utils.address_util.get_address_details",
                args: {"customer_address" : frm.doc.customer_address},
                callback: function(r) {
                    let details = r.message["details"] || "";
                    frm.set_value("address_details", details);
                }
            });
        }
    },
    customer_contact: function(frm) {
        if (frm.doc.customer_contact) {
            frappe.call({
                method: "beveren_fsm.field_service_management.utils.address_util.get_contact_details",
                args: {"customer_contact": frm.doc.customer_contact},
                callback: function(r) {
                    let details = r.message["details"] || "";
                    frm.set_value("contact_details", details);
                }
            });
        }
    },

    refresh: function (frm) {
        if (frm.doc.docstatus === 1) {
            if (frm.doc.status === "On Hold") {
                frm.add_custom_button(__('Resume'), function () {
                    frm.set_value('status', 'Open');
                    frm.save('Submit');
                }, __('Status'));
            } else {
                frm.add_custom_button(__('Hold'), function () {
                    frm.set_value('status', 'On Hold');
                    frm.save('Submit');
                }, __('Status'));
            }
            if (frm.doc.status === "Closed") {
                frm.add_custom_button(__('Reopen'), function () {
                    frm.set_value('status', 'Open');
                    frm.save('Submit');
                    frm.remove_custom_button('Create');
                }, __('Status'));
            } else {
                frm.add_custom_button(__('Close'), function () {
                    frm.set_value('status', 'Closed');
                    frm.save('Submit');
                    frm.remove_custom_button('Create');
                }, __('Status'));
            }
            frm.add_custom_button(__('Create Service Order'), function () {
                frm.set_value('status', 'Converted');
                frm.save('Submit').then(() => {
                    frappe.new_doc('Service Order', {
                        service_request: frm.doc.name,
                        customer: frm.doc.customer,
                        due_date: frm.doc.due_date
                    });
                });
            }, __('Create'));
        }
    }
});

