import frappe
from frappe.model.document import Document
from frappe.utils import add_months, getdate, today


class LCSCustomerEquipment(Document):

    def validate(self):
        self._compute_calibration_due_date()

    def before_save(self):
        self._compute_calibration_due_date()

    # ------------------------------------------------------------------
    # Calibration due date
    # ------------------------------------------------------------------

    def _compute_calibration_due_date(self):
        """
        calibration_due_date = last_calibration_date + calibration_interval_months.
        Field is read-only in the form; this is the authoritative write path.
        """
        if self.last_calibration_date and self.calibration_interval_months:
            self.calibration_due_date = add_months(
                getdate(self.last_calibration_date),
                int(self.calibration_interval_months),
            )
        elif not self.last_calibration_date:
            self.calibration_due_date = None


# ------------------------------------------------------------------
# Scheduled task — nightly overdue check
# Called from hooks.py daily_tasks
# ------------------------------------------------------------------

def flag_overdue_equipment():
    """
    Query all Active equipment whose calibration_due_date has passed.
    Extend this function when SmarterCerts webhook integration is added in Phase 6.
    """
    overdue = frappe.get_all(
        "LCS Customer Equipment",
        filters={
            "status": "Active",
            "calibration_due_date": ["<", today()],
        },
        fields=["name", "customer", "serial_number", "calibration_due_date"],
    )

    if not overdue:
        return

    frappe.log_error(
        message=frappe.as_json(overdue),
        title="LCS Customer Equipment — Overdue Calibrations ({0})".format(len(overdue)),
    )