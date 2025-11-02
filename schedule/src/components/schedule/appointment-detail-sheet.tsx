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

interface AppointmentDetailSheetProps {
  appointment: Appointment;
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

export function AppointmentDetailSheet({
  appointment,
  open,
  onOpenChange,
}: AppointmentDetailSheetProps) {
  const formatDateTime = (dateString: string) => {
    try {
      return format(new Date(dateString), "PPP p");
    } catch {
      return dateString;
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <SheetTitle>Appointment Details</SheetTitle>
            <Badge
              variant="outline"
              className={getStatusColor(appointment.status)}
            >
              {appointment.status}
            </Badge>
          </div>
          <SheetDescription>
            {appointment.service_order || appointment.name}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Basic Information */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Basic Information</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Appointment ID:</span>
                <span className="font-medium">{appointment.name}</span>
              </div>
              {appointment.service_order && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Service Order:</span>
                  <span className="font-medium">{appointment.service_order}</span>
                </div>
              )}
              {appointment.customer && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Customer:</span>
                  <span className="font-medium">{appointment.customer}</span>
                </div>
              )}
              {appointment.service_type && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Service Type:</span>
                  <span className="font-medium">{appointment.service_type}</span>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Scheduling Information */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Scheduling</h3>
            <div className="space-y-2 text-sm">
              {appointment.scheduled_start_datetime && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Scheduled Start:</span>
                  <span className="font-medium">
                    {formatDateTime(appointment.scheduled_start_datetime)}
                  </span>
                </div>
              )}
              {appointment.scheduled_finish_datetime && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Scheduled Finish:</span>
                  <span className="font-medium">
                    {formatDateTime(appointment.scheduled_finish_datetime)}
                  </span>
                </div>
              )}
              {appointment.posting_date && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Posting Date:</span>
                  <span className="font-medium">
                    {format(new Date(appointment.posting_date), "PPP")}
                  </span>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Technicians */}
          {appointment.service_technicians && appointment.service_technicians.length > 0 && (
            <>
              <div>
                <h3 className="text-sm font-semibold mb-3">Assigned Technicians</h3>
                <div className="space-y-2">
                  {appointment.service_technicians.map((tech, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 p-2 bg-muted rounded-md"
                    >
                      <span className="text-sm font-medium">{tech.full_name}</span>
                      {tech.service_technician && (
                        <span className="text-xs text-muted-foreground">
                          ({tech.service_technician})
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <Separator />
            </>
          )}

          {/* Description */}
          {appointment.description && (
            <div>
              <h3 className="text-sm font-semibold mb-3">Description</h3>
              <p className="text-sm text-muted-foreground">{appointment.description}</p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
