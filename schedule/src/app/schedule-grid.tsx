"use client";

import { useEffect, useRef, useState, ChangeEvent } from "react";
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
import { updateAppointment } from "../lib/appointments-api";
import UpdateDialog from "./update-dialog";

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
  technicianId: string;
}

interface ResizingData {
  appointmentId: string;
  edge: "left" | "right";
  startX: number;
  initialStartMinutes: number;
  initialEndMinutes: number;
  containerWidth: number;
}

interface DraggingData {
  appointmentId: string;
  startX: number;
  startY: number;
  initialStartMinutes: number;
  initialEndMinutes: number;
  initialTechnicianId: string;
  containerLeft: number;
  containerTop: number;
  rowHeight: number;
}

interface PendingUpdate {
  appointment: AppointmentWithTechnician;
  original: AppointmentWithTechnician;
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
  const [hoveredTechnicianId, setHoveredTechnicianId] = useState<string | null>(null);
  const [pendingUpdate, setPendingUpdate] = useState<PendingUpdate | null>(null);

  // Grid displays time from 7am to 7pm.
  const dayStart = 7 * 60;
  const dayEnd = 19 * 60;
  const totalMinutes = dayEnd - dayStart; // 720 minutes

  const hours = Array.from({ length: 13 }, (_, i) => i + 7);

  const containerRef = useRef<HTMLDivElement>(null);
  const rowsContainerRef = useRef<HTMLDivElement>(null);

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
    const techniciansList = resources.filter((r): r is Technician => r.resourceType === "technician");
    setTechnicians(techniciansList);

