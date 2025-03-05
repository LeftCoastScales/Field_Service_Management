// app/calendar-view.tsx
"use client";

import { useCalendar } from "../../lib/context";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import { useMemo, useCallback, useRef, useEffect } from "react";
import dayjs from "dayjs";

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
  // Use only one call to useCalendar; appointments already contains our appointments.
  const { appointments, view, currentDate, searchTerm, selectedTechnician } = useCalendar();
  const calendarRef = useRef<FullCalendar>(null);

  // Filter appointments based on search and filter criteria.
  const filteredAppointments = useMemo(() => {
    return appointments.filter((app) => {
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

  // Create FullCalendar events using the ISO datetime values from the appointment
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
      },
    }));
  }, [filteredAppointments]);

  const getStatusColor = useCallback((status: string) => {
    switch (status.toLowerCase()) {
      case "scheduled":
        return "bg-blue-100 border-blue-500 text-blue-800";
      case "dispatched":
        return "bg-yellow-100 border-yellow-500 text-yellow-800";
      case "in progress":
      case "in-progress":
        return "bg-green-100 border-green-500 text-green-800";
      case "completed":
        return "bg-gray-100 border-gray-500 text-gray-800";
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
      eventDrop: (app: any) => {
        if (app.event.extendedProps.status?.toLowerCase() !== "scheduled") {
          app.revert();
        }
      },
      eventResize: (app: any) => {
        if (app.event.extendedProps.status?.toLowerCase() !== "scheduled") {
          app.revert();
        }
      },
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
    </div>
  );
}
