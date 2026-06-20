# Copyright (c) 2026, Left Coast Scales LLC
# field_service_management/api/vehicle_inspection.py

import frappe
from frappe.utils import today, now_datetime


@frappe.whitelist()
def get_vehicle_defaults(form_type):
	"""
	Returns:
	  - vehicles: list of active LCS Vehicle records filtered by form_type
	  - employee: logged-in employee name + branch
	  - last_vehicle: last vehicle this employee drove (from most recent inspection)
	  - last_odometer: last odometer for that vehicle
	  - branch: employee's home branch
	"""
	user = frappe.session.user
	if user == "Guest":
		frappe.throw("Not permitted", frappe.PermissionError)

	# Get employee record
	employee = frappe.db.get_value(
		"Employee",
		{"user_id": user, "status": "Active"},
		["name", "employee_name", "branch", "department"],
		as_dict=True,
	)
	if not employee:
		frappe.throw("No active Employee record found for your login.")

	# Get vehicles filtered by form type
	vehicles = frappe.get_all(
		"LCS Vehicle",
		filters={"form_type": form_type, "status": "Active"},
		fields=["name", "unit_number", "nickname", "year", "make", "model",
		        "vin_last_4", "license_plate", "plate_state", "branch",
		        "last_odometer", "last_driver", "vehicle_type"],
		order_by="branch asc, unit_number asc",
	)

	# Build display label for each vehicle
	for v in vehicles:
		nick = f" ({v.nickname})" if v.nickname else ""
		v["display_label"] = f"{v.year} {v.make} {v.model}{nick} — VIN {v.vin_last_4}"

	# Find last vehicle this employee drove — check both inspection doctypes
	last_vehicle = None
	last_odometer = 0

	if form_type == "DOT":
		last_insp = frappe.db.get_value(
			"LCS DOT Inspection",
			{"driver": employee.name},
			["vehicle", "odometer_end", "odometer_start", "inspection_date"],
			order_by="inspection_date desc, creation desc",
			as_dict=True,
		)
	else:
		last_insp = frappe.db.get_value(
			"LCS Light Vehicle Inspection",
			{"driver": employee.name},
			["vehicle", "odometer_end", "odometer_start", "inspection_date"],
			order_by="inspection_date desc, creation desc",
			as_dict=True,
		)

	if last_insp:
		last_vehicle = last_insp.vehicle
		last_odometer = last_insp.odometer_end or last_insp.odometer_start or 0

	# If no prior inspection, try last_driver on vehicles
	if not last_vehicle:
		driven = frappe.db.get_value(
			"LCS Vehicle",
			{"last_driver": employee.name, "form_type": form_type},
			"name",
		)
		if driven:
			last_vehicle = driven

	# If we have a last vehicle, get its current last odometer from the master
	if last_vehicle:
		master_odometer = frappe.db.get_value("LCS Vehicle", last_vehicle, "last_odometer")
		if master_odometer:
			last_odometer = master_odometer

	return {
		"employee_name": employee.employee_name,
		"employee_id": employee.name,
		"branch": employee.branch or "",
		"vehicles": vehicles,
		"last_vehicle": last_vehicle,
		"last_odometer": last_odometer,
		"today": today(),
	}


@frappe.whitelist()
def get_vehicle_odometer(vehicle):
	"""Return the last recorded odometer for a given vehicle."""
	if frappe.session.user == "Guest":
		frappe.throw("Not permitted", frappe.PermissionError)
	odometer = frappe.db.get_value("LCS Vehicle", vehicle, "last_odometer")
	return {"last_odometer": odometer or 0}


@frappe.whitelist(methods=["POST"])
def submit_dot_inspection(data):
	"""Create and save an LCS DOT Inspection from the web form."""
	import json
	if isinstance(data, str):
		data = json.loads(data)

	user = frappe.session.user
	if user == "Guest":
		frappe.throw("Not permitted", frappe.PermissionError)

	employee = frappe.db.get_value(
		"Employee", {"user_id": user, "status": "Active"}, "name"
	)
	if not employee:
		frappe.throw("No active Employee record found.")

	# Populate vehicle info from master
	vehicle = frappe.get_doc("LCS Vehicle", data.get("vehicle"))

	doc = frappe.new_doc("LCS DOT Inspection")
	doc.update(data)
	doc.driver = employee
	doc.vehicle_year_make_model = f"{vehicle.year} {vehicle.make} {vehicle.model}"
	doc.license_plate = vehicle.license_plate or ""
	doc.plate_state = vehicle.plate_state or ""
	doc.vin_last_4 = vehicle.vin_last_4 or ""

	# Certification time
	if doc.pt_certified:
		doc.pt_certified_time = now_datetime()
	if doc.post_certified:
		doc.post_certified_time = now_datetime()

	doc.insert(ignore_permissions=True)
	doc.save(ignore_permissions=True)

	# Update vehicle master
	odometer = data.get("odometer_end") or data.get("odometer_start")
	if odometer:
		vehicle.last_odometer = int(odometer)
		vehicle.last_odometer_date = data.get("inspection_date") or today()
		vehicle.last_driver = employee
		vehicle.save(ignore_permissions=True)

	return {"name": doc.name, "status": "success"}


@frappe.whitelist(methods=["POST"])
def submit_light_inspection(data):
	"""Create and save an LCS Light Vehicle Inspection from the web form."""
	import json
	if isinstance(data, str):
		data = json.loads(data)

	user = frappe.session.user
	if user == "Guest":
		frappe.throw("Not permitted", frappe.PermissionError)

	employee = frappe.db.get_value(
		"Employee", {"user_id": user, "status": "Active"}, "name"
	)
	if not employee:
		frappe.throw("No active Employee record found.")

	vehicle = frappe.get_doc("LCS Vehicle", data.get("vehicle"))

	doc = frappe.new_doc("LCS Light Vehicle Inspection")
	doc.update(data)
	doc.driver = employee
	doc.vehicle_type = vehicle.vehicle_type
	doc.vehicle_year_make = f"{vehicle.year} {vehicle.make} {vehicle.model}"
	doc.unit_fleet_number = vehicle.unit_number
	doc.license_plate = vehicle.license_plate or ""
	doc.plate_state = vehicle.plate_state or ""

	if doc.pd_certified:
		doc.pd_certified_time = now_datetime()
	if doc.eod_certified:
		doc.eod_certified_time = now_datetime()

	doc.insert(ignore_permissions=True)
	doc.save(ignore_permissions=True)

	odometer = data.get("odometer_end") or data.get("odometer_start")
	if odometer:
		vehicle.last_odometer = int(odometer)
		vehicle.last_odometer_date = data.get("inspection_date") or today()
		vehicle.last_driver = employee
		vehicle.save(ignore_permissions=True)

	return {"name": doc.name, "status": "success"}