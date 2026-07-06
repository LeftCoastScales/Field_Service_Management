app_name = "Left Coast Scales"
app_title = "Left Coast Scales"
app_publisher = "Left Coast Scales"
app_description = "Left Coast Scales Field Service Management App"
app_email = "info@leftcoastscales.com"
app_license = "mit"

# Apps
# ------------------

# required_apps = []

# Each item in the list will be shown as an app in the apps page
# add_to_apps_screen = [
# 	{
# 		"name": "beveren_fsm",
# 		"logo": "/assets/beveren_fsm/logo.png",
# 		"title": "Field Service Management",
# 		"route": "/beveren_fsm",
# 		"has_permission": "beveren_fsm.api.permission.has_app_permission"
# 	}
# ]

fixtures = [
	# ---------------------------------------------------------------------------
	# LCS custom doctypes — export all records (existing, unchanged)
	# ---------------------------------------------------------------------------
	# "LCS Shortcut",  # seeded on initial deploy only — do not re-enable
	"Service Type",
	"Product Location",
	"LCS Service Agreement",
	"LCS Service Agreement Quote",
	"LCS Customer Equipment",
	"LCS Scale Model",
	"LCS Appointment Resource",  # Phase 2C — non-human resource child table
	"LCS Vehicle",
	{
		"dt": "Custom Field",
		"filters": [
			[
				"name",
				"in",
				[
					"Service Appointment-customer_notes",
					"Service Appointment-internal_notes",
					"Service Appointment-dispatch_instructions",
					"Service Order-dispatch_instructions",
				],
			]
		],
	},
	# {"dt": "Workspace", "filters": {"name": "Service"}},

	# Custom Fields for Service Order links and Service Area extensions (Phase 2D)
	{
		"doctype": "Custom Field",
		"filters": [
			[
				"name",
				"in",
				[
					# Service Order links (existing)
					"Purchase Order-custom_service_order",
					"Purchase Invoice-custom_service_order",
					"Purchase Receipt-custom_service_order",
					"Stock Entry-custom_service_order",
					"Delivery Note-custom_service_order",
					"Delivery Note-custom_current_product_location",
					"Stock Entry-custom_current_product_location",
					"Purchase Order-custom_current_product_location",
					"Purchase Invoice-custom_current_product_location",
					"Purchase Receipt-custom_current_product_location",
					# Service Area extensions (Phase 2D)
					"Service Area-custom_branch_office",
					"Service Area-custom_state",
					"Service Area-custom_cost_center",
					"Service Area-custom_territory",
					"Service Area-custom_office_address",
				],
			]
		],
	},

	# ---------------------------------------------------------------------------
	# LCS HR / People fixtures — filtered exports of standard Frappe doctypes
	#
	# ORDER MATTERS: Frappe applies fixtures in list order during migrate.
	# Masters (Designation, Department, Role, Shift Type) must land before
	# the records that depend on them (Employee, User, Shift Assignment).
	#
	# These use filtered dict format so we only touch LCS records — we never
	# export every Designation or every User in the system.
	# ---------------------------------------------------------------------------

	# Designations — only the ones LCS actually uses
	{
		"dt": "Designation",
		"filters": [
			["designation_name", "in", [
				"Account Manager",
				"Accountant",
				"Administrative Assistant",
				"Chief Executive Officer",
				"Chief Financial Officer",
				"Data Specialist",
				"General Manager",
				"Inside Sales",
				"Marketing Coordinator",
				"Master Technician",
				"Sales Admin",
				"Sales Manager",
				"Service Administrator",
				"Service Manager",
				"Shop Technician",
				"Technician",
			]],
		],
	},

	# LCS-Training department (the only new department we're adding)
	{
		"dt": "Department",
		"filters": [["department_name", "=", "LCS-Training"]],
	},

	# Employment Type — Full-time (may already exist; safe to re-export)
	{
		"dt": "Employment Type",
		"filters": [["employee_type", "=", "Full-time"]],
	},

	# Only 4 custom roles needed — all others (Field Service User, Dispatcher,
	# Crew Leader, Credit Manager, Fleet Manager, Quality Manager, Training Manager,
	# Compliance Officer, Field Service Manager) already exist in this ERPNext instance.
	{
		"dt": "Role",
		"filters": [
			["role_name", "in", [
				"CRM User",
				"CRM Manager",
				"Helpdesk Agent",
				"Helpdesk Manager",
			]],
		],
	},

	# LCS Standard shift — Mon–Fri 06:30–17:30
	{
		"dt": "Shift Type",
		"filters": [["shift_type_name", "=", "LCS Standard"]],
	},

	# "dt": "User" intentionally excluded.
	# User role assignments are operational data — keeping them in fixtures
	# would overwrite any Desk changes on every deploy.
	# Initial role assignments are handled via ERPNext Data Import (one-time).
]


# Includes in <head>
# ------------------

# include js, css files in header of desk.html
app_include_css = ["/assets/beveren_fsm/css/lcs_theme.css"]
# app_include_js = ["/assets/beveren_fsm/js/beveren_fsm.js"]

# include js, css files in header of web template
# web_include_css = "/assets/beveren_fsm/css/beveren_fsm.css"
# web_include_js = "/assets/beveren_fsm/js/beveren_fsm.js"

# include custom scss in every website theme (without file extension ".scss")
# website_theme_scss = "beveren_fsm/public/scss/website"

# include js in page
# page_js = {"page" : "public/js/file.js"}

