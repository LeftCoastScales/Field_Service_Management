frappe.listview_settings["Service Order"] = {
	add_fields: [
		"base_grand_total",
		"customer",
		"currency",
		"status",
		"order_type",
		"name",
	],
	get_indicator: function (doc) {
		
	},
	onload: function (listview) {

		if (frappe.model.can_create("Sales Invoice")) {
			listview.page.add_action_item(__("Sales Invoice"), () => {
				erpnext.bulk_transaction_processing.create(listview, "Service Order", "Sales Invoice");
			});
		}

		if (frappe.model.can_create("Service Appointment")) {
			listview.page.add_action_item(__("Service Appointment"), () => {
				erpnext.bulk_transaction_processing.create(listview, "Service Order", "Service Appointment");
			});
		}
	},
};
