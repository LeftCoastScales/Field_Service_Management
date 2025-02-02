// Copyright (c) 2025, Beveren Software and contributors
// For license information, please see license.txt

frappe.ui.form.on("Service Order", {
	refresh(frm) {
		frm.trigger('filter_services');
		frm.trigger('filter_parts');

		if (frm.doc.docstatus == 1) {
			frm.trigger('add_actions_button');
		}
	},
	filter_services: frm => {
		frm.fields_dict["services"].grid.get_field("item_code").get_query = function(doc, cdt, cdn) {
            return {
                filters: {
                    "item_group": "Services"
                }
            };
        };
	},
	filter_parts: frm => {
		frm.fields_dict["parts"].grid.get_field("item_code").get_query = function(doc, cdt, cdn) {
            return {
                filters: {
                    "item_group": "Products"
                }
            };
        };
	},
	add_actions_button: frm => {
		frm.page.add_action_item(__(' Create Appointment'), function() {
			frm.trigger('create_appointment');
		});

		frm.page.add_action_item(__('Create Invoice'), function() {
			frm.trigger('create_service_invoice');
		});
	},
	create_appointment: frm => {
		if(frm.doc.docstatus == 1) {
			frappe.call({
				method: "create_appointment",
				doc: frm.doc,
				args: {
					service_order: frm.doc.name,
				},
				callback: function(r) {
					if (r.message) {
						route_options = {"source": "Service Order"};
						frappe.set_route("Form", "Service Appointment", r.message);
					}
				}
			})
		}
	},
	create_service_invoice: frm => {
		// Fetch all parts and services which are not invoiced
		let parts = frm.doc.parts || [];
		let services = frm.doc.services || [];
		let non_invoiced_items = [];
		parts.forEach(item => {
			if (item.invoice_status != 'Invoiced') {
				non_invoiced_items.push(item);
			}
		});
		services.forEach(service => {
			if (service.invoice_status != 'Invoiced') {
				non_invoiced_items.push(service);
			}
		});
		if (non_invoiced_items.length == 0) {
			frappe.msgprint("This Appointment is already fully Invoiced.");
			return;
		}
		function mergeDuplicates(items) {
			let mergedItems = items.reduce((acc, item) => {
				let existingItem = acc.find(i => i.item_code === item.item_code);
				if (existingItem) {
					existingItem.qty += item.qty; 
				} else {
					acc.push({ ...item }); 
				}
				return acc;
			}, []);
		
			return mergedItems;
		}
		non_invoiced_items = mergeDuplicates(non_invoiced_items);
		
		const dialog = new frappe.ui.Dialog({
			title: __("Services and Parts to Invoice"),
			fields: [
				{
					fieldname: "service_items",
					fieldtype: "Table",
					label: __("Services and Parts"),
					options: "Services and Parts",
					in_place_edit: true,
					reqd: 1,
					fields: [
						{
							fieldname: "item_code",
							label: __("Item Code"),
							fieldtype: "Link",
							options: "Item",
							in_list_view: 1,
						},
						{
							fieldname: "item_name",
							label: __("Item Name"),
							fieldtype: "Data",
							in_list_view: 1,
						},
						{
							fieldname: "qty",
							label: __("Quantity"),
							fieldtype: "Int",
							in_list_view: 1,
						},
						{
							fieldname: "amount",
							label: __("Amount"),
							fieldtype: "Currency",
							in_list_view: 1,
						}
					]
				}
			],
			primary_action: (values) => {
				// Create Invoice
				frappe.call({
					method: "beveren_fsm.field_service_management.fsm_utils.create_service_invoice",
					args: {
						doctype: frm.doc.doctype,
						docname: frm.doc.name,
						customer: frm.doc.customer,
						items: values.service_items
					},
					callback: function(r) {
						if (r.message) {
							// Route to Sales Invoice
							frappe.set_route("Form", "Sales Invoice", r.message);
						}
					}
				})
				
				dialog.hide();
			},
			primary_action_label: __("Create Invoice"),
			secondary_action: () => { dialog.hide(); }, 
			secondary_action_label: __("Cancel"),
				});
			

			// Prefill the table with non-invoiced items
			let tableField = dialog.get_field("service_items");
			tableField.df.data = non_invoiced_items;
			tableField.grid.refresh();

			dialog.show();
	},
	
});


frappe.ui.form.on("Service Order Item", {
	item_code: function (frm, cdt, cdn) {
		var row = locals[cdt][cdn];
		if (frm.doc.delivery_date) {
			row.delivery_date = frm.doc.delivery_date;
			refresh_field("delivery_date", cdn, "items");
		} else {
			frm.script_manager.copy_from_first_row("items", row, ["delivery_date"]);
		}
	},
	delivery_date: function (frm, cdt, cdn) {
		if (!frm.doc.delivery_date) {
			erpnext.utils.copy_value_in_all_rows(frm.doc, cdt, cdn, "items", "delivery_date");
		}
	},
	rate: function(frm, cdt, cdn) {		
        var row = locals[cdt][cdn];
		var amount = row.rate * row.qty;
		frappe.model.set_value(cdt, cdn, "amount", amount);
    },
    qty: function(frm, cdt, cdn) {
        var row = locals[cdt][cdn];
		var amount = row.rate * row.qty;
		frappe.model.set_value(cdt, cdn, "amount", amount);
    },
	
});

