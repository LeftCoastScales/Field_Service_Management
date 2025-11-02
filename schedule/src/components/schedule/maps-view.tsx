"use client";

import { Appointment } from "../../pages/schedule/types";

interface MapsViewProps {
  appointments: Appointment[];
  selectedDate: Date;
  onAppointmentClick?: (appointment: Appointment) => void;
}

export function MapsView({
  appointments,
  selectedDate,
  onAppointmentClick,
}: MapsViewProps) {
  return (
    <div className="flex items-center justify-center h-full bg-muted/20">
      <div className="text-center space-y-2">
        <p className="text-lg font-medium text-muted-foreground">Maps View</p>
        <p className="text-sm text-muted-foreground">
          This view will display appointment locations on a map
        </p>
      </div>
    </div>
  );
}
