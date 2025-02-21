import frappe
from frappe import _

def get_data():
	return {
		'heatmap': True, 
		'heatmap_message': 'This is based on the Time Sheets created against this project', 
		'fieldname': 'service_appointment', 
		'transactions': [
			{'label': 'Billing', 'items': ['Sales Invoice']}, 
		], 
		'non_standard_fieldnames': {
			'Sales Invoice': 'custom_reference_service_document',
		}, 
		'internal_links': {}
	}