# include js in doctype views
# doctype_js = {"doctype" : "public/js/doctype.js"}
# doctype_tree_js = {"doctype" : "public/js/doctype_tree.js"}
# doctype_calendar_js = {"doctype" : "public/js/doctype_calendar.js"}

# bench --site fsm.local export-fixtures  (reference — actual fixtures list is above)

# Svg Icons
# ------------------
# app_include_icons = "beveren_fsm/public/icons.svg"

# Home Pages
# ----------

# application home page (will override Website Settings)
# home_page = "login"

# website user home page (by Role)
# role_home_page = {
# 	"Role": "home_page"
# }

# Generators
# ----------

# automatically create page for each record of this doctype
# website_generators = ["Web Page"]

# Jinja
# ----------

# add methods and filters to jinja environment
# jinja = {
# 	"methods": "beveren_fsm.utils.jinja_methods",
# 	"filters": "beveren_fsm.utils.jinja_filters"
# }

# Installation
# ------------

# before_install = "beveren_fsm.install.before_install"
# after_install = "beveren_fsm.install.after_install"

# Uninstallation
# ------------

# before_uninstall = "beveren_fsm.uninstall.before_uninstall"
# after_uninstall = "beveren_fsm.uninstall.after_uninstall"

# Integration Setup
# ------------------
# before_app_install = "beveren_fsm.utils.before_app_install"
# after_app_install = "beveren_fsm.utils.after_app_install"

# Integration Cleanup
# -------------------
# before_app_uninstall = "beveren_fsm.utils.before_app_uninstall"
# after_app_uninstall = "beveren_fsm.utils.after_app_uninstall"

# Desk Notifications
# ------------------
# notification_config = "beveren_fsm.notifications.get_notification_config"

# Permissions
# -----------
# permission_query_conditions = {
# 	"Event": "frappe.desk.doctype.event.event.get_permission_query_conditions",
# }
#
# has_permission = {
# 	"Event": "frappe.desk.doctype.event.event.has_permission",
# }

# DocType Class
# ---------------
# override_doctype_class = {
# 	"ToDo": "custom_app.overrides.CustomToDo"
# }

# Document Events
# ---------------
# Hook on document methods and events

doc_events = {
	"Sales Invoice": {
		"on_submit": [
			"beveren_fsm.field_service_management.fsm_utils.update_invoice_status",
			"beveren_fsm.field_service_management.fsm_utils.update_per_billed_status",
		],
		"on_cancel": [
			"beveren_fsm.field_service_management.fsm_utils.update_invoice_status",
			"beveren_fsm.field_service_management.fsm_utils.update_per_billed_status",
		],
	},
	"Delivery Note": {
		"on_submit": [
			"beveren_fsm.field_service_management.doctype.service_order.service_order.update_product_movement_on_submit",
		],
	},
	"Purchase Order": {
		"on_submit": [
			"beveren_fsm.field_service_management.doctype.service_order.service_order.update_product_movement_on_submit",
		],
	},
	"Purchase Receipt": {
		"on_submit": [
			"beveren_fsm.field_service_management.doctype.service_order.service_order.update_product_movement_on_submit",
		],
	},
	"Purchase Invoice": {
		"on_submit": [
			"beveren_fsm.field_service_management.doctype.service_order.service_order.update_product_movement_on_submit",
		],
	},
	"Stock Entry": {
		"on_submit": [
			"beveren_fsm.field_service_management.doctype.service_order.service_order.update_product_movement_on_submit",
		],
	},
	"Service Order": {
		"validate": "beveren_fsm.field_service_management.api.tech_pwa.copy_instructions_from_request",
	},
	"Service Appointment": {
		"validate": "beveren_fsm.field_service_management.api.tech_pwa.copy_instructions_from_order",
	},
}

# Scheduled Tasks
# ---------------

scheduler_events = {
	"daily": [
		"beveren_fsm.field_service_management.doctype.service_request.service_request.update_status",
		"beveren_fsm.field_service_management.doctype.lcs_service_agreement.lcs_service_agreement.auto_create_service_orders",
		"beveren_fsm.field_service_management.doctype.lcs_customer_equipment.lcs_customer_equipment.flag_overdue_equipment",
	],
}

# Testing
# -------

# before_tests = "beveren_fsm.install.before_tests"

# Overriding Methods
# ------------------------------
#
# override_whitelisted_methods = {
# 	"frappe.desk.doctype.event.event.get_events": "beveren_fsm.event.get_events"
# }
#
# override_doctype_dashboards = {
# 	"Task": "beveren_fsm.task.get_dashboard_data"
# }

# auto_cancel_exempted_doctypes = ["Auto Repeat"]

# ignore_links_on_delete = ["Communication", "ToDo"]

# Request Events
# ----------------
# before_request = ["beveren_fsm.utils.before_request"]
# after_request = ["beveren_fsm.utils.after_request"]

# Job Events
# ----------
# before_job = ["beveren_fsm.utils.before_job"]
# after_job = ["beveren_fsm.utils.after_job"]

# User Data Protection
# --------------------

# user_data_fields = [
# 	{
# 		"doctype": "{doctype_1}",
# 		"filter_by": "{filter_by}",
# 		"redact_fields": ["{field_1}", "{field_2}"],
# 		"partial": 1,
# 	},
# ]

# Authentication and authorization
# --------------------------------

# auth_hooks = [
# 	"beveren_fsm.auth.validate"
# ]

# export_python_type_annotations = True

# default_log_clearing_doctypes = {
# 	"Logging DocType Name": 30  # days to retain logs
# }


website_route_rules = [
	{"from_route": "/schedule/<path:app_path>", "to_route": "schedule"},
]