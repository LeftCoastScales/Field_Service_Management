import frappe
from frappe.model.document import Document
from frappe.utils import add_months, getdate, today


class LCSCustomerEquipment(Document):

    def validate(self):
        self._compute_calibration_due_date()
        self._validate_serial_no_customer()

    def before_save(self):
        self._compute_calibration_due_date()

    # ------------------------------------------------------------------
    # Calibration due date
    # ------------------------------------------------------------------

    def _compute_calibration_due_date(self):
        """
        calibration_due_date = last_calibration_date + calibration_interval_months.
        Only computed when both fields are present. Field is read-only in the
        form; this is the authoritative write path.
        """
        if self.last_calibration_date and self.calibration_interval_months:
            self.calibration_due_date = add_months(
                getdate(self.last_calibration_date),
                int(self.calibration_interval_months),
            )
        elif not self.last_calibration_date:
            self.calibration_due_date = None

    # ------------------------------------------------------------------
    # Serial No → Customer consistency guard
    # ------------------------------------------------------------------

    def _validate_serial_no_customer(self):
        """
        If a Serial No is selected, warn (not block) when its Customer field
        does not match this record's customer. Serial No records in ERPNext
        track the current owner; a mismatch likely means the wrong serial was
        picked rather than a true error, so we log a warning rather than raise.
        """
        if not self.serial_no or not self.customer:
            return

        sn_customer = frappe.db.get_value("Serial No", self.serial_no, "customer")
        if sn_customer and sn_customer != self.customer:
            frappe.msgprint(
                frappe._(
                    "Serial No {0} is linked to customer {1} in the Serial No registry, "
                    "but this record is for customer {2}. Verify the serial number is correct."
                ).format(self.serial_no, sn_customer, self.customer),
                indicator="orange",
                alert=True,
            )


# ------------------------------------------------------------------
# Scheduled task — nightly overdue check
# Called from hooks.py daily_tasks
# ------------------------------------------------------------------

def flag_overdue_equipment():
    """
    Query all Active equipment whose calibration_due_date has passed and
    optionally add a system notification. Extend this function when
    SmarterCerts webhook integration is added in Phase 6.
    """
    overdue = frappe.get_all(
        "LCS Customer Equipment",
        filters={
            "status": "Active",
            "calibration_due_date": ["<", today()],
        },
        fields=["name", "customer", "serial_no", "calibration_due_date"],
    )

    if not overdue:
        return

    frappe.log_error(
        message=frappe.as_json(overdue),
        title="LCS Customer Equipment — Overdue Calibrations ({0})".format(len(overdue)),
    )