frappe.ui.form.on("LCS Customer Equipment", {

    // ----------------------------------------------------------------
    // Service Address — filter by customer
    // ----------------------------------------------------------------

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

        frm.set_query("paired_component", function() {
            return {
                filters: {
                    customer: frm.doc.customer,
                    equipment_type: frm.doc.equipment_type === "Display" ? "Base" : "Display",
                    name: ["!=", frm.doc.name || ""]
                }
            };
        });
    },

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

    // ----------------------------------------------------------------
    // Manufacturer → populate model dropdown from child table
    // ----------------------------------------------------------------

    manufacturer: function(frm) {
        frm.set_value("scale_model", "");
        frm.set_value("capacity", "");
        frm.set_value("capacity_unit", "");
        frm.set_value("resolution", "");
        frm.set_value("resolution_unit", "");
        frm._model_map = {};

        if (!frm.doc.manufacturer) return;

        frappe.db.get_value(
            "Manufacturer",
            frm.doc.manufacturer,
            "lcs_scale_models"
        ).then(() => {
            // Fetch the full doc to get child table rows
            frappe.db.get_doc("Manufacturer", frm.doc.manufacturer).then(doc => {
                const models = (doc.lcs_scale_models || []);
                frm._model_map = {};
                models.forEach(m => {
                    frm._model_map[m.model_number] = m;
                });

                const options = [""].concat(models.map(m => m.model_number));
                frm.set_df_property("scale_model", "options", options.join("\n"));
                // Switch scale_model to Select temporarily via field property
                // Note: field is Data type in JSON so we use a custom dialog approach below
            });
        });
    },

    // ----------------------------------------------------------------
    // Model selection → autofill capacity and resolution
    // ----------------------------------------------------------------

    scale_model: function(frm) {
        frm.set_value("capacity", "");
        frm.set_value("capacity_unit", "");
        frm.set_value("resolution", "");
        frm.set_value("resolution_unit", "");

        if (!frm.doc.scale_model || !frm._model_map) return;

        const model = frm._model_map[frm.doc.scale_model];
        if (!model) return;

        if (model.capacity)        frm.set_value("capacity", model.capacity);
        if (model.capacity_unit)   frm.set_value("capacity_unit", model.capacity_unit);
        if (model.resolution)      frm.set_value("resolution", model.resolution);
        if (model.resolution_unit) frm.set_value("resolution_unit", model.resolution_unit);
    },

    // ----------------------------------------------------------------
    // Equipment type → clear paired component if switched to Unit
    // ----------------------------------------------------------------

    equipment_type: function(frm) {
        if (frm.doc.equipment_type === "Unit") {
            frm.set_value("paired_component", "");
        }
        // Update paired_component filter to match complementary type
        frm.set_query("paired_component", function() {
            return {
                filters: {
                    customer: frm.doc.customer,
                    equipment_type: frm.doc.equipment_type === "Display" ? "Base" : "Display",
                    name: ["!=", frm.doc.name || ""]
                }
            };
        });
    }

});