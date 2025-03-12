"use client";

import { useEffect, useState, forwardRef } from "react";
import { Responsive, WidthProvider } from "react-grid-layout";
import dayjs from "dayjs";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import {
  Calendar,
  RotateCcw,
  XCircle,
  Truck,
  PlayCircle,
  CheckCircle,
  Circle,
  Loader,
} from "lucide-react";
import { useCalendar } from "../lib/context";
import { Technician, Appointment } from "../lib/types";
import { updateAppointment } from "../lib/appointments-api";
import {
  validateTimeRange,
  validateMinimumDuration,
  validateBusinessHours,
  validateNonEmptyField,
} from "../lib/validations";
import "react-grid-layout/css/styles.css";
import styles from "./events-grid.module.css";
import Tippy from "@tippyjs/react";
import "tippy.js/dist/tippy.css";
import "tippy.js/themes/light.css";
import EditAppointment from "./edit-appointment";
import TeamUpdateDialog from "./team-update-dialog";
import ResourceDetailsDialog from "./resource-details-dialog";
import CreateDialog from "./create-dialog";

const ResponsiveGridLayout = WidthProvider(Responsive) as unknown as React.FC<any>;

interface FilterCriteria {
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
  appointment: string;
  technicianId: string;
}

interface Layout {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  maxH?: number;
}

