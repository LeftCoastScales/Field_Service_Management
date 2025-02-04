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

// Form Controller
frappe.ui.form.on('Service Order', {
    setup(frm) {
        frm.service_order = new beveren_fsm.field_management_system.ServiceOrder({frm: frm});
    },

    refresh(frm) {
        frm.service_order.calculate_totals();
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
    }
});