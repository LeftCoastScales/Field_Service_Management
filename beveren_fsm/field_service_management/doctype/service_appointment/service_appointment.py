# Copyright (c) 2025, Beveren Software and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class ServiceAppointment(Document):
    def before_save(self):
        self.set_scheduled_status()

    def validate(self):
        self.set_scheduled_status()

    def set_scheduled_status(self):
        if self.scheduled_start_datetime and self.scheduled_finish_datetime:
            if self.get("service_technicians") and len(self.get("service_technicians")) > 0:
                self.status = "Dispatched"
            elif self.status == "Open":
                self.status = "Scheduled"
