# Copyright (c) 2026, Left Coast Scales
# For license information, please see license.txt

"""
Regression test for print-line consolidation (get_print_line_groups).

This is the automated version of the QuickBooks-Online-bundle-parity
question that started this feature: several labor-recovery items (Zone
Charge, Travel Labor, Shipping & Receiving Recovery) need to look like ONE
line to the customer, while the GL, tax, and every standard report still
see them as fully separate postings against their own income accounts.

Uses throwaway "_Test ..." masters (company, items, customer) so it's
safe to run against a real dev/staging site without touching production
data. Requires bench console / bench run-tests access:

    bench --site <site> run-tests --app beveren_fsm \\
        --module beveren_fsm.field_service_management.api.test_print_helpers
"""

import frappe
from frappe.tests import IntegrationTestCase
from frappe.www.printview import get_html_and_style


COMPANY = "_Test LCS Consolidation Co"
ABBR = "TLCC"


class IntegrationTestPrintConsolidation(IntegrationTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		frappe.set_user("Administrator")
		cls._setup_masters()

	@classmethod
	def _account(cls, name, parent_account_name, account_type=None):
		acc_name = f"{name} - {ABBR}"
		if frappe.db.exists("Account", acc_name):
			return acc_name
		parent = frappe.db.get_value(
			"Account", {"company": COMPANY, "account_name": parent_account_name}, "name"
		)
		return frappe.get_doc(
			{
				"doctype": "Account",
				"account_name": name,
				"company": COMPANY,
				"parent_account": parent,
				"account_type": account_type,
			}
		).insert().name

	@classmethod
	def _setup_masters(cls):
		for wh_type in ("Transit", "Rejected"):
			if not frappe.db.exists("Warehouse Type", wh_type):
				frappe.get_doc({"doctype": "Warehouse Type", "name": wh_type}).insert()

		if not frappe.db.exists(
			"Fiscal Year",
			{
				"year_start_date": ["<=", frappe.utils.nowdate()],
				"year_end_date": [">=", frappe.utils.nowdate()],
			},
		):
			frappe.get_doc(
				{
					"doctype": "Fiscal Year",
					"year": "_Test FY LCS Consolidation",
					"year_start_date": frappe.utils.get_first_day(frappe.utils.nowdate()).replace(month=1, day=1),
					"year_end_date": frappe.utils.get_first_day(frappe.utils.nowdate()).replace(month=12, day=31),
				}
			).insert()

		if not frappe.db.exists("Company", COMPANY):
			frappe.get_doc(
				{
					"doctype": "Company",
					"company_name": COMPANY,
					"abbr": ABBR,
					"default_currency": "USD",
					"country": "United States",
				}
			).insert()

		company = frappe.get_doc("Company", COMPANY)
		if not company.round_off_account:
			company.round_off_account = cls._account("Round Off", "Indirect Expenses")
			company.save()

		cls.zone_income = cls._account("Zone Charge Income", "Direct Income")
		cls.travel_income = cls._account("Travel Labor Income", "Direct Income")
		cls.recovery_income = cls._account("S&R Recovery Income", "Direct Income")
		cls.parts_income = cls._account("Parts & Service Income", "Direct Income")

		if not frappe.db.exists("Price List", "_Test Standard Selling LCS"):
			frappe.get_doc(
				{
					"doctype": "Price List",
					"price_list_name": "_Test Standard Selling LCS",
					"selling": 1,
					"currency": "USD",
				}
			).insert()

		if not frappe.db.exists("LCS Print Consolidation Group", "_test_recovery_labor"):
			frappe.get_doc(
				{
					"doctype": "LCS Print Consolidation Group",
					"group_name": "_test_recovery_labor",
					"print_label": "Service & Handling",
					"print_description": (
						"Includes travel time, zone-based dispatch charge, and "
						"shipping/receiving recovery for parts on this job."
					),
				}
			).insert()

		cls._make_item("_Test Zone Charge", cls.zone_income, "_test_recovery_labor")
		cls._make_item("_Test Travel Labor", cls.travel_income, "_test_recovery_labor")
		cls._make_item("_Test S&R Recovery", cls.recovery_income, "_test_recovery_labor")
		cls._make_item("_Test Scale Calibration Service", cls.parts_income, None)

		if not frappe.db.exists("Customer", "_Test LCS Consolidation Customer"):
			frappe.get_doc(
				{
					"doctype": "Customer",
					"customer_name": "_Test LCS Consolidation Customer",
					"customer_group": frappe.db.get_value("Customer Group", {}, "name"),
					"territory": frappe.db.get_value("Territory", {}, "name"),
				}
			).insert()

	@classmethod
	def _make_item(cls, item_code, income_account, consolidation_group):
		if frappe.db.exists("Item", item_code):
			it = frappe.get_doc("Item", item_code)
		else:
			it = frappe.get_doc(
				{
					"doctype": "Item",
					"item_code": item_code,
					"item_name": item_code,
					"item_group": frappe.db.get_value("Item Group", {}, "name"),
					"is_stock_item": 0,
					"stock_uom": frappe.db.get_value("UOM", {}, "name") or "Nos",
				}
			).insert()

		existing = [d for d in it.item_defaults if d.company == COMPANY]
		if existing:
			existing[0].income_account = income_account
		else:
			it.append("item_defaults", {"company": COMPANY, "income_account": income_account})

		it.lcs_consolidation_group = consolidation_group
		it.save()
		return it.name

	def _make_invoice(self):
		si = frappe.get_doc(
			{
				"doctype": "Sales Invoice",
				"customer": "_Test LCS Consolidation Customer",
				"company": COMPANY,
				"currency": "USD",
				"conversion_rate": 1,
				"selling_price_list": "_Test Standard Selling LCS",
				"price_list_currency": "USD",
				"plc_conversion_rate": 1,
				"due_date": frappe.utils.nowdate(),
				"items": [
					{"item_code": "_Test Scale Calibration Service", "qty": 1, "rate": 250.00},
					{"item_code": "_Test Zone Charge", "qty": 1, "rate": 35.00},
					{"item_code": "_Test Travel Labor", "qty": 2, "rate": 60.00},
					{"item_code": "_Test S&R Recovery", "qty": 1, "rate": 18.50},
				],
			}
		)
		si.insert()
		si.submit()
		return si

	def test_gl_entries_stay_fully_itemized(self):
		"""
		The heart of the requirement: consolidating the customer-facing
		line must NEVER touch accounting. Every component keeps posting
		to its own income account, at its own amount.
		"""
		si = self._make_invoice()
		gl = frappe._dict(
			(d.account, d.credit)
			for d in frappe.get_all(
				"GL Entry",
				filters={"voucher_no": si.name, "credit": [">", 0]},
				fields=["account", "credit"],
			)
		)

		self.assertEqual(gl.get(self.zone_income), 35.0)
		self.assertEqual(gl.get(self.travel_income), 120.0)
		self.assertEqual(gl.get(self.recovery_income), 18.5)
		self.assertEqual(gl.get(self.parts_income), 250.0)
		self.assertAlmostEqual(sum(gl.values()), 423.5, places=2)

	def test_print_line_groups_collapses_flagged_items_only(self):
		si = self._make_invoice()
		from beveren_fsm.field_service_management.api.print_helpers import (
			get_print_line_groups,
		)

		rows = get_print_line_groups(si)
		item_rows = [r for r in rows if r["type"] == "item"]
		group_rows = [r for r in rows if r["type"] == "group"]

		self.assertEqual(len(item_rows), 1)
		self.assertEqual(item_rows[0]["item_code"], "_Test Scale Calibration Service")

		self.assertEqual(len(group_rows), 1)
		self.assertEqual(group_rows[0]["label"], "Service & Handling")
		self.assertAlmostEqual(group_rows[0]["amount"], 173.5, places=2)
		self.assertIn("travel time", group_rows[0]["note"])

	def test_disabled_group_falls_back_to_itemized_print(self):
		group = frappe.get_doc("LCS Print Consolidation Group", "_test_recovery_labor")
		group.disabled = 1
		group.save()
		try:
			si = self._make_invoice()
			from beveren_fsm.field_service_management.api.print_helpers import (
				get_print_line_groups,
			)

			rows = get_print_line_groups(si)
			item_codes = {r["item_code"] for r in rows if r["type"] == "item"}
			self.assertIn("_Test Zone Charge", item_codes)
			self.assertIn("_Test Travel Labor", item_codes)
			self.assertIn("_Test S&R Recovery", item_codes)
			self.assertEqual([r for r in rows if r["type"] == "group"], [])
		finally:
			group.disabled = 0
			group.save()

	def test_print_output_shows_one_line_not_three(self):
		si = self._make_invoice()
		if not frappe.db.exists("Print Format", "_Test LCS Consolidated Invoice"):
			frappe.get_doc(
				{
					"doctype": "Print Format",
					"name": "_Test LCS Consolidated Invoice",
					"doc_type": "Sales Invoice",
					"print_format_type": "Jinja",
					"custom_format": 1,
					"html": (
						"{% set line_rows = get_print_line_groups(doc) %}"
						"{% for row in line_rows %}"
						"{% if row.type == 'item' %}{{ row.description }}|{% else %}"
						"{{ row.label }}|{{ row.note }}|{% endif %}"
						"{% endfor %}"
					),
				}
			).insert()

		html = get_html_and_style(
			doc="Sales Invoice",
			name=si.name,
			print_format="_Test LCS Consolidated Invoice",
			no_letterhead=1,
		)["html"]

		self.assertIn("Service & Handling", html)
		self.assertIn("travel time", html)
		self.assertNotIn("_Test Zone Charge", html)
		self.assertNotIn("_Test Travel Labor", html)
		self.assertNotIn("_Test S&R Recovery", html)
		self.assertIn("_Test Scale Calibration Service", html)

	def test_before_print_hook_rebuilds_items_for_print_designer(self):
		"""
		apply_print_line_consolidation is the before_print hook that
		Print Designer formats need (their items table reads doc.items
		directly instead of calling get_print_line_groups itself).
		Confirm it rebuilds doc.items in memory to the same consolidated
		shape -- and that it never touches the database, so reloading
		the invoice still shows the real, fully itemized rows.
		"""
		si = self._make_invoice()
		from beveren_fsm.field_service_management.api.print_helpers import (
			apply_print_line_consolidation,
		)

		original_item_count = len(si.items)
		apply_print_line_consolidation(si)

		self.assertEqual(len(si.items), 2)  # 1 pass-through + 1 consolidated
		codes = [d.item_code for d in si.items]
		self.assertIn("_Test Scale Calibration Service", codes)
		self.assertIn("Service & Handling", codes)

		group_row = next(d for d in si.items if d.item_code == "Service & Handling")
		self.assertAlmostEqual(group_row.amount, 173.5, places=2)
		self.assertIsNone(group_row.qty)
		self.assertEqual([d.idx for d in si.items], [1, 2])

		# Never persisted: reloading from the database still shows all
		# original line items, untouched.
		reloaded = frappe.get_doc("Sales Invoice", si.name)
		self.assertEqual(len(reloaded.items), original_item_count)

	def test_before_print_hook_is_noop_without_any_grouped_items(self):
		"""
		A document with nothing to consolidate should render exactly as
		before -- no pseudo-rows, no renumbering, no wasted work.
		"""
		si = frappe.get_doc(
			{
				"doctype": "Sales Invoice",
				"customer": "_Test LCS Consolidation Customer",
				"company": COMPANY,
				"currency": "USD",
				"conversion_rate": 1,
				"selling_price_list": "_Test Standard Selling LCS",
				"price_list_currency": "USD",
				"plc_conversion_rate": 1,
				"due_date": frappe.utils.nowdate(),
				"items": [
					{"item_code": "_Test Scale Calibration Service", "qty": 1, "rate": 250.00},
				],
			}
		)
		si.insert()
		si.submit()

		from beveren_fsm.field_service_management.api.print_helpers import (
			apply_print_line_consolidation,
		)

		original_items = list(si.items)
		apply_print_line_consolidation(si)
		self.assertEqual(si.items, original_items)

	def test_before_print_hook_survives_frappes_actual_dispatch_call(self):
		"""
		Regression test for a production bug caught by actually printing a
		real Sales Order after this feature went live: frappe/www/printview.py
		calls `doc.run_method("before_print", print_settings)` with
		print_settings as a POSITIONAL argument, not a keyword. Document's
		hook dispatcher (Document.hook -> compose -> runner) then invokes
		every doc_events "before_print" handler as
		`fn(doc, "before_print", print_settings)` -- three positional
		arguments. A handler declared as
		`apply_print_line_consolidation(doc, method=None)` raises
		"TypeError: ... takes from 1 to 2 positional arguments but 3 were
		given" on every single print, which none of the tests above caught
		because they all call the function directly with 1-2 args instead
		of going through Frappe's real hook dispatch. Exercise that exact
		path here so this class of signature mismatch can't regress.
		"""
		si = self._make_invoice()
		# Mirrors frappe.www.printview's exact call shape, dispatched
		# through the real hooks.py "before_print" wiring for Sales Invoice.
		si.run_method("before_print", frappe._dict({"some": "print_settings"}))

		codes = [d.item_code for d in si.items]
		self.assertIn("Service & Handling", codes)
		self.assertNotIn("_Test Zone Charge", codes)

	def test_get_print_line_groups_is_idempotent_after_before_print(self):
		"""
		Regression test for a second bug found while fixing the one above:
		before_print fires for EVERY print of a doctype it's wired to --
		Jinja formats included, not just Print Designer ones. A Jinja
		format for the same doctype that calls get_print_line_groups(doc)
		directly (the pattern this app's Quotation format uses) would run
		AFTER before_print already rewrote doc.items into pass-through +
		pseudo-group rows. Re-deriving groups from that already-mutated
		list looks up the pseudo group row's fabricated item_code
		("Service & Handling") against the Item master, finds no
		consolidation group, and silently prints it back out as a second
		ordinary item -- the exact opposite of what this feature promises,
		and different from (and worse than) simply erroring: it produces
		wrong, believable-looking output. Caught by simulating that
		ordering directly here.
		"""
		si = self._make_invoice()
		from beveren_fsm.field_service_management.api.print_helpers import (
			apply_print_line_consolidation,
			get_print_line_groups,
		)

		# Simulate before_print already having run for this render (as it
		# always does, before any Jinja template body executes).
		apply_print_line_consolidation(si)

		# A Jinja print format calling get_print_line_groups(doc) itself,
		# same as Quotation's, must see the SAME consolidated view --
		# not double-process it into a second ordinary line.
		rows = get_print_line_groups(si)
		group_rows = [r for r in rows if r["type"] == "group"]
		item_rows = [r for r in rows if r["type"] == "item"]

		self.assertEqual(len(group_rows), 1)
		self.assertEqual(group_rows[0]["label"], "Service & Handling")
		self.assertAlmostEqual(group_rows[0]["amount"], 173.5, places=2)
		self.assertEqual(len(item_rows), 1)
		self.assertEqual(item_rows[0]["item_code"], "_Test Scale Calibration Service")

	def test_before_print_hook_output_survives_doc_as_dict(self):
		"""
		Regression test for a third production bug, caught only by actually
		printing a real Sales Order that had a letterhead selected -- no test
		in this file exercised that path. frappe/www/printview.py renders the
		letterhead by calling doc.as_dict(), which walks every child table
		and calls .as_dict() on each row. The first cut of this hook rebuilt
		EVERY row (pass-through items included) as a plain frappe._dict.
		frappe._dict.__getattr__ returns None for a missing key instead of
		raising, so `row.as_dict` silently evaluated to None and
		`row.as_dict(...)` raised "TypeError: 'NoneType' object is not
		callable" -- print was still completely broken, just with a new and
		more confusing error, once the signature bug above was fixed. Fixed
		by leaving pass-through rows as the same original child-table
		Document objects (already have a working as_dict()) and only using a
		dict subclass with a real as_dict() for the synthesized group row.
		Exercise the exact call letterhead rendering makes so this class of
		"looks like a dict, isn't a real row" bug can't regress.
		"""
		si = self._make_invoice()
		original_uom = si.items[0].uom

		from beveren_fsm.field_service_management.api.print_helpers import apply_print_line_consolidation

		apply_print_line_consolidation(si)

		# Must not raise -- this is the exact call
		# frappe/www/printview.get_rendered_template makes to build the
		# letterhead's Jinja context.
		as_dict = si.as_dict()
		item_dicts = as_dict["items"]
		self.assertEqual(len(item_dicts), 2)

		pass_through = next(
			d for d in item_dicts if d["item_code"] == "_Test Scale Calibration Service"
		)
		group = next(d for d in item_dicts if d["item_code"] == "Service & Handling")

		# The pass-through row is a real dict produced by a real Document's
		# as_dict(), so fields this hook never touches (like uom) are still
		# correct -- not silently hardcoded away.
		self.assertEqual(pass_through["uom"], original_uom)
		self.assertAlmostEqual(group["amount"], 173.5, places=2)

	def test_group_row_supports_arbitrary_document_methods(self):
		"""
		Regression test for a fourth production bug, caught only by actually
		printing a real Sales Order through a SECOND Print Designer format
		("Sales Order with Item Image") on production, with a letterhead
		selected: Print Designer's item-table macro renders each cell by
		calling `row.get_formatted(fieldname)` -- a real Document method.
		The group row built by the previous fix (a frappe._dict subclass
		with only an as_dict() method bolted on) had no get_formatted
		either, and frappe._dict.__getattr__ returns None for a missing
		attribute instead of raising, so `row.get_formatted` evaluated to
		None and `None(fieldname)` raised "TypeError: 'NoneType' object is
		not callable" all over again -- a different Document method than
		the one the previous fix anticipated, but the exact same class of
		bug. Fixed by building the group row as a genuine, unsaved instance
		of the doctype's own child table (via frappe.get_doc), which has
		every Document method a real row has. Exercise get_formatted
		directly (not just as_dict, already covered above) so this class of
		"looks like a dict, isn't a real row" bug can't regress again on
		some other Document method a future print format happens to call.
		"""
		si = self._make_invoice()

		from beveren_fsm.field_service_management.api.print_helpers import apply_print_line_consolidation

		apply_print_line_consolidation(si)

		group_row = next(d for d in si.items if d.item_code == "Service & Handling")

		# Must not raise -- this is the exact call Print Designer's table
		# macro makes per cell (print_designer/.../macros/spantag.html).
		formatted_amount = group_row.get_formatted("amount")
		self.assertIn("173.5", formatted_amount.replace(",", ""))

		# The group row is a real child-table Document now, not a bare
		# dict -- same doctype as every other row in doc.items.
		pass_through = next(
			d for d in si.items if d.item_code == "_Test Scale Calibration Service"
		)
		self.assertEqual(group_row.doctype, pass_through.doctype)
