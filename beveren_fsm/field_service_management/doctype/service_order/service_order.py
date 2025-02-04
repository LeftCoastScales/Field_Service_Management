# Copyright (c) 2025, Beveren Software and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.utils import flt
from frappe.model.document import Document
from erpnext.controllers.accounts_controller import AccountsController

class ServiceOrder(AccountsController):
	def __init__(self, *args, **kwargs):
		super(ServiceOrder, self).__init__(*args, **kwargs)
		self._company_currency = None
		
	@property
	def company_currency(self):
		if not self._company_currency:
			self._company_currency = frappe.get_cached_value('Company', self.company, "default_currency")
		return self._company_currency
		
	def validate(self):
		self.validate_currency()
		self.validate_items()
		self.calculate_totals()
		self.calculate_taxes()
		self.calculate_base_amounts()
		self.set_in_words()
	
	@property
	def company_currency(self):
		if not self._company_currency:
			self._company_currency = frappe.get_cached_value('Company', self.company, "default_currency")
		return self._company_currency

	def validate_currency(self):
		from erpnext.controllers.accounts_controller import validate_conversion_rate
		if not self.currency:
			self.currency = self.company_currency

		# Set conversion rate to 1 if same currency
		if self.currency == self.company_currency and not self.conversion_rate:
			self.conversion_rate = 1.0
			
		if not self.conversion_rate:
			self.conversion_rate = get_exchange_rate(self.currency, self.company_currency, self.posting_date)
			
		validate_conversion_rate(
			conversion_rate=self.conversion_rate,
			conversion_rate_label="Conversion Rate",
			company=self.company,
			currency=self.currency
		)
		
		
	def validate_items(self):
		for item in self.get('items'):
			item.base_rate = flt(item.rate * self.conversion_rate, self.precision("base_rate", item))
			item.base_amount = flt(item.base_rate * item.qty, self.precision("base_amount", item))
			item.net_amount = item.amount
			item.base_net_amount = item.base_amount
			
	def calculate_totals(self):
		self.total_qty = 0
		self.total = 0
		self.base_total = 0
		
		for item in self.get('items'):
			self.total_qty += flt(item.qty)
			self.total += flt(item.amount)
			self.base_total += flt(item.base_amount)
			
		self.net_total = self.total
		self.base_net_total = self.base_total

	def calculate_base_amounts(self):
		self.base_total = flt(self.total * self.conversion_rate)
		self.base_net_total = flt(self.net_total * self.conversion_rate)
		self.base_total_taxes_and_charges = flt(self.total_taxes_and_charges * self.conversion_rate)
		self.base_grand_total = flt(self.grand_total * self.conversion_rate)
		self.base_rounding_adjustment = flt(self.rounding_adjustment * self.conversion_rate)
		self.base_rounded_total = flt(self.base_grand_total + self.base_rounding_adjustment)
	
	def set_in_words(self):
		from frappe.utils import money_in_words
		self.in_words = money_in_words(self.grand_total, self.currency)
		self.base_in_words = money_in_words(self.base_grand_total, self.company_currency)
		
	def calculate_taxes(self):
		self.total_taxes_and_charges = 0
		self.base_total_taxes_and_charges = 0
		
		if self.get('taxes'):
			for tax in self.taxes:
				if tax.charge_type == "On Net Total":
					tax.tax_amount = flt(self.net_total * flt(tax.rate) / 100)
					tax.base_tax_amount = flt(tax.tax_amount * self.conversion_rate)
					
					self.total_taxes_and_charges += tax.tax_amount
					self.base_total_taxes_and_charges += tax.base_tax_amount
					
		self.grand_total = flt(self.net_total + self.total_taxes_and_charges)
		self.base_grand_total = flt(self.base_net_total + self.base_total_taxes_and_charges)
		
		self.rounded_total = round(self.grand_total)
		self.base_rounded_total = round(self.base_grand_total)
		
		self.rounding_adjustment = flt(self.rounded_total - self.grand_total)
		self.base_rounding_adjustment = flt(self.base_rounded_total - self.base_grand_total)