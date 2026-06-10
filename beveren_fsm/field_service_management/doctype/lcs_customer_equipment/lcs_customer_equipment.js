frappe.ui.form.on("LCS Customer Equipment", {

    // ----------------------------------------------------------------
    // On load — set all filters for existing records
    // ----------------------------------------------------------------

    onload: function(frm) {
        lcs_ceq_set_address_filter(frm);
        lcs_ceq_set_model_filter(frm);
        lcs_ceq_set_paired_filter(frm);
    },

    refresh: function(frm) {
        lcs_ceq_set_model_filter(frm);
    },

    // ----------------------------------------------------------------
    // Customer change — clear address and re-filter
    // ----------------------------------------------------------------

    customer: function(frm) {
        frm.set_value("service_address", "");
        lcs_ceq_set_address_filter(frm);
    },

    // ----------------------------------------------------------------
    // Manufacturer change — clear model and re-filter
    // ----------------------------------------------------------------

    manufacturer: function(frm) {
        frm.set_value("scale_model", "");
        frm.set_value("capacity", "");
        frm.set_value("capacity_unit", "");
        frm.set_value("resolution", "");
        frm.set_value("resolution_unit", "");
        lcs_ceq_set_model_filter(frm);
    },

    // ----------------------------------------------------------------
    // Model change — autofill specs
    // ----------------------------------------------------------------

    scale_model: function(frm) {
        if (!frm.doc.scale_model) {
            frm.set_value("capacity", "");
            frm.set_value("capacity_unit", "");
            frm.set_value("resolution", "");
            frm.set_value("resolution_unit", "");
            return;
        }

        frappe.db.get_doc("LCS Scale Model", frm.doc.scale_model).then(doc => {
            frm.set_value("capacity", doc.capacity || "");
            frm.set_value("capacity_unit", doc.capacity_unit || "");
            frm.set_value("resolution", doc.resolution || "");
            frm.set_value("resolution_unit", doc.resolution_unit || "");
        });
    },

    // ----------------------------------------------------------------
    // Equipment type change — clear paired if switched to Unit
    // ----------------------------------------------------------------

    equipment_type: function(frm) {
        if (frm.doc.equipment_type === "Unit") {
            frm.set_value("paired_component", "");
        }
        lcs_ceq_set_paired_filter(frm);
    }

});

// ----------------------------------------------------------------
// Filter helpers
// ----------------------------------------------------------------

function lcs_ceq_set_address_filter(frm) {
    frm.set_query("service_address", function() {
        return {
            query: "frappe.contacts.doctype.address.address.address_query",
            filters: {
                link_doctype: "Customer",
                link_name: frm.doc.customer || ""
            }
        };
    });
}

function lcs_ceq_set_model_filter(frm) {
    frm.set_query("scale_model", function() {
        return {
            filters: {
                manufacturer: frm.doc.manufacturer || ""
            }
        };
    });
}

function lcs_ceq_set_paired_filter(frm) {
    const complement = frm.doc.equipment_type === "Display" ? "Base" : "Display";
    frm.set_query("paired_component", function() {
        return {
            filters: {
                customer: frm.doc.customer || "",
                equipment_type: complement,
                name: ["!=", frm.doc.name || ""]
            }
        };
    });
}