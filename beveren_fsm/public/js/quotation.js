// Copyright (c) 2026, Left Coast Scales
// For license information, please see license.txt
//
// CRM bridge for sales-originated service work: adds a "Service Order"
// option to the standard ERPNext Quotation's Create menu, alongside the
// existing "Sales Order" option. Covers the second way service work
// gets generated at LCS -- from Sales, as a new Service Agreement,
// quoted repair, or installation -- as opposed to the customer-call /
// Service Request path (Service Request -> Service Quotation ->
// Service Order).
//
// Injected into the core Quotation form via the doctype_js hook (see
// hooks.py: doctype_js = {"Quotation": "public/js/quotation.js"}) so it
// loads alongside ERPNext's own Quotation client script without
// modifying any ERPNext core files.

frappe.ui.form.on("Quotation", {
  refresh: function (frm) {
    // Only offer this once the Quotation is submitted (mirrors how
    // "Sales Order" only appears post-submit), and not once it's been
    // marked Lost.
    if (frm.doc.docstatus !== 1) return;
    if (frm.doc.status === "Lost") return;

    frm.add_custom_button(
      __("Service Order"),
      () => {
        frappe.model.open_mapped_doc({
          method:
            "beveren_fsm.field_service_management.fsm_utils.make_service_order_from_quotation",
          frm: frm,
        });
      },
      __("Create")
    );
  },
});
