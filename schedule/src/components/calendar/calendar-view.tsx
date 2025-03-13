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

// Import dialogs from the app folder.
import TeamUpdateDialog from "../../app/team-update-dialog";
import CreateDialog from "../../app/create-dialog";
// EditAppointment remains in components.
import EditAppointment from "../../app/edit-appointment";

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

export default function CalendarView({ selectedDate, filters }: CalendarViewProps) {
	// Destructure appointments and resources along with other context values.
	const { appointments, resources, view, currentDate, searchTerm, selectedTechnician } = useCalendar();
	const calendarRef = useRef<FullCalendar>(null);

	// Compute the full list of technicians from resources.
	const technicians = useMemo(() => {
		return resources.filter((r) => r.resourceType === "technician");
	}, [resources]);

	// State for update dialogs.
	const [updateDialogData, setUpdateDialogData] = useState<any>(null);
	const [isTeamUpdate, setIsTeamUpdate] = useState(false);
	// Store the revert callback if update via drag/drop or resize is pending.
	const [calendarPendingRevert, setCalendarPendingRevert] = useState<(() => void) | null>(null);
	const [editValues, setEditValues] = useState({ date: "", start: "", end: "", techId: "" });
	const [validationErrors, setValidationErrors] = useState<string[]>([]);

	// State for create dialog.
	const [showCreateDialog, setShowCreateDialog] = useState(false);
	const [createPrefill, setCreatePrefill] = useState({
		startDate: "",
		startTime: "",
		finishTime: "",
		defaultTechnician: "",
	});

	// Filter appointments based on search criteria, filters, and docstatus.
	const filteredAppointments = useMemo(() => {
		return appointments.filter((app) => {
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

	// Map appointments to FullCalendar events.
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
		// Update FullCalendar view and date after render.
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

	// Helper: Determine the correct technician ID for single-tech appointments.
	const getTechId = (original: any) => {
		if (original.technicianId) return original.technicianId;
		if (original.service_technicians && original.service_technicians.length === 1) {
			return original.service_technicians[0].service_technician;
		}
		return selectedTechnician ? selectedTechnician.name : "";
	};

	// Handle updates from event drop/resize.
	const handleEventUpdate = (info: any) => {
		if (info.event.extendedProps.status?.toLowerCase() !== "scheduled") {
			info.revert();
			return;
		}
		const appointmentId = info.event.id;
		const original = appointments.find((app) => app.name.toString() === appointmentId);
		if (!original) {
			info.revert();
			return;
		}
		const newStart = info.event.start;
		const newEnd = info.event.end;
		const isTeamEvent = original.service_technicians && original.service_technicians.length > 1;
		const techId = getTechId(original);
		const updatedAppointment = {
			...original,
			scheduled_start_datetime: dayjs(newStart).format("YYYY-MM-DD HH:mm:ss"),
			scheduled_finish_datetime: dayjs(newEnd).format("YYYY-MM-DD HH:mm:ss"),
			reschedule: true,
		};
		setUpdateDialogData(updatedAppointment);
		setIsTeamUpdate(isTeamEvent);
		setCalendarPendingRevert(() => info.revert);
		setEditValues({
			date: dayjs(newStart).format("YYYY-MM-DD"),
			start: dayjs(newStart).format("HH:mm"),
			end: dayjs(newEnd).format("HH:mm"),
			techId: techId,
		});
	};

	// Handle event click to trigger update dialog.
	const handleEventClick = (info: any) => {
		const status = info.event.extendedProps.status?.toLowerCase();
		if (status === "open" || status === "scheduled") {
			const appointmentId = info.event.id;
			const original = appointments.find((app) => app.name.toString() === appointmentId);
			if (!original) return;
			const start = info.event.start;
			const end = info.event.end;
			const isTeamEvent = original.service_technicians && original.service_technicians.length > 1;
			const techId = getTechId(original);
			const updatedAppointment = {
				...original,
				scheduled_start_datetime: dayjs(start).format("YYYY-MM-DD HH:mm:ss"),
				scheduled_finish_datetime: dayjs(end).format("YYYY-MM-DD HH:mm:ss"),
			};
			setUpdateDialogData(updatedAppointment);
			setIsTeamUpdate(isTeamEvent);
			setEditValues({
				date: dayjs(start).format("YYYY-MM-DD"),
				start: dayjs(start).format("HH:mm"),
				end: dayjs(end).format("HH:mm"),
				techId: techId,
			});
		} else {
			// Optionally, show details for non-updatable events.
		}
	};

	// Handle selecting a time slot to create an appointment.
	const handleSelect = (selectInfo: any) => {
		const start = selectInfo.start;
		const end = selectInfo.end;
		setCreatePrefill({
			startDate: dayjs(start).format("YYYY-MM-DD"),
			startTime: dayjs(start).format("HH:mm"),
			finishTime: dayjs(end).format("HH:mm"),
			defaultTechnician: "",
		});
		setShowCreateDialog(true);
		let calendarApi = selectInfo.view.calendar;
		calendarApi.unselect();
	};

	const handleEditChange = (field: string, value: string) => {
		setEditValues({ ...editValues, [field]: value });
	};

	const confirmUpdate = async () => {
		if (!updateDialogData) return;
		const newStartCombined = dayjs(`${editValues.date} ${editValues.start}`, "YYYY-MM-DD HH:mm").format(
			"YYYY-MM-DD HH:mm:ss"
		);
		const newEndCombined = dayjs(`${editValues.date} ${editValues.end}`, "YYYY-MM-DD HH:mm").format(
			"YYYY-MM-DD HH:mm:ss"
		);
		const updatedAppointment = {
			...updateDialogData,
			scheduled_start_datetime: newStartCombined,
			scheduled_finish_datetime: newEndCombined,
			reschedule: true,
		};
		try {
			const result = await updateAppointment({
				name: updatedAppointment.name,
				scheduled_start_datetime: newStartCombined,
				scheduled_finish_datetime: newEndCombined,
				service_technicians: updatedAppointment.service_technicians,
				items: updatedAppointment.items,
				reschedule: true,
				edit_technician_list: true,
			});
			toast.success(`Appointment ${result} Updated Successfully!`);
		} catch (error: any) {
			console.error("Error updating appointment:", error);
			if (calendarPendingRevert) {
				calendarPendingRevert();
			}
			toast.error("Failed to update appointment");
		} finally {
			setUpdateDialogData(null);
			setCalendarPendingRevert(null);
		}
	};

	const cancelUpdate = () => {
		if (calendarPendingRevert) {
			calendarPendingRevert();
		}
		setUpdateDialogData(null);
		setCalendarPendingRevert(null);
	};

	// Compute team dialog properties more robustly.
	let teamDialogProps = null;
	if (updateDialogData && isTeamUpdate) {
		// Use the technician from appointment data or edit values as fallback.
		const oldTech = updateDialogData.technicianId || editValues.techId;
		const newTech = editValues.techId || oldTech;
		const otherAssignedTechs = updateDialogData.service_technicians
			? updateDialogData.service_technicians.filter((st: any) => st.service_technician !== oldTech)
			: [];
		teamDialogProps = { oldTech, newTech, otherAssignedTechs };
	}

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
			select: handleSelect,
			eventClick: handleEventClick,
			eventDrop: (info: any) => {
				handleEventUpdate(info);
			},
			eventResize: (info: any) => {
				handleEventUpdate(info);
			},
			eventDidMount: (info: any) => {
				if (!info.event || !info.event.extendedProps || !info.event.extendedProps.status) return;
				const technicians = info.event.extendedProps.technicians;
				const techList =
					Array.isArray(technicians) && technicians.length > 0
						? technicians.map((tech: any) => tech.full_name).join(", ")
						: "None";
				const tooltipContent = `
					<div class="p-2">
						<div class="font-semibold mb-1">${info.event.title}</div>
						<div class="text-sm"><strong>Customer:</strong> ${info.event.extendedProps.customerName}</div>
						<div class="text-sm"><strong>Address:</strong> ${info.event.extendedProps.address}</div>
						<div class="text-sm"><strong>Service Type:</strong> ${info.event.extendedProps.serviceType}</div>
						<div class="text-sm"><strong>Status:</strong> ${info.event.extendedProps.status}</div>
						<div class="text-sm"><strong>Technicians:</strong> ${techList}</div>
						<div class="text-sm"><strong>Time:</strong> ${info.timeText}</div>
					</div>
				`;
				import("tippy.js").then((tippyModule) => {
					tippyModule.default(info.el, {
						content: tooltipContent,
						allowHTML: true,
						theme: "light",
						placement: "top",
					});
				});
			},
			// Restore custom event content rendering.
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
		[events, getStatusColor, selectedDate]
	);

	return (
		<div className="flex-1 w-full h-full">
			<FullCalendar ref={calendarRef} {...calendarOptions} />
			{/* Render update dialogs conditionally */}
			{updateDialogData && (
				<>
					{isTeamUpdate && teamDialogProps ? (
						<TeamUpdateDialog
							oldTech={teamDialogProps.oldTech}
							newTech={teamDialogProps.newTech}
							newStart={editValues.start}
							newEnd={editValues.end}
							otherAssignedTechs={teamDialogProps.otherAssignedTechs}
							onTimeChange={handleEditChange}
							onConfirm={confirmUpdate}
							onCancel={cancelUpdate}
							errorMessages={validationErrors}
						/>
					) : (
						<EditAppointment
							editValues={editValues}
							handleChange={handleEditChange}
							// Pass the full technicians list from context so that the correct technician (matching editValues.techId) is selected.
							technicians={technicians}
							onCancel={cancelUpdate}
							onConfirm={confirmUpdate}
							techReadOnly={false}
							errorMessages={validationErrors}
						/>
					)}
				</>
			)}
			{showCreateDialog && (
				<CreateDialog
					isOpen={showCreateDialog}
					onClose={() => setShowCreateDialog(false)}
					prefillData={{
						startDate: createPrefill.startDate,
						startTime: createPrefill.startTime,
						finishTime: createPrefill.finishTime,
						defaultTechnician: createPrefill.defaultTechnician,
					}}
				/>
			)}
		</div>
	);
}
