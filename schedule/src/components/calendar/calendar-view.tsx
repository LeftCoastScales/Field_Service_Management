// app/calendar-view.tsx
"use client";

import { useCalendar } from "../../lib/context";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import { useMemo, useCallback, useRef, useEffect, useState } from "react";
import dayjs from "dayjs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { updateAppointment } from "../../lib/appointments-api";
import { toast } from "react-hot-toast";

// Import tippy for modern tooltips.
import tippy from 'tippy.js';
import 'tippy.js/dist/tippy.css';

export interface FilterCriteria {
	date?: Date;
	location?: string;
	appointment?: string;
	order?: string;
	technician?: string;
}

interface CalendarViewProps {
	selectedDate: Date;
	filters?: FilterCriteria;
}

// Type for pending update from a calendar interaction.
interface PendingUpdate {
	event: any; // The FullCalendar event instance.
	revert: () => void;
}

export default function CalendarView({ selectedDate, filters }: CalendarViewProps) {
	const { appointments, view, currentDate, searchTerm, selectedTechnician } = useCalendar();
	const calendarRef = useRef<FullCalendar>(null);
	const [pendingUpdate, setPendingUpdate] = useState<PendingUpdate | null>(null);

	// Filter appointments based on search, filter criteria and docstatus.
	const filteredAppointments = useMemo(() => {
		return appointments.filter((app) => {
			// Only include appointments with docstatus === 1
			if (app.docstatus !== 1) return false;

			const matchesSearch =
				app.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
				(app.location && app.location.toLowerCase().includes(searchTerm.toLowerCase()));

			const matchesTechnician =
				!selectedTechnician ||
				(app.service_technicians &&
					app.service_technicians.some((st) => st.service_technician === selectedTechnician.name));

			const matchesFilters = filters
				? (!filters.location || app.location === filters.location) &&
				  (!filters.appointment || app.name === filters.appointment) &&
				  (!filters.technician || app.technician === filters.technician)
				: true;

			return matchesSearch && matchesTechnician && matchesFilters;
		});
	}, [appointments, searchTerm, selectedTechnician, filters]);

	// Create FullCalendar events using the ISO datetime values from the appointment.
	// Include technicians in extendedProps.
	const events = useMemo(() => {
		return filteredAppointments.map((appointment) => ({
			id: appointment.name.toString(),
			title: appointment.name,
			start: new Date(appointment.scheduled_start_datetime),
			end: new Date(appointment.scheduled_finish_datetime),
			extendedProps: {
				customerName: appointment.customer || "",
				address: appointment.location,
				serviceType: appointment.service_type || "",
				status: appointment.status,
				priority: appointment.priority || "",
				technicians: appointment.service_technicians || [],
			},
		}));
	}, [filteredAppointments]);

	const getStatusColor = useCallback((status: string) => {
		if (!status) return "bg-gray-100 border-gray-500 text-gray-800";
		switch (status.toLowerCase()) {
			case "scheduled":
				return "bg-green-100 border-green-500 text-green-800";
			case "dispatched":
				return "bg-orange-100 border-orange-500 text-orange-800";
			case "in-progress":
			case "in progress":
				return "bg-blue-100 border-blue-500 text-blue-800";
			case "completed":
				return "bg-purple-100 border-purple-500 text-purple-800";
			default:
				return "bg-gray-100 border-gray-500 text-gray-800";
		}
	}, []);

	useEffect(() => {
		// After render, update the FullCalendar view and date.
		setTimeout(() => {
			if (calendarRef.current) {
				const calendarApi = calendarRef.current.getApi();
				calendarApi.changeView(
					view === "month" ? "dayGridMonth" : view === "day" ? "timeGridDay" : "timeGridWeek"
				);
				calendarApi.gotoDate(selectedDate);
			}
		}, 0);
	}, [view, currentDate, selectedDate]);

	const handleConfirmUpdate = async () => {
		if (!pendingUpdate) return;
		// Look up the original appointment from context to preserve other fields.
		const original = appointments.find((app) => app.name === pendingUpdate.event.id);
		try {
			const result = await updateAppointment({
				name: pendingUpdate.event.id,
				scheduled_start_datetime: dayjs(pendingUpdate.event.start).format("YYYY-MM-DD HH:mm:ss"),
				scheduled_finish_datetime: dayjs(pendingUpdate.event.end).format("YYYY-MM-DD HH:mm:ss"),
				service_technicians: original?.service_technicians || [],
				items: original?.items || [],
			});
			toast.success(`Appointment ${result} Updated Successfully!`);
		} catch (error) {
			console.error("Error updating appointment:", error);
			pendingUpdate.revert();
			toast.error("Failed to update appointment");
		} finally {
			setPendingUpdate(null);
		}
	};

	const handleCancelUpdate = () => {
		if (pendingUpdate) {
			pendingUpdate.revert();
		}
		setPendingUpdate(null);
	};

	// Use eventDidMount to attach a tooltip to each event element.
	const eventDidMount = (info: any) => {
		// Ensure extendedProps.status exists before creating a tooltip.
		if (!info.event || !info.event.extendedProps || !info.event.extendedProps.status) {
			return;
		}
		
		// Build tooltip content.
		const technicians = info.event.extendedProps.technicians;
		const techList =
			Array.isArray(technicians) && technicians.length > 0
				? technicians.map((tech: any) => tech.full_name).join(", ")
				: "None";
		const tooltipContent = `
			<div class="p-2">
				<div class="font-semibold mb-1">${info.event.title}</div>
				<div class='text-sm'><strong>Customer:</strong> ${info.event.extendedProps.customerName}</div>
				<div class='text-sm'><strong>Address:</strong> ${info.event.extendedProps.address}</div>
				<div class='text-sm'><strong>Service Type:</strong> ${info.event.extendedProps.serviceType}</div>
				<div class='text-sm'><strong>Status:</strong> ${info.event.extendedProps.status}</div>
				<div class='text-sm'><strong>Technicians:</strong> ${techList}</div>
				<div class='text-sm'><strong>Time:</strong> ${info.timeText}</div>
			</div>
		`;
		
		// Initialize tippy on the event element.
		tippy(info.el, {
			content: tooltipContent,
			allowHTML: true,
			theme: "light",
			trigger: "click",
			placement: "top",
		});
	};

	const calendarOptions = useMemo(
		() => ({
			plugins: [timeGridPlugin, dayGridPlugin, interactionPlugin],
			initialView: "timeGridDay",
			headerToolbar: false,
			editable: true,
			selectable: true,
			selectMirror: true,
			events,
			slotMinTime: "07:00:00",
			slotMaxTime: "19:00:00",
			allDaySlot: false,
			height: "100%",
			nowIndicator: true,
			slotDuration: "00:30:00",
			slotLabelFormat: {
				hour: "numeric",
				minute: "2-digit",
				omitZeroMinute: false,
				meridiem: "short",
			},
			// Instead of directly updating, we set pending update on drop/resize.
			eventDrop: (info: any) => {
				if (info.event.extendedProps.status?.toLowerCase() !== "scheduled") {
					info.revert();
					return;
				}
				setPendingUpdate({ event: info.event, revert: info.revert });
			},
			eventResize: (info: any) => {
				if (info.event.extendedProps.status?.toLowerCase() !== "scheduled") {
					info.revert();
					return;
				}
				setPendingUpdate({ event: info.event, revert: info.revert });
			},
			eventDidMount, // Attach tooltip after event is rendered.
			eventContent: (eventInfo: any) => (
				<div
					className={`p-1 rounded-md text-xs ${getStatusColor(
						eventInfo.event.extendedProps.status
					)} border`}
				>
					<div className="font-semibold truncate">{eventInfo.event.title}</div>
					<div className="truncate">{eventInfo.event.extendedProps.customerName}</div>
					<div className="truncate">{eventInfo.timeText}</div>
					<div className="truncate">{eventInfo.event.extendedProps.address}</div>
				</div>
			),
			dayHeaderFormat: { weekday: "short", month: "numeric", day: "numeric", omitCommas: true },
			slotLabelClassNames: "text-xs font-medium text-gray-500",
			dayHeaderClassNames: "text-xs font-medium text-gray-500",
			viewClassNames: "h-full",
		}),
		[events, getStatusColor]
	);

	return (
		<div className="flex-1 w-full h-full">
			<FullCalendar ref={calendarRef} {...calendarOptions} />
			{pendingUpdate && (
				<ConfirmUpdateDialog
					pendingUpdate={pendingUpdate}
					onConfirm={handleConfirmUpdate}
					onCancel={handleCancelUpdate}
				/>
			)}
		</div>
	);
}

// A simple confirmation dialog for updating an appointment.
function ConfirmUpdateDialog({
	pendingUpdate,
	onConfirm,
	onCancel,
}: {
	pendingUpdate: PendingUpdate;
	onConfirm: () => void;
	onCancel: () => void;
}) {
	return (
		<Dialog open={true} onOpenChange={(open) => { if (!open) onCancel(); }}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Confirm Update</DialogTitle>
					<DialogDescription>
						Please confirm the updated appointment details.
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-2 text-sm">
					<p>
						<strong>Appointment:</strong> {pendingUpdate.event.title}
					</p>
					<p>
						<strong>Start:</strong>{" "}
						{dayjs(pendingUpdate.event.start).format("YYYY-MM-DD HH:mm")}
					</p>
					<p>
						<strong>End:</strong>{" "}
						{dayjs(pendingUpdate.event.end).format("YYYY-MM-DD HH:mm")}
					</p>
				</div>
				<div className="flex justify-end mt-4 space-x-2">
					<Button variant="ghost" onClick={onCancel}>
						Cancel
					</Button>
					<Button onClick={onConfirm}>Confirm Update</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
