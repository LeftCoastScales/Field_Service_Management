frappe.ui.form.on("LCS Customer Equipment", {

    // When customer changes, clear service_address and re-apply filter
    customer: function(frm) {
        frm.set_value("service_address", "");
        frm.set_query("service_address", function() {
            return {
                query: "frappe.contacts.doctype.address.address.address_query",
                filters: {
                    link_doctype: "Customer",
                    link_name: frm.doc.customer
                }
            };
        });
    },

    // Apply filter on form load so it works on existing records too
    onload: function(frm) {
        frm.set_query("service_address", function() {
            return {
                query: "frappe.contacts.doctype.address.address.address_query",
                filters: {
                    link_doctype: "Customer",
                    link_name: frm.doc.customer
                }
            };
        });
    }

});