    const appointmentsList = resources.filter((r): r is Appointment => r.resourceType === "appointment");
    const dateStr = dayjs(selectedDate).format("YYYY-MM-DD");
    let filteredAppointments = appointmentsList.filter((apt) =>
      dayjs(apt.scheduled_start_datetime).format("YYYY-MM-DD") === dateStr
    );

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
    }

    const appointmentsWithTech = filteredAppointments
      .map((appointment) => {
        const tech = techniciansList.find((t) =>
          appointment.service_technicians?.some(st => st.service_technician === t.name)
        );
        return { ...appointment, technicianId: tech ? tech.name : null };
      })
      .filter((appointment) => appointment.technicianId !== null)
      .filter((appointment) => appointment.docstatus === 1);

    setAppointments(appointmentsWithTech);
  }, [mounted, selectedDate, filters, resources]);

  const filteredTechnicians = technicians.filter(
    (tech) =>
      searchTerm === "" ||
      tech.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (tech.specialization && tech.specialization.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getMinutes = (dateStr: string): number => {
    const d = dayjs(dateStr);
    return d.hour() * 60 + d.minute();
  };

  const formatMinutesToDate = (totalMins: number): string => {
    const hrs = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    // Return in "YYYY-MM-DD HH:mm:ss" format.
    return dayjs(selectedDate).hour(hrs).minute(mins).second(0).format("YYYY-MM-DD HH:mm:ss");
  };

  const formatMinutesToTime = (totalMins: number): string => {
    const hrs = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
  };

  const isOverlap = (draggedAppt: AppointmentWithTechnician): boolean => {
    return appointments.some((appt) => {
      if (appt.name === draggedAppt.name) return false;
      const hasCommonTechnician = appt.service_technicians.some(tech1 =>
        draggedAppt.service_technicians.some(tech2 =>
          tech1.service_technician === tech2.service_technician
        )
      );
      if (!hasCommonTechnician) return false;
      const newStart = getMinutes(draggedAppt.scheduled_start_datetime);
      const newEnd = getMinutes(draggedAppt.scheduled_finish_datetime);
      const otherStart = getMinutes(appt.scheduled_start_datetime);
      const otherEnd = getMinutes(appt.scheduled_finish_datetime);
      return newStart < otherEnd && newEnd > otherStart;
    });
  };

  const getAppointmentStyle = (appointment: AppointmentWithTechnician) => {
    const startMinutes = getMinutes(appointment.scheduled_start_datetime);
    const endMinutes = getMinutes(appointment.scheduled_finish_datetime);
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
      padding: "4px 6px",
      fontSize: "11px",
      color: "#333",
      borderRadius: "6px",
      display: "flex",
      flexDirection: "column" as const,
      justifyContent: "space-between",
      cursor: appointment.status.toLowerCase() === "scheduled" ? "move" : "default",
    };

    if (
      appointment.status.toLowerCase() === "scheduled" &&
      appointment.name === highlightedAppointmentId
    ) {
      return {
        ...baseStyle,
        outline: `2px dotted ${getStatusColor(appointment.status)}`,
        animation: "flash 1s ease-in-out",
      };
    }
    return baseStyle;
  };

  const formatTimeLabel = (hour: number) => `${hour.toString().padStart(2, "0")}:00`;

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

  // RESIZE HANDLERS
  const startResize = (
    appointment: AppointmentWithTechnician,
    edge: "left" | "right",
    e: React.MouseEvent<HTMLDivElement>
  ) => {
    e.stopPropagation();
    if (appointment.status.toLowerCase() !== "scheduled") return;
    const containerWidth = containerRef.current?.clientWidth || 0;
    const initialStart = getMinutes(appointment.scheduled_start_datetime);
    const initialEnd = getMinutes(appointment.scheduled_finish_datetime);
    setResizingData({
      appointmentId: appointment.name,
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
      const containerWidth = resizingData.containerWidth;
      const pxPerMinute = containerWidth / totalMinutes;
      const minutesDelta = deltaX / pxPerMinute;
      setAppointments((prev) =>
        prev.map((appt) => {
          if (appt.name === resizingData.appointmentId) {
            if (resizingData.edge === "left") {
              let newStart = Math.round(resizingData.initialStartMinutes + minutesDelta);
              newStart = Math.max(newStart, dayStart);
              newStart = Math.min(newStart, getMinutes(appt.scheduled_finish_datetime) - 15);
              return {
                ...appt,
                scheduled_start_datetime: formatMinutesToDate(newStart),
              };
            } else {
              let newEnd = Math.round(resizingData.initialEndMinutes + minutesDelta);
              newEnd = Math.min(newEnd, dayEnd);
              newEnd = Math.max(newEnd, getMinutes(appt.scheduled_start_datetime) + 15);
              return {
                ...appt,
                scheduled_finish_datetime: formatMinutesToDate(newEnd),
              };
            }
          }
          return appt;
        })
      );
    };

    const handleResizeMouseUp = () => {
      if (resizingData) {
        const updatedAppt = appointments.find((a) => a.name === resizingData.appointmentId);
        if (updatedAppt) {
          const original: AppointmentWithTechnician = {
            ...updatedAppt,
            scheduled_start_datetime: formatMinutesToDate(resizingData.initialStartMinutes),
            scheduled_finish_datetime: formatMinutesToDate(resizingData.initialEndMinutes),
          };
          setPendingUpdate({ appointment: updatedAppt, original });
        }
      }
      setResizingData(null);
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
  }, [resizingData, totalMinutes, dayStart, dayEnd]);

  // DRAG HANDLERS
  const startDrag = (appointment: AppointmentWithTechnician, e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).classList.contains(styles.resizeHandle)) return;
    if (appointment.name === highlightedAppointmentId) return;
    if (appointment.status.toLowerCase() !== "scheduled") return;
    if (resizingData) return;
    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!containerRect) return;
    const rowsRect = rowsContainerRef.current?.getBoundingClientRect();
    const effectiveHeight = rowsRect ? rowsRect.height : containerRect.height;
    setDraggingData({
      appointmentId: appointment.name,
      startX: e.clientX,
      startY: e.clientY,
      initialStartMinutes: getMinutes(appointment.scheduled_start_datetime),
      initialEndMinutes: getMinutes(appointment.scheduled_finish_datetime),
      initialTechnicianId: appointment.technicianId,
      containerLeft: containerRect.left,
      containerTop: containerRect.top,
      rowHeight: effectiveHeight / filteredTechnicians.length,
    });
    document.body.style.userSelect = "none";
    e.stopPropagation();
  };

  useEffect(() => {
    const handleDragMouseMove = (e: MouseEvent) => {
      if (!draggingData) return;
      const deltaX = e.clientX - draggingData.startX;
      const containerWidth = containerRef.current?.clientWidth || 0;
      const pxPerMinute = containerWidth / totalMinutes;
      const minutesDelta = deltaX / pxPerMinute;
      let newStart = Math.round(draggingData.initialStartMinutes + minutesDelta);
      let newEnd = Math.round(draggingData.initialEndMinutes + minutesDelta);
      newStart = Math.max(newStart, dayStart);
      newEnd = Math.min(newEnd, dayEnd);
      if (newEnd - newStart < 15) {
        newEnd = newStart + 15;
      }
      const newY = e.clientY - draggingData.containerTop;
      const rowIndex = Math.floor(newY / draggingData.rowHeight);
      const newTechId = filteredTechnicians[rowIndex]?.name ?? draggingData.initialTechnicianId;
      setHoveredTechnicianId(newTechId);
      setAppointments((prev) =>
        prev.map((appt) => {
          if (appt.name === draggingData.appointmentId) {
            return {
              ...appt,
              scheduled_start_datetime: formatMinutesToDate(newStart),
              scheduled_finish_datetime: formatMinutesToDate(newEnd),
              technicianId: newTechId,
            };
          }
          return appt;
        })
      );
    };

    const handleDragMouseUp = (e: MouseEvent) => {
      if (draggingData) {
        const deltaX = e.clientX - draggingData.startX;
        const deltaY = e.clientY - draggingData.startY;
        const dragThreshold = 5; // Threshold in pixels
    
        // If the mouse movement is less than the threshold, do nothing
        if (Math.abs(deltaX) < dragThreshold && Math.abs(deltaY) < dragThreshold) {
          setDraggingData(null);
          setHoveredTechnicianId(null);
          document.body.style.userSelect = "";
          return;
        }
    
        const draggedAppt = appointments.find((a) => a.name === draggingData.appointmentId);
        if (draggedAppt && !isOverlap(draggedAppt)) {
          const original: AppointmentWithTechnician = {
            ...draggedAppt,
            scheduled_start_datetime: formatMinutesToDate(draggingData.initialStartMinutes),
            scheduled_finish_datetime: formatMinutesToDate(draggingData.initialEndMinutes),
          };
          setPendingUpdate({ appointment: draggedAppt, original });
        } else if (draggedAppt) {
          setAppointments((prev) =>
            prev.map((appt) =>
              appt.name === draggingData.appointmentId
                ? {
                    ...appt,
                    scheduled_start_datetime: formatMinutesToDate(draggingData.initialStartMinutes),
                    scheduled_finish_datetime: formatMinutesToDate(draggingData.initialEndMinutes),
                    technicianId: draggingData.initialTechnicianId,
                  }
                : appt
            )
          );
        }
        setDraggingData(null);
        setHoveredTechnicianId(null);
        document.body.style.userSelect = "";
      }
    };
    
    if (draggingData) {
      window.addEventListener("mousemove", handleDragMouseMove);
      window.addEventListener("mouseup", handleDragMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleDragMouseMove);
      window.removeEventListener("mouseup", handleDragMouseUp);
    };
  }, [draggingData, totalMinutes, dayStart, dayEnd, appointments, filteredTechnicians]);

  const handleDoubleClick = (appointment: AppointmentWithTechnician, e: React.MouseEvent<HTMLDivElement>) => {
    if (appointment.status.toLowerCase() !== "scheduled") return;
    setHighlightedAppointmentId(appointment.name);
    e.stopPropagation();
  };

  const handleEmptySpaceClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!(e.target as HTMLElement).closest(`.${styles.appointment}`)) {
      setHighlightedAppointmentId(null);
    }
  };

  // Generic onChange handler for the update dialog using dot-notation for nested fields.
  const handleDialogChange = (field: string, value: any) => {
    if (!pendingUpdate) return;
    const updated = { ...pendingUpdate.appointment };
    if (field.indexOf(".") === -1) {
      updated[field] = value;
    } else {
      const parts = field.split(".");
      if (parts[0] === "items") {
        const index = Number(parts[1]);
        updated.items = [...(updated.items || [])];
        updated.items[index] = {
          ...updated.items[index],
          [parts[2]]: value,
        };
      } else if (parts[0] === "service_technicians") {
        const index = Number(parts[1]);
        updated.service_technicians = [...(updated.service_technicians || [])];
        updated.service_technicians[index] = {
          ...updated.service_technicians[index],
          [parts[2]]: value,
        };
      } else {
        updated[field] = value;
      }
    }
    setPendingUpdate({
      ...pendingUpdate,
      appointment: updated,
    });
  };

  const handleConfirmUpdate = async () => {
    if (!pendingUpdate) return;
    try {
      await updateAppointment({
        name: pendingUpdate.appointment.name,
        scheduled_start_datetime: dayjs(pendingUpdate.appointment.scheduled_start_datetime).format("YYYY-MM-DD HH:mm:ss"),
        scheduled_finish_datetime: dayjs(pendingUpdate.appointment.scheduled_finish_datetime).format("YYYY-MM-DD HH:mm:ss"),
        service_technicians: pendingUpdate.appointment.service_technicians,
        items: pendingUpdate.appointment.items,
      });
    } catch (error) {
      console.error("Error updating appointment:", error);
      setAppointments((prev) =>
        prev.map((appt) =>
          appt.name === pendingUpdate.appointment.name ? pendingUpdate.original : appt
        )
      );
    } finally {
      setPendingUpdate(null);
    }
  };

  const handleCancelUpdate = () => {
    if (!pendingUpdate) return;
    setAppointments((prev) =>
      prev.map((appt) =>
        appt.name === pendingUpdate.appointment.name ? pendingUpdate.original : appt
      )
    );
    setPendingUpdate(null);
  };

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
            <div ref={rowsContainerRef} className={styles.rows}>
              {filteredTechnicians.map((tech) => {
                const techAppointments = appointments.filter((a) => a.technicianId === tech.name);
                return (
                  <div
                    key={tech.name}
                    className={styles.row}
                    style={{ backgroundColor: tech.name === hoveredTechnicianId ? "#f0f8ff" : "transparent" }}
                  >
                    <div className={styles.technicianInfo}>
                      <div className="font-medium">{tech.full_name}</div>
                      <div className="text-xs text-muted-foreground">{tech.specialization}</div>
                    </div>
                    <div className={styles.appointmentsContainer} style={{ position: "relative" }}>
                      {techAppointments.map((appointment) => (
                        <Tooltip
                          key={appointment.name}
                          open={
                            draggingData?.appointmentId === appointment.name ||
                              resizingData?.appointmentId === appointment.name
                              ? true
                              : undefined
                          }
                        >
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
                              <div className={styles.appointmentContent}>
                                <div className={styles.appointmentHeader}>
                                  <span className={styles.appointmentName}>{appointment.name}</span>
                                </div>
                                <div className={styles.appointmentBody}>
                                  <div className={styles.appointmentLocation}>{appointment.location}</div>
                                  <div className={styles.appointmentTime}>
                                    {formatMinutesToTime(getMinutes(appointment.scheduled_start_datetime))} - {formatMinutesToTime(getMinutes(appointment.scheduled_finish_datetime))}
                                  </div>
                                </div>
                              </div>
                              {appointment.status.toLowerCase() === "scheduled" &&
                                appointment.name === highlightedAppointmentId && (
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
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-base">{appointment.name}</span>
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
                              <div className="text-sm text-muted-foreground">
                                <div>
                                  <strong>Time:</strong> {formatMinutesToTime(getMinutes(appointment.scheduled_start_datetime))} - {formatMinutesToTime(getMinutes(appointment.scheduled_finish_datetime))}
                                </div>
                                <div>
                                  <strong>Location:</strong> {appointment.location}
                                </div>
                                <div>
                                  <strong>Date:</strong> {dayjs(appointment.scheduled_start_datetime).format("MMMM D, YYYY")}
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
      {pendingUpdate && (
        <UpdateDialog
          isOpen={true}
          onClose={handleCancelUpdate}
          appointment={pendingUpdate.appointment}
          onChange={handleDialogChange}
          onConfirm={handleConfirmUpdate}
        />
      )}
    </TooltipProvider>
  );
}

// function getStatusColor(status: string): string {
//   switch (status.toLowerCase()) {
//     case "in progress":
//       return "#5b9bd5";
//     case "scheduled":
//       return "#70ad47";
//     case "completed":
//       return "#9e579d";
//     case "cancelled":
//       return "#c55a11";
//     case "rescheduled":
//       return "#ed7d31";
//     case "dispatched":
//       return "#ed7d31";
//     default:
//       return "#7f7f7f";
//   }
// }

const getStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case "open": return"#155e75" 
    case "scheduled": return "#70ad47"; // use this "#065f46" match sidebar
    case "dispatched": return"#c2410c"
    case "in progress": return "#1e40af"
    case "pending": return "#92400e"
    case "completed": return "#6b21a8"
    case "on hold": return "#1f2937"
    default: return "#7f7f7f"
  }
};




