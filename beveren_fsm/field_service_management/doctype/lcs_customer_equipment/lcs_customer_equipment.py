import frappe
from frappe.model.document import Document
from frappe.utils import add_months, getdate, today


class LCSCustomerEquipment(Document):

    def validate(self):
        self._compute_calibration_due_date()
        self._validate_model_belongs_to_manufacturer()
        self._validate_serial_unique_per_manufacturer()
        self._validate_paired_component()

    def before_save(self):
        self._compute_calibration_due_date()

    # ------------------------------------------------------------------
    # Calibration due date
    # ------------------------------------------------------------------

    def _compute_calibration_due_date(self):
        if self.last_calibration_date and self.calibration_interval_months:
            self.calibration_due_date = add_months(
                getdate(self.last_calibration_date),
                int(self.calibration_interval_months),
            )
        elif not self.last_calibration_date:
            self.calibration_due_date = None

    # ------------------------------------------------------------------
    # Model must belong to selected manufacturer
    # ------------------------------------------------------------------

    def _validate_model_belongs_to_manufacturer(self):
        if not self.scale_model or not self.manufacturer:
            return

        model_manufacturer = frappe.db.get_value(
            "LCS Scale Model", self.scale_model, "manufacturer"
        )
        if model_manufacturer != self.manufacturer:
            frappe.throw(
                frappe._(
                    "Model {0} belongs to {1}, not {2}. "
                    "Please select a model from the correct manufacturer."
                ).format(self.scale_model, model_manufacturer, self.manufacturer)
            )

    # ------------------------------------------------------------------
    # Serial number uniqueness per manufacturer
    # ------------------------------------------------------------------

    def _validate_serial_unique_per_manufacturer(self):
        if not self.serial_number or not self.manufacturer:
            return

        duplicate = frappe.db.get_value(
            "LCS Customer Equipment",
            {
                "serial_number": self.serial_number,
                "manufacturer": self.manufacturer,
                "name": ["!=", self.name],
            },
            "name",
        )
        if duplicate:
            frappe.throw(
                frappe._(
                    "Serial number {0} is already registered for manufacturer {1} "
                    "on record {2}."
                ).format(self.serial_number, self.manufacturer, duplicate)
            )

    # ------------------------------------------------------------------
    # Paired component validation
    # ------------------------------------------------------------------

    def _validate_paired_component(self):
        if not self.paired_component:
            return

        if self.paired_component == self.name:
            frappe.throw(frappe._("A piece of equipment cannot be paired with itself."))

        if self.equipment_type == "Unit":
            frappe.throw(
                frappe._("Equipment type 'Unit' cannot have a paired component.")
            )

        paired_type = frappe.db.get_value(
            "LCS Customer Equipment", self.paired_component, "equipment_type"
        )
        valid_pairs = {"Display": "Base", "Base": "Display"}

        if paired_type != valid_pairs.get(self.equipment_type):
            frappe.throw(
                frappe._(
                    "A {0} must be paired with a {1}, but {2} is a {3}."
                ).format(
                    self.equipment_type,
                    valid_pairs[self.equipment_type],
                    self.paired_component,
                    paired_type,
                )
            )


# ------------------------------------------------------------------
# Scheduled task — nightly overdue check
# ------------------------------------------------------------------

def flag_overdue_equipment():
    overdue = frappe.get_all(
        "LCS Customer Equipment",
        filters={
            "status": "Active",
            "calibration_due_date": ["<", today()],
        },
        fields=["name", "customer", "manufacturer", "scale_model", "serial_number", "calibration_due_date"],
    )

    if not overdue:
        return

    frappe.log_error(
        message=frappe.as_json(overdue),
        title="LCS Customer Equipment — Overdue Calibrations ({0})".format(len(overdue)),
    )