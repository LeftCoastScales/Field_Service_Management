import { useState, useEffect } from "react";
import { Appointment } from "../pages/schedule/types";

export async function fetchAppointmentsWithFilter(
  date: Date,
  status?: string
): Promise<Appointment[]> {
  try {
    const dateStr = date.toISOString().split("T")[0];
    const filters: Record<string, any> = {
      posting_date: dateStr,
    };

    if (status) {
      filters.status = status;
    }

    // Build filter query
    const filterJson = JSON.stringify(filters);
    const fields = JSON.stringify([
      "name",
      "service_order",
      "customer",
      "status",
      "scheduled_start_datetime",
      "scheduled_finish_datetime",
      "posting_date",
      "service_type",
      "description",
    ]);

    const url = `/api/resource/Service Appointment?fields=${fields}&filters=${encodeURIComponent(filterJson)}&limit_page_length=0`;

    const headers = {
      Accept: "application/json",
      "Content-Type": "application/json",
    };

    const response = await fetch(url, { headers });
    const data = await response.json();

    if (!data.data) {
      return [];
    }

    // Fetch detailed data for each appointment to get service_technicians
    const detailedAppointments = await Promise.all(
      data.data.map(async (app: { name: string }) => {
        const detailResponse = await fetch(
          `/api/resource/Service Appointment/${app.name}`,
          { headers }
        );
        const detailData = await detailResponse.json();
        return detailData.data;
      })
    );

    return detailedAppointments.map((apt: any) => ({
      ...apt,
      service_technicians: apt.service_technicians || [],
    }));
  } catch (error) {
    console.error("Error fetching appointments:", error);
    throw error;
  }
}

export async function fetchTechnicians(): Promise<any[]> {
  try {
    const headers = {
      Accept: "application/json",
      "Content-Type": "application/json",
    };

    const response = await fetch(
      '/api/resource/Service Technician?fields=["name","full_name","employee","service_area","specialization"]&limit_page_length=0',
      { headers }
    );
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error("Error fetching technicians:", error);
    throw error;
  }
}

export async function bulkAssignTechnicians(
  appointmentIds: string[],
  technicianIds: string[]
): Promise<void> {
  try {
    const payload = {
      appointment_ids: appointmentIds,
      technician_ids: technicianIds,
    };

    const response = await fetch(
      "/api/method/beveren_fsm.field_service_management.api.schedule.bulk_assign_technicians",
      {
        method: "POST",
        headers: {
          "X-Frappe-CSRF-Token": (window as any).csrf_token,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      throw new Error("Failed to assign technicians");
    }
  } catch (error) {
    console.error("Error assigning technicians:", error);
    throw error;
  }
}

export async function bulkRemoveTechnicians(appointmentIds: string[]): Promise<void> {
  try {
    const payload = {
      appointment_ids: appointmentIds,
    };

    const response = await fetch(
      "/api/method/beveren_fsm.field_service_management.api.schedule.bulk_remove_technicians",
      {
        method: "POST",
        headers: {
          "X-Frappe-CSRF-Token": (window as any).csrf_token,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      throw new Error("Failed to remove technicians");
    }
  } catch (error) {
    console.error("Error removing technicians:", error);
    throw error;
  }
}
