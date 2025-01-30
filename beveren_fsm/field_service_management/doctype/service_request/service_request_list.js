frappe.listview_settings["Service Request"] = {add_fields: ["status"],
	get_indicator: function (doc) {
		if (doc.status === "Open") {
			return [__("Open"), "gray", "status,=,Open"];
		} else if (doc.status === "Converted") {
			return [__("Converted"), "green", "status,=,Converted"];
		} else if (doc.status === "Due Soon") {
			return [__("Due Soon"), "Orange", "status,=,Due Soon"];
		} else if (doc.status === "Overdue") {
			return [__("Due Soon"), "Red", "status,=,Overdue"];
        } else if (doc.status === "On Hold") {
			return [__("On Hold"), "Purple", "status,=,On Hold"];
        } else if (doc.status === "Closed") {
			return [__("Closed"), "Black", "status,=,Closed"];
        }
    }
}
    //     else if (doc.advance_payment_status == "Overdue") {
	// 		return [__("To Pay"), "gray", "advance_payment_status,=,Initiated"];
	// 	} else if (flt(doc.per_received) < 100 && doc.status !== "Closed") {
	// 		if (flt(doc.per_billed) < 100) {
	// 			return [
	// 				__("To Receive and Bill"),
	// 				"orange",
	// 				"per_received,<,100|per_billed,<,100|status,!=,Closed",
	// 			];
	// 		} else {
	// 			return [__("To Receive"), "orange", "per_received,<,100|per_billed,=,100|status,!=,Closed"];
	// 		}
	// 	} else if (flt(doc.per_received) >= 100 && flt(doc.per_billed) < 100 && doc.status !== "Closed") {
	// 		return [__("To Bill"), "orange", "per_received,=,100|per_billed,<,100|status,!=,Closed"];
	// 	} else if (flt(doc.per_received) >= 100 && flt(doc.per_billed) == 100 && doc.status !== "Closed") {
	// 		return [__("Completed"), "green", "per_received,=,100|per_billed,=,100|status,!=,Closed"];
	// 	}
	// },
// 	onload: function (listview) {
// 		var method = "erpnext.buying.doctype.purchase_order.purchase_order.close_or_unclose_purchase_orders";

// 		listview.page.add_menu_item(__("Close"), function () {
// 			listview.call_for_selected_items(method, { status: "Closed" });
// 		});

// 		listview.page.add_menu_item(__("Reopen"), function () {
// 			listview.call_for_selected_items(method, { status: "Submitted" });
// 		});

// 		if (frappe.model.can_create("Purchase Invoice")) {
// 			listview.page.add_action_item(__("Purchase Invoice"), () => {
// 				erpnext.bulk_transaction_processing.create(listview, "Purchase Order", "Purchase Invoice");
// 			});
// 		}

// 		if (frappe.model.can_create("Purchase Receipt")) {
// 			listview.page.add_action_item(__("Purchase Receipt"), () => {
// 				erpnext.bulk_transaction_processing.create(listview, "Purchase Order", "Purchase Receipt");
// 			});
// 		}

// 		if (frappe.model.can_create("Payment Entry")) {
// 			listview.page.add_action_item(__("Advance Payment"), () => {
// 				erpnext.bulk_transaction_processing.create(listview, "Purchase Order", "Payment Entry");
// 			});
// 		}
// 	},
// };
