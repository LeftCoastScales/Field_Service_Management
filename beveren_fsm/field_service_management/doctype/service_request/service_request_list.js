// frappe.listview_settings["Service Request"] = {
// 	add_fields: ["status"],
// 	get_indicator: function (doc) {
// 		if (doc.status === "Open") {
// 			return [__("Open"), "gray", "status,=,Open"];
// 		} else if (doc.status === "Converted") {
// 			return [__("Converted"), "green", "status,=,Converted"];
// 		} else if (doc.status === "Due Soon") {
// 			return [__("Due Soon"), "orange", "status,=,Due Soon"];
// 		} else if (doc.status === "Overdue") {
// 			return [__("Overdue"), "red", "status,=,Overdue"];
//         } else if (doc.status === "On Hold") {
// 			return [__("On Hold"), "purple", "status,=,On Hold"];
//         } else if (doc.status === "Closed") {
// 			return [__("Closed"), "black", "status,=,Closed"];
//         }
//     }
// }
