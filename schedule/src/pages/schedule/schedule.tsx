"use client";

import { ScheduleLeftPanel } from "../../components/schedule/schedule-left-panel";
import { ScheduleRightPanel } from "../../components/schedule/schedule-right-panel";
import { TechniciansView } from "../../components/schedule/technicians-view";
import { SettingsView } from "../../components/schedule/settings-view";
import { SidebarMenu } from "../../components/layout/sidebar-menu";
import { useScheduleStore } from "../../store";
import { fetchAppointmentsWithFilter } from "../../hooks/use-appointments";
import { Toaster } from "../../components/ui/sonner";
import { useEffect, useState } from "react";

export default function SchedulePage() {
  const [direction, setDirection] = useState<'ltr' | 'rtl'>('ltr');

  // Check document direction on mount and when it changes
  useEffect(() => {
    const updateDirection = () => {
      const dir = document.documentElement.dir || 'ltr';
      setDirection(dir as 'ltr' | 'rtl');
    };

    updateDirection();

    // Watch for changes to document direction
    const observer = new MutationObserver(updateDirection);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['dir'],
    });

    return () => observer.disconnect();
  }, []);

  const {
    appointments,
    loading,
    selectedAppointments,
    selectedDate,
    appointmentDateRange,
    statusFilter,
    viewType,
    selectedAppointment,
    leftPanelView,
    settingsView,
    setAppointments,
    setLoading,
    setSelectedAppointments,
    setSelectedDate,
    setAppointmentDateRange,
    setStatusFilter,
    setViewType,
    setSelectedAppointment,
    setLeftPanelView,
    setSettingsView,
    toggleAppointmentSelection,
    selectAllAppointments,
    clearSelectedAppointments,
  } = useScheduleStore();

  useEffect(() => {
    loadAppointments();
  }, [appointmentDateRange.startDate, appointmentDateRange.endDate, statusFilter]);

  const loadAppointments = async () => {
    try {
      setLoading(true);
      const data = await fetchAppointmentsWithFilter(
        appointmentDateRange.startDate,
        appointmentDateRange.endDate,
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
    if (checked) {
      if (!selectedAppointments.includes(appointmentId)) {
        setSelectedAppointments([...selectedAppointments, appointmentId]);
      }
    } else {
      setSelectedAppointments(selectedAppointments.filter(id => id !== appointmentId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      selectAllAppointments(appointments.map(apt => apt.name));
    } else {
      clearSelectedAppointments();
    }
  };

  const handleMassActionComplete = () => {
    clearSelectedAppointments();
    loadAppointments();
  };

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden" dir={direction}>
      {/* Left Sidebar Menu */}
      <SidebarMenu
        onTechniciansClick={() => {
          setLeftPanelView("technicians");
          setSettingsView(false);
        }}
        onScheduleClick={() => {
          setLeftPanelView("appointments");
          setSettingsView(false);
        }}
        onSettingsClick={() => {
          setSettingsView(true);
        }}
      />

      {settingsView ? (
        /* Settings View - Full Width */
        <div className="flex-1 flex flex-col overflow-hidden">
          <SettingsView onBack={() => setSettingsView(false)} />
        </div>
      ) : (
        <>
          {/* Left Panel - 20% */}
          <div className="w-[20%] border-r border-border flex flex-col">
            {leftPanelView === "appointments" ? (
              <ScheduleLeftPanel
                appointments={appointments}
                loading={loading}
                selectedAppointments={selectedAppointments}
                statusFilter={statusFilter}
                appointmentDateRange={appointmentDateRange}
                onStatusFilterChange={setStatusFilter}
                onDateRangeChange={setAppointmentDateRange}
                onAppointmentSelect={handleAppointmentSelect}
                onSelectAll={handleSelectAll}
                onAppointmentClick={setSelectedAppointment}
                onMassActionComplete={handleMassActionComplete}
              />
            ) : (
              <TechniciansView
                appointments={appointments}
                onAppointmentClick={setSelectedAppointment}
              />
            )}
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
              statusFilter={statusFilter}
            />
          </div>
        </>
      )}

      <Toaster />
    </div>
  );
}