export function EventsGrid({ selectedDate = new Date(), filters }: ScheduleGridProps) {
  const { resources, loading } = useCalendar();
  const [mounted, setMounted] = useState(false);
  const [appointments, setAppointments] = useState<AppointmentWithTechnician[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [hoveredAppointmentId, setHoveredAppointmentId] = useState<string | null>(null);
  const [pendingUpdate, setPendingUpdate] = useState<{
    appointment: AppointmentWithTechnician;
    newStart: string;
    newEnd: string;
    newTechId: string;
    forceTeamDialog?: boolean;
    techReadOnly?: boolean;
  } | null>(null);
  const [showTeamDialog, setShowTeamDialog] = useState(false);
  const [gridKey, setGridKey] = useState<number>(Date.now());
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [detailsResource, setDetailsResource] = useState<any>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);

  const [editValues, setEditValues] = useState({
    date: dayjs(selectedDate).format("YYYY-MM-DD"),
    start: "",
    end: "",
    techId: ""
  });

  const [fetchError, setFetchError] = useState(false);

  // Constants for time calculations.
  const HOURS = Array.from({ length: 12 }, (_, i) => i + 7);
  const MINUTES_PER_HOUR = 60;
  const TOTAL_MINUTES = 12 * MINUTES_PER_HOUR;
  const COLS = TOTAL_MINUTES;
  const DAY_START = 7 * MINUTES_PER_HOUR;

  // NEW: State for Create Dialog prefill and visibility.
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createPrefill, setCreatePrefill] = useState<{
    startDate: string;
    startTime: string;
    finishTime: string;
    defaultTechnician: string;
  }>({
    startDate: "",
    startTime: "",
    finishTime: "",
    defaultTechnician: "",
  });

  const resetEditValues = () => {
    setEditValues({
      date: dayjs(selectedDate).format("YYYY-MM-DD"),
      start: "",
      end: "",
      techId: ""
    });
  };

  const refreshGrid = () => {
    const techniciansList = resources.filter((r): r is Technician => r.resourceType === "technician");
    setTechnicians(techniciansList);

    const appointmentsList = resources.filter((r) => r.resourceType === "appointment");
    const dateStr = dayjs(selectedDate).format("YYYY-MM-DD");
    let filteredAppointments = appointmentsList.filter((apt) =>
      dayjs(apt.scheduled_start_datetime).format("YYYY-MM-DD") === dateStr
    );

    if (filters) {
      if (filters.location) {
        filteredAppointments = filteredAppointments.filter((apt) => apt.location === filters.location);
      }
      if (filters.appointment) {
        filteredAppointments = filteredAppointments.filter((apt) => apt.name === filters.appointment);
      }
      if (filters.technician) {
        filteredAppointments = filteredAppointments.filter((apt) =>
          apt.service_technicians?.some(st => st.service_technician === filters.technician)
        );
      }
    }

    const appointmentResources = filteredAppointments.flatMap((appointment) => {
      if (appointment.service_technicians && appointment.service_technicians.length > 0) {
        return appointment.service_technicians.map(st => ({
          ...appointment,
          service_technician: { service_technician: st.service_technician, full_name: st.full_name },
          name: st.name,
          appointment: appointment.name,
          technicianId: st.service_technician,
        }));
      }
      return [];
    });

    setAppointments(appointmentResources);
    setGridKey(Date.now());
  };

  useEffect(() => {
    if (resources.length === 0) {
      const timer = setTimeout(() => {
        setFetchError(true);
      }, 120000);
      return () => clearTimeout(timer);
    } else {
      setFetchError(false);
    }
  }, [resources]);

  useEffect(() => {
    setMounted(true);
    refreshGrid();
  }, [mounted, selectedDate, filters, resources]);

  const filteredTechnicians = technicians.filter(
    (tech) =>
      searchTerm === "" ||
      tech.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (tech.specialization && tech.specialization.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const timeToColumn = (time: string): number => {
    const date = dayjs(time);
    const minutes = date.hour() * MINUTES_PER_HOUR + date.minute() - DAY_START;
    return Math.max(0, Math.min(minutes, TOTAL_MINUTES));
  };

  const columnToTime = (col: number): string => {
    const totalMinutes = col + DAY_START;
    return dayjs(selectedDate)
      .hour(Math.floor(totalMinutes / MINUTES_PER_HOUR))
      .minute(totalMinutes % MINUTES_PER_HOUR)
      .format("YYYY-MM-DD HH:mm:ss");
  };

  const generateLayout = (): Layout[] => {
    return appointments.map((apt) => {
      const startCol = timeToColumn(apt.scheduled_start_datetime);
      const endCol = timeToColumn(apt.scheduled_finish_datetime);
      const techIndex = technicians.findIndex((t) => t.name === apt.technicianId);
      return {
        i: apt.name,
        x: startCol,
        y: techIndex,
        w: Math.max(endCol - startCol, 15),
        h: 1,
        minW: 15,
        maxW: TOTAL_MINUTES,
        maxH: 1,
        isDraggable: apt.status.toLowerCase() === "scheduled",
        isResizable: apt.status.toLowerCase() === "scheduled",
        resizeHandles: ["e", "w"],
      };
    });
  };

  const isOverlapping = (layout: Layout[], newLayout: Layout): boolean => {
    return layout.some(item =>
      item.i !== newLayout.i &&
      item.y === newLayout.y &&
      newLayout.x < (item.x + item.w) &&
      (newLayout.x + newLayout.w) > item.x
    );
  };

  const handleLayoutChange = (layout: Layout[]) => {};

  const handleDragStop = (layout: Layout[], oldItem: Layout, newItem: Layout) => {
    const appointment = appointments.find((apt) => apt.name === newItem.i);
    if (!appointment || appointment.status.toLowerCase() !== "scheduled") return;
    if (
      newItem.x < 0 ||
      newItem.x + newItem.w > TOTAL_MINUTES ||
      newItem.y < 0 ||
      newItem.y > technicians.length - 1
    ) {
      refreshGrid();
      return;
    }
    const fullStartTime = columnToTime(newItem.x);
    const fullEndTime = columnToTime(newItem.x + newItem.w);
    const formattedStart = dayjs(fullStartTime).format("HH:mm");
    const formattedEnd = dayjs(fullEndTime).format("HH:mm");
    const techId = technicians[newItem.y]?.name;
    if (techId && !isOverlapping(layout, newItem)) {
      openEditDialog(appointment, formattedStart, formattedEnd, techId);
    }
  };

  const handleResizeStop = (layout: Layout[], oldItem: Layout, newItem: Layout) => {
    const appointment = appointments.find((apt) => apt.name === newItem.i);
    if (!appointment || appointment.status.toLowerCase() !== "scheduled") return;
    if (
      newItem.x < 0 ||
      newItem.x + newItem.w > TOTAL_MINUTES ||
      newItem.y < 0 ||
      newItem.y > technicians.length - 1
    ) {
      refreshGrid();
      return;
    }
    const fullStartTime = columnToTime(newItem.x);
    const fullEndTime = columnToTime(newItem.x + newItem.w);
    const formattedStart = dayjs(fullStartTime).format("HH:mm");
    const formattedEnd = dayjs(fullEndTime).format("HH:mm");
    const techId = technicians[newItem.y]?.name;
    if (techId && !isOverlapping(layout, newItem)) {
      openEditDialog(appointment, formattedStart, formattedEnd, techId);
    }
  };

  const openEditDialog = (
    apt: AppointmentWithTechnician,
    newStart: string,
    newEnd: string,
    techId: string
  ) => {
    setEditValues({
      date: dayjs(selectedDate).format("YYYY-MM-DD"),
      start: newStart,
      end: newEnd,
      techId,
    });

    const isTeamEvent = apt.service_technicians && apt.service_technicians.length > 1;

    if (isTeamEvent) {
      setPendingUpdate({ appointment: apt, newStart, newEnd, newTechId: techId });
      setShowTeamDialog(true);
    } else {
      setPendingUpdate({ appointment: apt, newStart, newEnd, newTechId: techId, techReadOnly: !isTeamEvent });
      setShowTeamDialog(false);
    }
  };

  const handleEventClick = (apt: AppointmentWithTechnician) => {
    const status = apt.status.toLowerCase();
    if (status === "open" || status === "scheduled") {
      const startTime = dayjs(apt.scheduled_start_datetime).format("HH:mm");
      const endTime = dayjs(apt.scheduled_finish_datetime).format("HH:mm");
      const techId = apt.technicianId;
      const isTeamEvent = apt.service_technicians && apt.service_technicians.length > 1;
      if (isTeamEvent) {
        setEditValues({
          date: dayjs(selectedDate).format("YYYY-MM-DD"),
          start: startTime,
          end: endTime,
          techId,
        });
        setPendingUpdate({ appointment: apt, newStart: startTime, newEnd: endTime, newTechId: techId });
        setShowTeamDialog(true);
      } else {
        setEditValues({
          date: dayjs(selectedDate).format("YYYY-MM-DD"),
          start: startTime,
          end: endTime,
          techId,
        });
        setPendingUpdate({ appointment: apt, newStart: startTime, newEnd: endTime, newTechId: techId, techReadOnly: false });
        setShowTeamDialog(false);
      }
    } else {
      setDetailsResource(apt);
      setDetailsDialogOpen(true);
    }
  };

  const confirmUpdate = () => {
    if (!pendingUpdate) return;
    const { appointment } = pendingUpdate;
    const originalStart = dayjs(appointment.scheduled_start_datetime).format("YYYY-MM-DD HH:mm:ss");
    const originalEnd = dayjs(appointment.scheduled_finish_datetime).format("YYYY-MM-DD HH:mm:ss");
    const newStartCombined = dayjs(`${editValues.date} ${editValues.start}`, "YYYY-MM-DD HH:mm").format("YYYY-MM-DD HH:mm:ss");
    const newEndCombined = dayjs(`${editValues.date} ${editValues.end}`, "YYYY-MM-DD HH:mm").format("YYYY-MM-DD HH:mm:ss");
    const originalTech = appointment.technicianId;
    const newTech = pendingUpdate.newTechId;

    if (originalStart === newStartCombined && originalEnd === newEndCombined && originalTech === newTech) {
      setPendingUpdate(null);
      setShowTeamDialog(false);
      setValidationErrors([]);
      resetEditValues();
      refreshGrid();
      return;
    }

    const errors: string[] = [];
    const timeRangeResult = validateTimeRange(editValues.start, editValues.end);
    if (timeRangeResult !== true) errors.push(timeRangeResult);
    const durationResult = validateMinimumDuration(editValues.start, editValues.end);
    if (durationResult !== true) errors.push(durationResult);
    const businessResult = validateBusinessHours(editValues.start, editValues.end, "07:00", "19:00");
    if (businessResult !== true) errors.push(businessResult);
    const techResult = validateNonEmptyField(newTech, "Technician");
    if (techResult !== true) errors.push(techResult);

    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors([]);

    const updatedAppointment = {
      ...appointment,
      scheduled_start_datetime: newStartCombined,
      scheduled_finish_datetime: newEndCombined,
      technicianId: newTech,
      service_technician: {
        service_technician: newTech,
        full_name: technicians.find(t => t.name === newTech)?.full_name || ""
      },
    };

    const originalServiceTechs = appointment.service_technicians || [];
    const updatedServiceTechs = originalServiceTechs.filter(
      st => st.service_technician !== originalTech
    );
    if (!updatedServiceTechs.some(st => st.service_technician === newTech)) {
      const newTechObj = technicians.find(t => t.name === newTech);
      if (newTechObj) {
        updatedServiceTechs.push({ service_technician: newTechObj.name, full_name: newTechObj.full_name });
      }
    }    
    
    updateAppointment({
      name: updatedAppointment.appointment,
      scheduled_start_datetime: updatedAppointment.scheduled_start_datetime,
      scheduled_finish_datetime: updatedAppointment.scheduled_finish_datetime,
      service_technicians: updatedServiceTechs,
      items: updatedAppointment.items,
      reschedule: true,
      edit_technician_list: true,
    })
      .then(() => {
        setAppointments(prev =>
          prev.map(appt => {
            if (appt.appointment === appointment.appointment) {
              if (appt.technicianId === originalTech) {
                return {
                  ...appt,
                  scheduled_start_datetime: newStartCombined,
                  scheduled_finish_datetime: newEndCombined,
                  technicianId: newTech,
                  service_technician: updatedAppointment.service_technician,
                };
              }
              return {
                ...appt,
                scheduled_start_datetime: newStartCombined,
                scheduled_finish_datetime: newEndCombined,
              };
            }
            return appt;
          })
        );
      })
      .catch((error) => {
        console.error("Error updating appointment:", error);
      })
      .finally(() => {
        setPendingUpdate(null);
        setShowTeamDialog(false);
        resetEditValues();
      });
  };

  const cancelUpdate = () => {
    setPendingUpdate(null);
    setShowTeamDialog(false);
    setValidationErrors([]);
    resetEditValues();
    refreshGrid();
  };

  const AppointmentContent = forwardRef<HTMLDivElement, { appointment: AppointmentWithTechnician }>(
    ({ appointment }, ref) => (
      <div
        ref={ref}
        className={styles.appointment}
        style={{
          borderLeft: `4px solid ${getStatusColor(appointment.status)}`,
          borderRightColor: getStatusColor(appointment.status),
          backgroundColor: hoveredAppointmentId === appointment.name ? "#f0f9ff" : "#fff",
        }}
        onMouseEnter={() => setHoveredAppointmentId(appointment.name)}
        onMouseLeave={() => setHoveredAppointmentId(null)}
        onClick={() => handleEventClick(appointment)}
      >
        <div className={styles.appointmentHeader}>
          <span className={styles.appointmentName}>
            APP-{appointment.appointment.split("-").slice(-1)}
          </span>
          <div className={styles.statusIcon} style={{ color: getStatusColor(appointment.status) }}>
            {getStatusIcon(appointment.status)}
          </div>
        </div>
        <div className={styles.appointmentBody}>
          <div className={styles.appointmentLocation}>{appointment.location}</div>
          <div className={styles.appointmentTime}>
            {dayjs(appointment.scheduled_start_datetime).format("HH:mm")} -{" "}
            {dayjs(appointment.scheduled_finish_datetime).format("HH:mm")}
          </div>
        </div>
      </div>
    )
  );
  AppointmentContent.displayName = "AppointmentContent";

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case "scheduled": return <Calendar size={16} />;
      case "dispatched": return <Truck size={16} />;
      case "in progress": return <PlayCircle size={16} />;
      case "completed": return <CheckCircle size={16} />;
      case "cancelled": return <XCircle size={16} />;
      case "rescheduled": return <RotateCcw size={16} />;
      default: return <Circle size={16} />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "open": return "#155e75";
      case "scheduled": return "#70ad47";
      case "dispatched": return "#c2410c";
      case "in progress": return "#1e40af";
      case "pending": return "#92400e";
      case "completed": return "#6b21a8";
      case "on hold": return "#1f2937";
      default: return "#7f7f7f";
    }
  };

  let teamDialogProps = null;
  if (pendingUpdate && showTeamDialog) {
    const oldTech = technicians.find(t => t.name === pendingUpdate.appointment.technicianId);
    const newTech = technicians.find(t => t.name === pendingUpdate.newTechId);
    const otherAssignedTechs = (pendingUpdate.appointment.service_technicians || []).filter(
      st => st.service_technician !== pendingUpdate.appointment.technicianId
    );
    teamDialogProps = { 
      oldTech, 
      newTech, 
      otherAssignedTechs,
      newStart: pendingUpdate.newStart,
      newEnd: pendingUpdate.newEnd
    };
  }

  if (resources.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        {!fetchError ? (
          <div className="flex flex-col items-center">
            <Loader className="animate-spin h-10 w-10 text-gray-600" />
            <div className="mt-4 text-gray-700">Fetching Resources...</div>
          </div>
        ) : (
          <div className="text-red-600 text-lg">Failed to fetch resources</div>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader className="animate-spin h-8 w-8" />
      </div>
    );
  }

  // NEW: Grid click handler to trigger the Create Dialog.
  const handleGridClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Ignore clicks on an existing appointment element.
    if ((e.target as HTMLElement).closest(`.${styles.appointment}`)) return;

    const gridRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const clickX = e.clientX - gridRect.left;
    const clickY = e.clientY - gridRect.top;

    // Determine the time column based on container width.
    const containerWidth = gridRect.width;
    const colIndex = Math.floor((clickX / containerWidth) * COLS);

    // Determine the technician row using the known row height.
    const rowIndex = Math.floor(clickY / 80); // rowHeight is 80
    if (rowIndex < 0 || rowIndex >= technicians.length) return;
    const tech = technicians[rowIndex];

    const fullStartTime = columnToTime(colIndex);
    const formattedStartTime = dayjs(fullStartTime).format("HH:mm");
    const formattedFinishTime = dayjs(fullStartTime).add(1, "hour").format("HH:mm");
    const startDateStr = dayjs().format("YYYY-MM-DD");

    setCreatePrefill({
      startDate: startDateStr,
      startTime: formattedStartTime,
      finishTime: formattedFinishTime,
      defaultTechnician: tech.name,
    });
    setShowCreateDialog(true);
  };

  return (
    <div className={styles.eventsGridContainer}>
      <div className={styles.header}>
        <div className={styles.techHeader}>
          <Input
            placeholder="Search technicians..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-8"
          />
        </div>
        <div className={styles.timeLabels}>
          {HOURS.map((hour) => (
            <div key={hour} className={styles.timeLabel}>
              {hour.toString().padStart(2, "0")}:00
            </div>
          ))}
        </div>
      </div>

      <div className={styles.gridContainer}>
        <div className={styles.techList}>
          {filteredTechnicians.map((tech) => (
            <div key={tech.name} className={styles.techItem}>
              <div className="font-medium">{tech.full_name}</div>
              <div className="text-xs text-muted-foreground">{tech.specialization}</div>
            </div>
          ))}
        </div>

        <div className={styles.gridWrapper} onClick={handleGridClick}>
          <ResponsiveGridLayout
            key={gridKey}
            className="layout"
            layouts={{ lg: generateLayout() }}
            breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
            cols={{ lg: COLS, md: COLS, sm: COLS, xs: COLS, xxs: COLS }}
            rowHeight={80}
            margin={[0, 0]}
            containerPadding={[0, 0]}
            maxRows={technicians.length || 1}
            onLayoutChange={handleLayoutChange}
            onDragStop={handleDragStop}
            onResizeStop={handleResizeStop}
            useCSSTransforms={true}
            preventCollision
            compactType={null}
            resizeHandles={["w", "e"]}
            transformScale={1}
          >
            {appointments.map((appointment) => (
              <div
                key={appointment.name}
                className="relative"
                style={{
                  position: "relative",
                  zIndex: hoveredAppointmentId === appointment.name ? 20 : 1,
                }}
              >
                <Tippy
                  content={
                    <div className="bg-white p-2 rounded-lg shadow border border-gray-200 max-w-[300px] text-xs">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{appointment.appointment}</span>
                          <Badge variant="outline" className="text-xs" style={{ backgroundColor: getStatusColor(appointment.status), color: "white" }}>
                            {appointment.status}
                          </Badge>
                        </div>
                        <div className="space-y-1 text-xs text-gray-600">
                          {renderField("Customer", appointment.customer)}
                          {renderField("Location", appointment.location)}
                          {renderField("Time", `${dayjs(appointment.scheduled_start_datetime).format("HH:mm")} - ${dayjs(appointment.scheduled_finish_datetime).format("HH:mm")}`)}
                        </div>
                      </div>
                    </div>
                  }
                  placement="top"
                  arrow={true}
                  theme="light"
                  offset={[0, 10]}
                  zIndex={9999}
                  interactive={true}
                  appendTo={() => document.body}
                >
                  <AppointmentContent appointment={appointment} />
                </Tippy>
              </div>
            ))}
          </ResponsiveGridLayout>
        </div>
      </div>

      {pendingUpdate && !showTeamDialog && (
        <EditAppointment
          editValues={editValues}
          handleChange={(field, value) => setEditValues({ ...editValues, [field]: value })}
          technicians={technicians}
          onCancel={cancelUpdate}
          onConfirm={confirmUpdate}
          techReadOnly={pendingUpdate.techReadOnly || false}
          errorMessages={validationErrors}
        />
      )}

      {showTeamDialog && pendingUpdate && teamDialogProps && (
        <TeamUpdateDialog
          oldTech={teamDialogProps.oldTech!}
          newTech={teamDialogProps.newTech!}
          newStart={editValues.start}
          newEnd={editValues.end}
          otherAssignedTechs={teamDialogProps.otherAssignedTechs}
          onTimeChange={(field, value) => setEditValues({ ...editValues, [field]: value })}
          onConfirm={confirmUpdate}
          onCancel={cancelUpdate}
          errorMessages={validationErrors}
        />
      )}

      {detailsDialogOpen && detailsResource && (
        <ResourceDetailsDialog
          resource={detailsResource}
          isOpen={detailsDialogOpen}
          onClose={() => { setDetailsResource(null); setDetailsDialogOpen(false); }}
        />
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

// Helper function for tooltip fields.
function renderField(label: string, value: any) {
  return (
    <div className="flex text-xs">
      <span className="font-medium w-20">{label}:</span>
      <span>{value?.toString() || "-"}</span>
    </div>
  );
}
