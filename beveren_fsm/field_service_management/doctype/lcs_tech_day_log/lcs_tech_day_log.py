# Copyright (c) 2026, Left Coast Scales, LLC and contributors
# For license information, please see license.txt

from __future__ import annotations

import frappe
from frappe.model.document import Document


class LCSTechDayLog(Document):
	"""
	One row per technician per calendar date. `segments` is the gapless
	chain described in the Time-Tracking Proposal (Travel/Prep/Onsite/Shop),
	written primarily via beveren_fsm.field_service_management.api.tech_pwa
	rather than opened directly in Desk during normal operation.
	"""

	def validate(self):
		self.needs_review_count = sum(1 for s in self.segments if s.flagged_for_review)
		self._compute_totals()

	def _compute_totals(self):
		total_minutes = 0
		for seg in self.segments:
			if not seg.end_time:
				continue
			gross = (seg.end_time - seg.start_time).total_seconds() / 60
			net = max(0, gross - (seg.lunch_minutes or 0))
			seg.net_minutes = round(net)
			total_minutes += seg.net_minutes

		self.total_paid_minutes = round(total_minutes)

		scheduled = 600 if self.schedule_type == "CA Alternative" else 480
		doubletime_threshold = 720
		self.overtime_minutes = max(0, min(self.total_paid_minutes, doubletime_threshold) - scheduled)
		self.doubletime_minutes = max(0, self.total_paid_minutes - doubletime_threshold)
