"use client";

import { useState, useEffect } from "react";
import { ScheduleLeftPanel } from "../../components/schedule/schedule-left-panel";
import { ScheduleRightPanel } from "../../components/schedule/schedule-right-panel";
import { Appointment } from "./types";
import { fetchAppointmentsWithFilter } from "../../hooks/use-appointments";
import { Toaster } from "../../components/ui/sonner";

export default function SchedulePage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selectedAppointments, setSelectedAppointments] = useState<Set<string>>(new Set());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewType, setViewType] = useState<"gantt" | "grid" | "maps" | "calendar">("gantt");

  useEffect(() => {
    loadAppointments();
  }, [selectedDate, statusFilter]);

  const loadAppointments = async () => {
    try {
      setLoading(true);
      const data = await fetchAppointmentsWithFilter(
        selectedDate,
        statusFilter !== "all" ? statusFilter : undefined
      );
      setAppointments(data);
    } catch (error) {
      console.error("Error loading appointments:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAppointmentSelect = (appointmentId: string, checked: boolean) => {
    const newSelected = new Set(selectedAppointments);
    if (checked) {
      newSelected.add(appointmentId);
    } else {
      newSelected.delete(appointmentId);
    }
    setSelectedAppointments(newSelected);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedAppointments(new Set(appointments.map(apt => apt.name)));
    } else {
      setSelectedAppointments(new Set());
    }
  };

  const handleAppointmentClick = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
  };

  const handleMassActionComplete = () => {
    setSelectedAppointments(new Set());
    loadAppointments();
  };

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      {/* Left Panel - 25% */}
      <div className="w-[25%] border-r border-border flex flex-col">
        <ScheduleLeftPanel
          appointments={appointments}
          loading={loading}
          selectedAppointments={selectedAppointments}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          onAppointmentSelect={handleAppointmentSelect}
          onSelectAll={handleSelectAll}
          onAppointmentClick={handleAppointmentClick}
          onMassActionComplete={handleMassActionComplete}
        />
      </div>

      {/* Right Panel - 75% */}
      <div className="flex-1 flex flex-col">
        <ScheduleRightPanel
          appointments={appointments}
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          viewType={viewType}
          onViewTypeChange={setViewType}
          selectedAppointment={selectedAppointment}
          onAppointmentSelect={setSelectedAppointment}
          onRefresh={loadAppointments}
        />
      </div>

      <Toaster />
    </div>
  );
}
