// Copyright (c) 2025, Beveren Software and contributors
// For license information, please see license.txt

frappe.ui.form.on("Service Appointment", {
	onload: function(frm) {
		// Show dialogue to complete the appointment if scheduled datetime is not set
		if (!frm.doc.scheduled_start_datetime && route_options.hasOwnProperty('source') 
			&& route_options.source === "Service Order") {
			frappe.msgprint(__("Fill out Missing Fields in this Appointment."));
		}
	},
	refresh(frm) {
		frm.trigger('add_actions_items');
		frm.trigger('disable_schedule_fields_on_submit');
	},
	disable_schedule_fields_on_submit: frm => {
		if (frm.doc.docstatus == 1) {
			frm.set_df_property('scheduled_start_datetime', 'read_only', 1);
			frm.set_df_property('scheduled_finish_datetime', 'read_only', 1);
		}
	},
	add_actions_items: frm => {
		if (frm.doc.status == 'Open' && frm.doc.docstatus == 1) {
			frm.page.add_action_item(__('Schedule'), function() {
				frm.trigger('schedule_appointment');
			});
			frm.page.add_action_item(__('Schedule and Dispatch'), function() {
				frm.trigger('schedule_and_dispatch_appointment');
			});
			frm.page.add_action_item(__('Invoice'), function() {
				frm.trigger('invoice_appointment');
			});
		}

		if (frm.doc.status == 'Scheduled' && frm.doc.docstatus == 1) {
			frm.page.add_action_item(__('Reschedule'), function() {
				frm.trigger('schedule_appointment');
			});
			frm.page.add_action_item(__('Invoice'), function() {
				frm.trigger('invoice_appointment');
			});
			frm.page.add_action_item(__('Dispatch'), function() {
				frm.trigger('dispatch_appointment');
			});
		}
		if (frm.doc.status == 'Dispatched' && frm.doc.docstatus == 1) {
			frm.page.add_action_item(__('Start Work'), function() {
				frm.trigger('start_work');
			});
			frm.page.add_action_item(__('Invoice'), function() {
				frm.trigger('invoice_appointment');
			});
		}
		if (frm.doc.status == 'In Progress' && frm.doc.docstatus == 1) {
			frm.page.add_action_item(__('Complete'), function() {
				frm.trigger('complete_work');
			});
			frm.page.add_action_item(__('Invoice'), function() {
				frm.trigger('invoice_appointment');
			});
		}
		if (frm.doc.status == 'Completed' && frm.doc.docstatus == 1) {
			frm.page.add_action_item(__('Invoice'), function() {
				frm.trigger('invoice_appointment');
			});
		}
	},
	invoice_appointment: frm => {
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
			title: __("Select Services and Parts to Invoice"),
			fields: [
				{
					fieldname: "service_items",
					fieldtype: "Table",
					label: __("Service Team"),
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
	schedule_appointment: frm => {
		prompt_title = frm.doc.status == 'Scheduled' ? 'Reschedule Appointment' : 'Schedule Appointment';
		primary_action_label = frm.doc.status == 'Scheduled' ? 'Reschedule' : 'Schedule';
		frappe.prompt([
			{
				label: 'Scheduled Start Datetime',
				fieldname: 'scheduled_start_datetime',
				fieldtype: 'Datetime'
			},
			{
				fieldname: "column_break_appointment",
				fieldtype: "Column Break"
			},
			{
				label: 'Scheduled Finish Datetime',
				fieldname: 'scheduled_finish_datetime',
				fieldtype: 'Datetime'
			},
		], (values) => {
			// Schedule
			frappe.model.set_value(frm.doctype, frm.docname, 'scheduled_start_datetime', values.scheduled_start_datetime);
			frappe.model.set_value(frm.doctype, frm.docname, 'scheduled_finish_datetime', values.scheduled_finish_datetime);
			frm.set_value('status', 'Scheduled');
			frm.save('Update');
		}, prompt_title, primary_action_label);
		
	},
	dispatch_appointment: frm => {
		const dialog = new frappe.ui.Dialog({
			title: __("Dispatch"),
			fields: [
				{
					fieldname: "service_technician_item",
					fieldtype: "Table",
					label: __("Service Team"),
					options: "Service Technician Item",
					in_place_edit: true,
					reqd: 1,
					fields: [
						{
							fieldname: "service_technician",
							label: __("Service Technician"),
							fieldtype: "Link",
							options: "Service Technician",
							reqd: 1,
							in_list_view: 1,
						}
					]
				}
			],
			primary_action: (values) => {
				// Dispatch
				let items = values.service_technician_item;
				let new_row = frm.add_child("service_technicians");
				items.forEach(item => {
					frappe.model.set_value(new_row.doctype, new_row.name, "service_technician", item.service_technician);
				});
				frm.set_value('status', 'Dispatched');
				frm.save('Update');
				
				dialog.hide();
			},
			primary_action_label: __("Dispatch"),
		  	});
		  	dialog.show();
	},
	schedule_and_dispatch_appointment: frm => {
		const dialog = new frappe.ui.Dialog({
			title: __("Schedule and Dispatch"),
			fields: [
				{
					label: 'Scheduled Start Datetime',
					fieldname: 'scheduled_start_datetime',
					fieldtype: 'Datetime'
				},
				{
					fieldname: "column_break_appointment",
					fieldtype: "Column Break"
				},
				{
					label: 'Scheduled Finish Datetime',
					fieldname: 'scheduled_finish_datetime',
					fieldtype: 'Datetime'
				},
				{
					fieldname: "section_break_appointment",
					fieldtype: "Section Break"
				},
				{
					fieldname: "service_technician_item",
					fieldtype: "Table",
					label: __("Service Team"),
					options: "Service Technician Item",
					in_place_edit: true,
					reqd: 1,
					fields: [
						{
							fieldname: "service_technician",
							label: __("Service Technician"),
							fieldtype: "Link",
							options: "Service Technician",
							reqd: 1,
							in_list_view: 1,
						}
					]
				}
			],
			primary_action: (values) => {
				// Schedule
				frappe.model.set_value(frm.doctype, frm.docname, 'scheduled_start_datetime', values.scheduled_start_datetime);
				frappe.model.set_value(frm.doctype, frm.docname, 'scheduled_finish_datetime', values.scheduled_finish_datetime);

				// Dispatch
				let items = values.service_technician_item;
				let new_row = frm.add_child("service_technicians");
				items.forEach(item => {
					frappe.model.set_value(new_row.doctype, new_row.name, "service_technician", item.service_technician);
				});
				frm.set_value('status', 'Dispatched');
				frm.save('Update');

				dialog.hide();
			},
			primary_action_label: __("Schedule and Dispatch"),
		  });
		  dialog.show();
	},
	start_work: frm => {
		// Set actual start datetime
		frm.set_value('actual_start_datetime', frappe.datetime.now_datetime());
		frm.set_value('status', 'In Progress');
		frm.save('Update');
	},
	complete_work: frm => {
		// Set actual finish datetime
		frm.set_value('actual_finish_datetime', frappe.datetime.now_datetime());

		frm.set_value('status', 'Completed');
		frm.save('Update');
	},
	
});
