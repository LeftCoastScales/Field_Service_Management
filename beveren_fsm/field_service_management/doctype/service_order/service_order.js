frappe.provide('beveren_fsm.field_management_system');

beveren_fsm.field_management_system.ServiceOrder = class ServiceOrder {
	constructor(opts) {
		$.extend(this, opts);
		this.setup();
	}

	setup() {
		this.items_field = "items";
		this.tax_field = "taxes";
		this.bind_events();
	}

	bind_events() {
		// Bind to item table changes
		frappe.ui.form.on(this.frm.doctype + " Item", {
			items_add: () => this.calculate_totals(),
			items_remove: () => this.calculate_totals(),
			qty: () => this.calculate_totals(),
			rate: () => this.calculate_totals(),
			item_code: () => this.calculate_totals()
		});

		// Bind to tax table changes
		frappe.ui.form.on(this.frm.doctype + " Tax", {
			taxes_add: () => this.calculate_totals(),
			taxes_remove: () => this.calculate_totals(),
			rate: () => this.calculate_totals(),
			tax_amount: () => this.calculate_totals()
		});
	}

	calculate_totals() {
		this.calculate_item_values();
		this.calculate_taxes();
		this.calculate_grand_total();
		this.frm.refresh_fields();
	}

	calculate_item_values() {
		const items = this.frm.doc[this.items_field] || [];
		let total = 0;

		items.forEach(item => {
			item.amount = flt(item.qty * item.rate);
			item.net_amount = item.amount;
			total += item.amount;
		});

		this.frm.doc.total = total;
		this.frm.doc.net_total = total;
	}

	calculate_taxes() {
		const me = this;
		const items = this.frm.doc[this.items_field] || [];
		const taxes = this.frm.doc[this.tax_field] || [];

		// Reset tax amounts
		taxes.forEach(tax => {
			tax.tax_amount = 0;
			tax.total = 0;
		});

		// Calculate tax for each item
		items.forEach(item => {
			taxes.forEach(tax => {
				if (tax.charge_type === "On Net Total") {
					tax.tax_amount += (item.net_amount * tax.rate) / 100;
				}
			});
		});

		// Update tax totals
		let grand_total = this.frm.doc.net_total;
		taxes.forEach(tax => {
			tax.total = grand_total;
			grand_total += tax.tax_amount;
		});
	}

	calculate_grand_total() {
		const taxes = this.frm.doc[this.tax_field] || [];
		let grand_total = this.frm.doc.net_total;
		let total_taxes = 0;

		taxes.forEach(tax => {
			total_taxes += tax.tax_amount;
		});

		this.frm.doc.total_taxes = total_taxes;
		this.frm.doc.grand_total = grand_total + total_taxes;
		this.frm.doc.rounded_total = Math.round(this.frm.doc.grand_total);
	}
}

frappe.ui.form.on('Service Order', {
	setup(frm) {
		frm.service_order = new beveren_fsm.field_management_system.ServiceOrder({frm: frm});
	},
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
	refresh(frm) {
		frm.service_order.calculate_totals();
		if (frm.doc.docstatus == 1) {
			frm.trigger("add_actions_button");
		}
		if(frm.doc.status == 'Open'){
			frm.add_custom_button(
				__("Hold"),
				() => frappe.msgprint('Coming Soon!'),
				__("Status")
			);
			frm.add_custom_button(
				__("Complete"),
				() => frappe.msgprint('Coming Soon!'),
				__("Status")
			);
		}
	},

	validate(frm) {
		frm.service_order.calculate_totals();
	},
	// Add new handler for taxes_and_charges
	taxes_and_charges: function(frm) {
		if(frm.doc.taxes_and_charges) {
			frappe.call({
				method: 'erpnext.controllers.accounts_controller.get_taxes_and_charges',
				args: {
					"master_doctype": "Sales Taxes and Charges Template",
					"master_name": frm.doc.taxes_and_charges
				},
				callback: function(r) {
					if(!r.exc) {
						frm.clear_table("taxes");
						for(var i=0; i<r.message.length; i++) {
							var d = frm.add_child("taxes");
							$.extend(d, r.message[i]);
						}
						frm.refresh_field("taxes");
						frm.service_order.calculate_totals();
					}
				}
			});
		}
	},
	add_actions_button: (frm) => {
		frm.page.add_action_item(__(" Create Appointment"), function () {
			frm.trigger("create_appointment");
		});

		frm.page.add_action_item(__("Create Invoice"), function () {
			frm.trigger("create_service_invoice");
		});

	},
	create_appointment: (frm) => {
		if (frm.doc.docstatus == 1) {
			frappe.call({
				method: "create_appointment",
				doc: frm.doc,
				args: {
					service_order: frm.doc.name,
				},
				callback: function (r) {
					if (r.message) {
						route_options = { source: "Service Order" };
						frappe.set_route("Form", "Service Appointment", r.message);
					}
				},
			});
		}
	},
	create_service_invoice: (frm) => {
		// Fetch all parts and services which are not invoiced
		let items = frm.doc.items || [];
		let non_invoiced_items = [];
		items.forEach((item) => {
			if (item.invoice_status != "Invoiced") {
				non_invoiced_items.push(item);
			}
		});
		if (non_invoiced_items.length == 0) {
			frappe.msgprint("This Appointment is already fully Invoiced.");
			return;
		}
		function mergeDuplicates(items) {
			let mergedItems = items.reduce((acc, item) => {
				let existingItem = acc.find((i) => i.item_code === item.item_code);
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
						},
					],
				},
			],
			primary_action: (values) => {
				// Create Invoice
				frappe.call({
					method:
						"beveren_fsm.field_service_management.fsm_utils.create_service_invoice",
					args: {
						doctype: frm.doc.doctype,
						docname: frm.doc.name,
						customer: frm.doc.customer,
						items: values.service_items,
					},
					callback: function (r) {
						if (r.message) {
							// Route to Sales Invoice
							frappe.set_route("Form", "Sales Invoice", r.message);
						}
					},
				});

				dialog.hide();
			},
			primary_action_label: __("Create Invoice"),
			secondary_action: () => {
				dialog.hide();
			},
			secondary_action_label: __("Cancel"),
		});

		// Prefill the table with non-invoiced items
		let tableField = dialog.get_field("service_items");
		tableField.df.data = non_invoiced_items;
		tableField.grid.refresh();

		dialog.show();
	},
});