import frappe
from frappe.model.document import Document
from frappe.utils import add_months, getdate, today


class LCSCustomerEquipment(Document):
	def validate(self):
		self._compute_calibration_due_date()
		self._validate_model_belongs_to_manufacturer()
		self._validate_serial_unique_per_manufacturer()
		self._validate_base_serial_unique()

	def before_save(self):
		self._compute_calibration_due_date()

	def after_insert(self):
		self._create_paired_base()

	def on_update(self):
		self._create_paired_base()

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
		if self.scale_model and self.manufacturer:
			model_manufacturer = frappe.db.get_value("LCS Scale Model", self.scale_model, "manufacturer")
			if model_manufacturer != self.manufacturer:
				frappe.throw(
					frappe._("Model {0} belongs to {1}, not {2}.").format(
						self.scale_model, model_manufacturer, self.manufacturer
					)
				)

		if self.base_scale_model and self.base_manufacturer:
			base_model_manufacturer = frappe.db.get_value(
				"LCS Scale Model", self.base_scale_model, "manufacturer"
			)
			if base_model_manufacturer != self.base_manufacturer:
				frappe.throw(
					frappe._("Base model {0} belongs to {1}, not {2}.").format(
						self.base_scale_model, base_model_manufacturer, self.base_manufacturer
					)
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
					"Serial number {0} is already registered for manufacturer {1} " "on record {2}."
				).format(self.serial_number, self.manufacturer, duplicate)
			)

	def _validate_base_serial_unique(self):
		if not self.base_serial_number or not self.base_manufacturer:
			return

		if self.paired_component:
			return

		duplicate = frappe.db.get_value(
			"LCS Customer Equipment",
			{
				"serial_number": self.base_serial_number,
				"manufacturer": self.base_manufacturer,
				"name": ["!=", self.name],
			},
			"name",
		)
		if duplicate:
			frappe.throw(
				frappe._(
					"Base serial number {0} is already registered for manufacturer {1} " "on record {2}."
				).format(self.base_serial_number, self.base_manufacturer, duplicate)
			)

	# ------------------------------------------------------------------
	# Auto-create paired base record
	# ------------------------------------------------------------------

	def _create_paired_base(self):
		if self.equipment_type != "Display":
			return

		if self.paired_component:
			return

		if not self.base_manufacturer or not self.base_scale_model:
			return

		# Get base model specs to write back to the display record
		base_model = frappe.get_doc("LCS Scale Model", self.base_scale_model)

		# Create the base record
		base = frappe.new_doc("LCS Customer Equipment")
		base.customer = self.customer
		base.service_address = self.service_address
		base.status = self.status
		base.equipment_type = "Base"
		base.manufacturer = self.base_manufacturer
		base.scale_model = self.base_scale_model
		base.serial_number = self.base_serial_number
		base.capacity = self.base_capacity or base_model.capacity
		base.capacity_unit = self.base_capacity_unit or base_model.capacity_unit
		base.resolution = self.base_resolution or base_model.resolution
		base.resolution_unit = self.base_resolution_unit or base_model.resolution_unit
		base.location_description = self.location_description
		base.calibration_interval_months = self.calibration_interval_months
		base.last_calibration_date = self.last_calibration_date
		base.paired_component = self.name
		base.flags.ignore_permissions = True
		base.insert()

		# Write base capacity/resolution back to the display record
		frappe.db.set_value(
			"LCS Customer Equipment",
			self.name,
			{
				"paired_component": base.name,
				"capacity": base.capacity,
				"capacity_unit": base.capacity_unit,
				"resolution": base.resolution,
				"resolution_unit": base.resolution_unit,
			},
		)
		self.paired_component = base.name
		self.capacity = base.capacity
		self.capacity_unit = base.capacity_unit
		self.resolution = base.resolution
		self.resolution_unit = base.resolution_unit

		frappe.msgprint(
			frappe._("Paired base record {0} created automatically.").format(base.name),
			indicator="green",
			alert=True,
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
