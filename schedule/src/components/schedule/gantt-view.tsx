"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "../ui/button";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { Appointment } from "../../pages/schedule/types";
import { fetchTechnicians } from "../../hooks/use-appointments";
import { format, startOfDay } from "date-fns";

interface GanttViewProps {
  appointments: Appointment[];
  selectedDate: Date;
  onAppointmentClick?: (appointment: Appointment) => void;
}

interface Technician {
  name: string;
  full_name: string;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const HOUR_HEIGHT = 60; // pixels per hour

export function GanttView({
  appointments,
  selectedDate,
  onAppointmentClick,
}: GanttViewProps) {
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTechnicians();
  }, []);

  const loadTechnicians = async () => {
    try {
      const data = await fetchTechnicians();
      setTechnicians(data);
    } catch (error) {
      console.error("Error loading technicians:", error);
    } finally {
      setLoading(false);
    }
  };

  // Get technicians that have appointments for this date
  const techniciansWithAppointments = useMemo(() => {
    const techMap = new Map<string, Technician>();
    
    appointments.forEach((apt) => {
      apt.service_technicians?.forEach((tech) => {
        if (!techMap.has(tech.service_technician)) {
          const techData = technicians.find((t) => t.name === tech.service_technician);
          if (techData) {
            techMap.set(tech.service_technician, techData);
          }
        }
      });
    });

    // Also include all technicians even if they don't have appointments
    technicians.forEach((tech) => {
      if (!techMap.has(tech.name)) {
        techMap.set(tech.name, tech);
      }
    });

    return Array.from(techMap.values());
  }, [appointments, technicians]);

  const getAppointmentsForTechnician = (technicianName: string) => {
    return appointments.filter(
      (apt) =>
        apt.service_technicians?.some(
          (tech) => tech.service_technician === technicianName
        )
    );
  };

  const getAppointmentPosition = (appointment: Appointment) => {
    if (!appointment.scheduled_start_datetime || !appointment.scheduled_finish_datetime) {
      return { top: 0, height: 0, left: 0 };
    }

    const start = new Date(appointment.scheduled_start_datetime);
    const end = new Date(appointment.scheduled_finish_datetime);
    const dayStart = startOfDay(selectedDate);

    // Calculate position relative to day start
    const startMinutes = (start.getTime() - dayStart.getTime()) / (1000 * 60);
    const endMinutes = (end.getTime() - dayStart.getTime()) / (1000 * 60);
    const duration = endMinutes - startMinutes;

    const top = (startMinutes / 60) * HOUR_HEIGHT;
    const height = (duration / 60) * HOUR_HEIGHT;
    const left = 0;

    return { top, height, left };
  };

  const dateStr = format(selectedDate, "EEEE, MMMM d, yyyy");

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Gantt Content */}
      <div className="flex-1 overflow-auto">
        <div className="flex h-full">
          {/* Technician Names Column */}
          <div className="w-48 border-r border-border bg-card sticky left-0 z-10">
            <div className="sticky top-0 bg-card border-b border-border px-3 py-2 font-semibold text-sm">
              Technicians
            </div>
            <div className="divide-y divide-border">
              {loading ? (
                <div className="p-4 text-sm text-muted-foreground">Loading...</div>
              ) : techniciansWithAppointments.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">
                  No technicians
                </div>
              ) : (
                techniciansWithAppointments.map((tech) => {
                  const techAppointments = getAppointmentsForTechnician(tech.name);
                  const rowHeight = 24 * HOUR_HEIGHT; // 24 hours
                  return (
                    <div
                      key={tech.name}
                      className="px-3 py-2 border-r border-border"
                      style={{ minHeight: `${rowHeight}px` }}
                    >
                      <div className="font-medium text-sm">{tech.full_name}</div>
                      {techAppointments.length > 0 && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {techAppointments.length} appointment
                          {techAppointments.length !== 1 ? "s" : ""}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Timeline Grid */}
          <div className="flex-1 relative">
            {/* Time Column Headers */}
            <div className="sticky top-0 bg-card border-b border-border z-20 flex">
              {HOURS.map((hour) => (
                <div
                  key={hour}
                  className="flex-1 border-r border-border px-2 py-2 text-center text-xs font-medium"
                  style={{ minWidth: "80px" }}
                >
                  {hour.toString().padStart(2, "0")}:00
                </div>
              ))}
            </div>

            {/* Technician Rows with Appointments */}
            <div className="relative">
              {techniciansWithAppointments.map((tech) => {
                const techAppointments = getAppointmentsForTechnician(tech.name);
                const rowHeight = 24 * HOUR_HEIGHT;

                return (
                  <div
                    key={tech.name}
                    className="relative border-b border-border"
                    style={{ minHeight: `${rowHeight}px` }}
                  >
                    {/* Hour Grid Lines */}
                    <div className="absolute inset-0">
                      {HOURS.map((hour) => (
                        <div
                          key={hour}
                          className="absolute border-t border-border"
                          style={{ top: `${hour * HOUR_HEIGHT}px`, width: "100%" }}
                        />
                      ))}
                    </div>

                    {/* Appointments */}
                    {techAppointments.map((appointment) => {
                      const pos = getAppointmentPosition(appointment);
                      const statusColors: Record<string, string> = {
                        Open: "bg-blue-500",
                        Scheduled: "bg-blue-500",
                        Dispatched: "bg-orange-500",
                        "In Progress": "bg-orange-500",
                        Completed: "bg-green-500",
                        Cancelled: "bg-gray-400",
                      };

                      const statusColor =
                        statusColors[appointment.status] || "bg-gray-500";

                      const startTime = appointment.scheduled_start_datetime
                        ? format(
                            new Date(appointment.scheduled_start_datetime),
                            "HH:mm"
                          )
                        : "";
                      const endTime = appointment.scheduled_finish_datetime
                        ? format(
                            new Date(appointment.scheduled_finish_datetime),
                            "HH:mm"
                          )
                        : "";

                      return (
                        <div
                          key={appointment.name}
                          className={`absolute ${statusColor} text-white text-xs rounded px-2 py-1 cursor-pointer hover:opacity-90 transition-opacity border border-white/20 shadow-sm`}
                          style={{
                            top: `${pos.top}px`,
                            height: `${Math.max(pos.height, 30)}px`,
                            left: `${pos.left}px`,
                            minWidth: "120px",
                          }}
                          title={`${appointment.name} (${startTime} - ${endTime})`}
                          onClick={() => onAppointmentClick?.(appointment)}
                        >
                          <div className="font-medium truncate">
                            {appointment.service_order || appointment.name}
                          </div>
                          <div className="text-xs opacity-90">
                            {startTime} - {endTime}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
