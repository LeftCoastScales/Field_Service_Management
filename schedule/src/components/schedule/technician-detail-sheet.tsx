"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../ui/sheet";
import { Badge } from "../ui/badge";
import { Appointment } from "../../pages/schedule/types";
import { format } from "date-fns";
import { Separator } from "../ui/separator";
import { useMemo } from "react";

interface Technician {
  name: string;
  full_name: string;
  employee?: string;
  service_area?: string;
  specialization?: string;
}

interface TechnicianDetailSheetProps {
  technician: Technician | null;
  appointments: Appointment[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAppointmentClick: (appointment: Appointment) => void;
}

const getStatusColor = (status: string): string => {
  const colors: Record<string, string> = {
    Open: "bg-blue-100 text-blue-800 border-blue-300",
    Scheduled: "bg-blue-100 text-blue-800 border-blue-300",
    Dispatched: "bg-orange-100 text-orange-800 border-orange-300",
    "In Progress": "bg-orange-100 text-orange-800 border-orange-300",
    Completed: "bg-green-100 text-green-800 border-green-300",
    Cancelled: "bg-gray-100 text-gray-800 border-gray-300",
  };
  return colors[status] || "bg-gray-100 text-gray-800 border-gray-300";
};

export function TechnicianDetailSheet({
  technician,
  appointments,
  open,
  onOpenChange,
  onAppointmentClick,
}: TechnicianDetailSheetProps) {
  const technicianAppointments = useMemo(() => {
    if (!technician) return [];
    return appointments.filter((apt) =>
      apt.service_technicians?.some((tech) => tech.service_technician === technician.name)
    );
  }, [technician, appointments]);

  // Group appointments by status
  const appointmentsByStatus = useMemo(() => {
    const grouped: Record<string, Appointment[]> = {};
    technicianAppointments.forEach((apt) => {
      const status = apt.status || "Unknown";
      if (!grouped[status]) {
        grouped[status] = [];
      }
      grouped[status].push(apt);
    });
    return grouped;
  }, [technicianAppointments]);

  const formatDateTime = (dateString: string) => {
    try {
      return format(new Date(dateString), "PPP p");
    } catch {
      return dateString;
    }
  };

  if (!technician) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <SheetTitle>Technician Details</SheetTitle>
            <Badge variant="secondary">
              {technicianAppointments.length} {technicianAppointments.length === 1 ? "Appointment" : "Appointments"}
            </Badge>
          </div>
          <SheetDescription>
            {technician.full_name}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Basic Information */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Basic Information</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Technician ID:</span>
                <span className="font-medium">{technician.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Full Name:</span>
                <span className="font-medium">{technician.full_name}</span>
              </div>
              {technician.employee && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Employee:</span>
                  <span className="font-medium">{technician.employee}</span>
                </div>
              )}
              {technician.service_area && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Service Area:</span>
                  <span className="font-medium">{technician.service_area}</span>
                </div>
              )}
              {technician.specialization && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Specialization:</span>
                  <span className="font-medium">{technician.specialization}</span>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Appointment Summary by Status */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Appointment Summary</h3>
            <div className="space-y-3">
              {Object.entries(appointmentsByStatus).map(([status, statusAppointments]) => (
                <div key={status} className="p-3 bg-muted/30 rounded-md">
                  <div className="flex items-center justify-between mb-2">
                    <Badge
                      variant="outline"
                      className={getStatusColor(status)}
                    >
                      {status}
                    </Badge>
                    <span className="text-sm font-medium">
                      {statusAppointments.length} {statusAppointments.length === 1 ? "appointment" : "appointments"}
                    </span>
                  </div>
                  <div className="space-y-2 mt-3">
                    {statusAppointments.slice(0, 5).map((appointment) => (
                      <div
                        key={appointment.name}
                        className="p-2 bg-background rounded-md cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => {
                          onAppointmentClick(appointment);
                          onOpenChange(false);
                        }}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">
                            {appointment.service_order || appointment.name}
                          </span>
                          {appointment.customer && (
                            <span className="text-xs text-muted-foreground">
                              {appointment.customer}
                            </span>
                          )}
                        </div>
                        {appointment.scheduled_start_datetime && (
                          <p className="text-xs text-muted-foreground">
                            {formatDateTime(appointment.scheduled_start_datetime)}
                          </p>
                        )}
                      </div>
                    ))}
                    {statusAppointments.length > 5 && (
                      <p className="text-xs text-muted-foreground text-center pt-1">
                        +{statusAppointments.length - 5} more
                      </p>
                    )}
                  </div>
                </div>
              ))}
              {Object.keys(appointmentsByStatus).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No appointments found for this technician
                </p>
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
