// app/schedule-grid.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import dayjs from "dayjs";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { useGrid } from "../contexts/grid-context";
import {
  Search,
  Calendar,
  RotateCcw,
  XCircle,
  Truck,
  PlayCircle,
  CheckCircle,
  Circle,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../components/ui/tooltip";
import { useCalendar } from "../lib/context";
import { Technician, Appointment } from "../lib/types";
import styles from "./schedule-grid.module.css";

export interface FilterCriteria {
  date?: Date;
  location?: string;
  appointment?: string;
  order?: string;
  technician?: string;
}

interface ScheduleGridProps {
  selectedDate?: Date;
  filters?: FilterCriteria;
}

interface AppointmentWithTechnician extends Omit<Appointment, "type"> {
  resourceType: "appointment";
  technicianId: number;
}

interface ResizingData {
  appointmentId: number;
  edge: "left" | "right";
  startX: number;
  initialStartMinutes: number;
  initialEndMinutes: number;
  containerWidth: number;
}

interface DraggingData {
  appointmentId: number;
  startX: number;
  startY: number;
  initialStartMinutes: number;
  initialEndMinutes: number;
  initialTechnicianId: number;
  containerLeft: number;
  containerTop: number;
  rowHeight: number;
}

export function ScheduleGrid({ selectedDate = new Date(), filters }: ScheduleGridProps) {
  const { highlightedAppointmentId, setHighlightedAppointmentId } = useGrid();
  const { resources } = useCalendar();
  const [mounted, setMounted] = useState(false);
  const [appointments, setAppointments] = useState<AppointmentWithTechnician[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isSmallScreen, setIsSmallScreen] = useState(false);
  const [resizingData, setResizingData] = useState<ResizingData | null>(null);
  const [draggingData, setDraggingData] = useState<DraggingData | null>(null);
  const [hoveredTechnicianId, setHoveredTechnicianId] = useState<number | null>(null);

  // Define header hours.
  const fullHours = Array.from({ length: 16 }, (_, i) => i + 7);
  const smallHours = Array.from({ length: 13 }, (_, i) => i + 7);
  const hours = isSmallScreen ? smallHours : fullHours;

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkScreenSize = () => setIsSmallScreen(window.innerWidth < 768);
    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);
    return () => window.removeEventListener("resize", checkScreenSize);
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    // Extract technicians from live resources.
    const techniciansList = resources.filter((r): r is Technician => r.resourceType === "technician");
    setTechnicians(techniciansList);

    // Extract appointments using the new datetime fields.
    const appointmentsList = resources.filter((r): r is Appointment => r.resourceType === "appointment");
    const dateStr = dayjs(selectedDate).format("YYYY-MM-DD");
    let filteredAppointments = appointmentsList.filter((apt) =>
      dayjs(apt.scheduled_start_datetime).format("YYYY-MM-DD") === dateStr
    );

    // Apply additional filters.
    if (filters) {
      if (filters.location && filters.location !== "") {
        filteredAppointments = filteredAppointments.filter((apt) => apt.location === filters.location);
      }
      if (filters.appointment && filters.appointment !== "") {
        filteredAppointments = filteredAppointments.filter((apt) => apt.name === filters.appointment);
      }
      if (filters.technician && filters.technician !== "") {
        filteredAppointments = filteredAppointments.filter((apt) =>
          apt.service_technicians?.some(st => st.service_technician === filters.technician)
        );
      }
      // Order filter is not used in the schedule grid.
    }

    const appointmentsWithTech = filteredAppointments
      .map((appointment) => {
        // Find a technician from the appointment's service_technicians child table.
        const tech = techniciansList.find((t) =>
          appointment.service_technicians?.some(st => st.service_technician === t.name)
        );
        return { ...appointment, technicianId: tech ? tech.id : -1 };
      })
      .filter((appointment) => appointment.technicianId !== -1);

    setAppointments(appointmentsWithTech);
  }, [mounted, selectedDate, filters, resources]);

  const filteredTechnicians = technicians.filter(
    (tech) =>
      searchTerm === "" ||
      tech.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (tech.specialization && tech.specialization.toLowerCase().includes(searchTerm.toLowerCase()))
  );  

  const parseTimeToMinutes = (timeStr: string): number => {
    const [h, m] = timeStr.split(":").map(Number);
    return h * 60 + m;
  };

  const formatMinutesToTime = (totalMinutes: number): string => {
    const hrs = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
  };

  const isOverlap = (draggedAppt: AppointmentWithTechnician): boolean => {
    return appointments.some((appt) => {
      if (appt.name === draggedAppt.name) return false;
      
      // Check if appointments share any technicians
      const hasCommonTechnician = appt.service_technicians.some(tech1 => 
        draggedAppt.service_technicians.some(tech2 => 
          tech1.service_technician === tech2.service_technician
        )
      );
      
      if (!hasCommonTechnician) return false;
      
      const newStart = parseTimeToMinutes(new Date(draggedAppt.scheduled_start_datetime).toLocaleTimeString());
      const newEnd = parseTimeToMinutes(new Date(draggedAppt.scheduled_finish_datetime).toLocaleTimeString());
      const otherStart = parseTimeToMinutes(new Date(appt.scheduled_start_datetime).toLocaleTimeString());
      const otherEnd = parseTimeToMinutes(new Date(appt.scheduled_finish_datetime).toLocaleTimeString());
      return newStart < otherEnd && newEnd > otherStart;
    });
  };

  const getAppointmentStyle = (appointment: AppointmentWithTechnician) => {
    const startMinutes = parseTimeToMinutes(new Date(appointment.scheduled_start_datetime).toLocaleTimeString());
    const endMinutes = parseTimeToMinutes(new Date(appointment.scheduled_finish_datetime).toLocaleTimeString());
    const dayStart = 7 * 60;
    const dayEnd = (isSmallScreen ? 19 : 22) * 60;
    const totalMinutes = dayEnd - dayStart;
    const leftPercent = ((startMinutes - dayStart) / totalMinutes) * 100;
    const widthPercent = ((endMinutes - startMinutes) / totalMinutes) * 100;

    const baseStyle = {
      left: `${leftPercent}%`,
      width: `${widthPercent}%`,
      border: `2px solid ${getStatusColor(appointment.status)}`,
      backgroundColor: "#fff",
      zIndex: 10,
      position: "absolute" as const,
      overflow: "hidden",
      padding: "2px 4px",
      fontSize: "9px",
      color: "#333",
      borderRadius: "4px",
      display: "flex",
      flexDirection: "column" as const,
      justifyContent: "space-between",
      cursor: appointment.status.toLowerCase() === "scheduled" ? "move" : "default",
    };

    if (
      appointment.status.toLowerCase() === "scheduled" &&
      appointment.id === highlightedAppointmentId
    ) {
      return { ...baseStyle, outline: `2px dotted ${getStatusColor(appointment.status)}`, animation: "flash 1s ease-in-out" };
    }
    return baseStyle;
  };

  const formatTimeLabel = (hour: number) =>
    isSmallScreen ? `${hour}` : `${hour.toString().padStart(2, "0")}:00`;

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case "scheduled":
        return <Calendar size={18} color={getStatusColor(status)} />;
      case "rescheduled":
        return <RotateCcw size={18} color={getStatusColor(status)} />;
      case "cancelled":
        return <XCircle size={18} color={getStatusColor(status)} />;
      case "dispatched":
        return <Truck size={18} color={getStatusColor(status)} />;
      case "in progress":
        return <PlayCircle size={18} color={getStatusColor(status)} />;
      case "completed":
        return <CheckCircle size={18} color={getStatusColor(status)} />;
      default:
        return <Circle size={18} color={getStatusColor(status)} />;
    }
  };

  const startResize = (
    appointment: AppointmentWithTechnician,
    edge: "left" | "right",
    e: React.MouseEvent<HTMLDivElement>
  ) => {
    e.stopPropagation();
    if (appointment.status.toLowerCase() !== "scheduled") return;
    const containerWidth = containerRef.current?.clientWidth || 0;
    const initialStart = parseTimeToMinutes(appointment.startTime);
    const initialEnd = parseTimeToMinutes(appointment.finishTime);
    setResizingData({
      appointmentId: appointment.id,
      edge,
      startX: e.clientX,
      initialStartMinutes: initialStart,
      initialEndMinutes: initialEnd,
      containerWidth,
    });
    e.preventDefault();
  };

  useEffect(() => {
    const handleResizeMouseMove = (e: MouseEvent) => {
      if (!resizingData) return;
      const deltaX = e.clientX - resizingData.startX;
      const totalMinutes = (isSmallScreen ? 19 : 22) * 60 - 7 * 60;
      const pxPerMinute = resizingData.containerWidth / totalMinutes;
      const minutesDelta = deltaX / pxPerMinute;
      setAppointments((prev) =>
        prev.map((appt) => {
          if (appt.id === resizingData.appointmentId) {
            if (resizingData.edge === "left") {
              let newStart = Math.round(resizingData.initialStartMinutes + minutesDelta);
              newStart = Math.max(newStart, 7 * 60);
              newStart = Math.min(newStart, parseTimeToMinutes(appt.finishTime) - 15);
              return { ...appt, startTime: formatMinutesToTime(newStart) };
            } else {
              let newEnd = Math.round(resizingData.initialEndMinutes + minutesDelta);
              newEnd = Math.min(newEnd, (isSmallScreen ? 19 : 22) * 60);
              newEnd = Math.max(newEnd, parseTimeToMinutes(appt.startTime) + 15);
              return { ...appt, finishTime: formatMinutesToTime(newEnd) };
            }
          }
          return appt;
        })
      );
    };

    const handleResizeMouseUp = () => {
      setResizingData(null);
      setHighlightedAppointmentId(null);
      document.body.style.userSelect = "";
    };

    if (resizingData) {
      document.body.style.userSelect = "none";
      window.addEventListener("mousemove", handleResizeMouseMove);
      window.addEventListener("mouseup", handleResizeMouseUp);
    }
    return () => {
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", handleResizeMouseMove);
      window.removeEventListener("mouseup", handleResizeMouseUp);
    };
  }, [resizingData, isSmallScreen, setHighlightedAppointmentId]);

  const startDrag = (appointment: AppointmentWithTechnician, e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).classList.contains(styles.resizeHandle)) return;
    if (appointment.id === highlightedAppointmentId) return;
    if (appointment.status.toLowerCase() !== "scheduled") return;
    if (resizingData) return;
    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!containerRect) return;
    setDraggingData({
      appointmentId: appointment.id,
      startX: e.clientX,
      startY: e.clientY,
      initialStartMinutes: parseTimeToMinutes(appointment.startTime),
      initialEndMinutes: parseTimeToMinutes(appointment.finishTime),
      initialTechnicianId: appointment.technicianId,
      containerLeft: containerRect.left,
      containerTop: containerRect.top,
      rowHeight: containerRect.height / filteredTechnicians.length,
    });
    document.body.style.userSelect = "none";
    e.stopPropagation();
  };

  useEffect(() => {
    const handleDragMouseMove = (e: MouseEvent) => {
      if (!draggingData) return;
      const deltaX = e.clientX - draggingData.startX;
      const containerWidth = containerRef.current?.clientWidth || 0;
      const totalMinutes = (isSmallScreen ? 19 : 22) * 60 - 7 * 60;
      const pxPerMinute = containerWidth / totalMinutes;
      const minutesDelta = deltaX / pxPerMinute;
      let newStart = Math.round(draggingData.initialStartMinutes + minutesDelta);
      let newEnd = Math.round(draggingData.initialEndMinutes + minutesDelta);
      newStart = Math.max(newStart, 7 * 60);
      newEnd = Math.min(newEnd, (isSmallScreen ? 19 : 22) * 60);
      if (newEnd - newStart < 15) {
        newEnd = newStart + 15;
      }
      const newY = e.clientY - draggingData.containerTop;
      const rowIndex = Math.floor(newY / draggingData.rowHeight);
      const newTechId = filteredTechnicians[rowIndex]?.id ?? draggingData.initialTechnicianId;
      setHoveredTechnicianId(newTechId);
      setAppointments((prev) =>
        prev.map((appt) => {
          if (appt.id === draggingData.appointmentId) {
            return {
              ...appt,
              startTime: formatMinutesToTime(newStart),
              finishTime: formatMinutesToTime(newEnd),
              technicianId: newTechId,
            };
          }
          return appt;
        })
      );
    };

    const handleDragMouseUp = () => {
      if (draggingData) {
        const draggedAppt = appointments.find((a) => a.id === draggingData.appointmentId);
        if (draggedAppt && isOverlap(draggedAppt)) {
          setAppointments((prev) =>
            prev.map((appt) => {
              if (appt.id === draggingData.appointmentId) {
                return {
                  ...appt,
                  startTime: formatMinutesToTime(draggingData.initialStartMinutes),
                  finishTime: formatMinutesToTime(draggingData.initialEndMinutes),
                  technicianId: draggingData.initialTechnicianId,
                };
              }
              return appt;
            })
          );
        }
      }
      setDraggingData(null);
      setHoveredTechnicianId(null);
      document.body.style.userSelect = "";
    };

    if (draggingData) {
      window.addEventListener("mousemove", handleDragMouseMove);
      window.addEventListener("mouseup", handleDragMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleDragMouseMove);
      window.removeEventListener("mouseup", handleDragMouseUp);
    };
  }, [draggingData, isSmallScreen, appointments, filteredTechnicians]);

  const handleDoubleClick = (appointment: AppointmentWithTechnician, e: React.MouseEvent<HTMLDivElement>) => {
    if (appointment.status.toLowerCase() !== "scheduled") return;
    setHighlightedAppointmentId(appointment.id);
    e.stopPropagation();
  };

  const handleEmptySpaceClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!(e.target as HTMLElement).closest(`.${styles.appointment}`)) {
      setHighlightedAppointmentId(null);
    }
  };

  if (!mounted) return null;  

  return (
    <TooltipProvider>
      <div className={styles.timelineContainer}>
        <div className={styles.gridContainer}>
          <div className={styles.headerRow}>
            <div className={styles.techHeader}>
              <Input
                placeholder="Search technicians"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-8 w-full"
                // prefix={<Search className="h-4 w-4 text-muted-foreground mr-2" />}
              />
            </div>
            <div className={styles.timeLabels}>
              {hours.map((hour) => (
                <div key={hour} className={styles.timeLabel} data-time={formatTimeLabel(hour)} />
              ))}
            </div>
          </div>
          <div
            ref={containerRef}
            className={styles.scrollContainer}
            onClick={handleEmptySpaceClick}
            onDoubleClick={handleEmptySpaceClick}
          >
            {appointments.length === 0 && (
              <div className="p-4 text-center text-muted-foreground">
                No appointments found for {dayjs(selectedDate).format("MMMM D, YYYY")}
              </div>
            )}
            <div className={styles.rows}>
              {filteredTechnicians.map((tech) => {
                const techAppointments = appointments.filter((a) => 
                  a.service_technicians.some((st) => st.service_technician === tech.name)
                );
                return (
                  <div
                    key={tech.name}
                    className={styles.row}
                    style={{ backgroundColor: tech.id === hoveredTechnicianId ? "#f0f8ff" : "transparent" }}
                  >
                    <div className={styles.technicianInfo}>
                      <div className="font-small font-medium">{tech.full_name}</div>
                      <div className="text-xs text-muted-foreground">{tech.specialization}</div>
                    </div>
                    <div className={styles.appointmentsContainer} style={{ position: "relative" }}>
                      {techAppointments.map((appointment) => (
                        <Tooltip key={appointment.name}>
                          <TooltipTrigger asChild>
                            <div
                              className={styles.appointment}
                              style={getAppointmentStyle(appointment)}
                              onMouseDown={(e) => {
                                if ((e.target as HTMLElement).classList.contains(styles.resizeHandle))
                                  return;
                                startDrag(appointment, e);
                              }}
                              onDoubleClick={(e) => handleDoubleClick(appointment, e)}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
                                <div style={{ fontSize: "12px", fontWeight: "bold" }}>
                                  {appointment.name}
                                </div>
                                <div style={{ fontSize: "10px" }}>{appointment.location}</div>
                                <div style={{ fontSize: "10px" }}>
                                  {new Date(appointment.scheduled_start_datetime).toLocaleTimeString()} - {new Date(appointment.scheduled_finish_datetime).toLocaleTimeString()}
                                </div>
                                {/* <div style={{ fontSize: "8px" }}>{new Date(appointment.scheduled_start_datetime).toLocaleDateString()}</div> */}
                              </div>
                              {appointment.status.toLowerCase() === "scheduled" &&
                                appointment.id === highlightedAppointmentId && (
                                  <>
                                    <div
                                      className={styles.resizeHandle}
                                      style={{ left: "-4px" }}
                                      onMouseDown={(e) => startResize(appointment, "left", e)}
                                    />
                                    <div
                                      className={styles.resizeHandle}
                                      style={{ right: "-4px" }}
                                      onMouseDown={(e) => startResize(appointment, "right", e)}
                                    />
                                  </>
                                )}
                              <div className={styles.statusIcon}>{getStatusIcon(appointment.status)}</div>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-sm p-3">
                            <div className="space-y-2">
                              <div className="font-medium text-base">{appointment.name}</div>
                              <div className="flex items-center text-sm text-muted-foreground">
                                <Badge
                                  variant="outline"
                                  style={{
                                    backgroundColor: getStatusColor(appointment.status),
                                    color: "white",
                                  }}
                                >
                                  {appointment.status}
                                </Badge>
                              </div>
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 text-sm">
                                  <span>
                                  {new Date(appointment.scheduled_start_datetime).toLocaleTimeString()} - {new Date(appointment.scheduled_finish_datetime).toLocaleTimeString()}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                  <span>{appointment.location}</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                  <span>{new Date(appointment.scheduled_start_datetime).toLocaleDateString()}</span>
                                </div>
                              </div>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

function getStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case "in progress":
      return "#5b9bd5";
    case "scheduled":
      return "#70ad47";
    case "completed":
      return "#9e579d";
    case "cancelled":
      return "#c55a11";
    case "rescheduled":
      return "#ed7d31";
    case "dispatched":
      return "#ed7d31";
    default:
      return "#7f7f7f";
  }
}
