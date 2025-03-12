/*
 * This module provides helper functions to update a Service Appointment
 * document and to fetch available Items using Frappe REST API.
 *
 * The updateAppointment function sends a POST request to update only
 * specific fields.
 *
 * The fetchItems function fetches Item doctype records.
 */


export interface CreateAppointmentPayload {
    posting_date: string;
    service_order: string;
    customer: string;
    scheduled_start_datetime?: string;
    scheduled_finish_datetime?: string;
    service_technicians?: any[] | Record<string, any>;
    items?: any[];
    changed_status?: string;
}

export interface UpdateAppointmentPayload {
    name: string;
    scheduled_start_datetime?: string;
    scheduled_finish_datetime?: string;
    service_technicians?: any[] | Record<string, any>;
    items?: any[];
    changed_status?: string;
    reschedule?: boolean;
    edit_item_list?: boolean;
    edit_technician_list?: boolean;
}

export async function createAppointment(
    payload: CreateAppointmentPayload
): Promise<any> {
    try {
        const response = await fetch(
            '/api/method/beveren_fsm.field_service_management.api.schedule.create_appointment_from_api',
            {
                method: "POST",
                headers: {
                    "X-Frappe-CSRF-Token": window.csrf_token,
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                },
                body: JSON.stringify(payload),

            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to Create Appointment: ${errorText}`);
        }

        const data = await response.json();
        return data.message;
        
    } catch (error) {
        console.error("Error Creating Appointment:", error);
        throw error;
    }
}

export async function updateAppointment(
    payload: UpdateAppointmentPayload
): Promise<any> {
    try {
        const response = await fetch(
            '/api/method/beveren_fsm.field_service_management.api.schedule.update_appointment_from_api',
            {
                method: "POST",
                headers: {
                    "X-Frappe-CSRF-Token": window.csrf_token,
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                },
                body: JSON.stringify(payload),

            }
        );

        if (!response.ok) {            
            const errorText = await response.text();
            throw new Error(`Failed to update appointment: ${errorText}`);
        }

        const data = await response.json();
        return data.message;
    } catch (error) {
        console.error("Error Updating Appointment:", error);
        throw error;
    }
}


export const fetchItems = async (): Promise<any[]> => {
    try {
        const headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
        };
        // First fetch the list (names only)
        const listResponse = await fetch(
            '/api/resource/Item?fields=["name"]',
            { headers }
        );
        const listData = await listResponse.json();
        if (!listData.data) throw new Error("No Items found");

        // Then fetch the detailed data for each order
        const detailedItems = await Promise.all(
            listData.data.map(async (item: { name: string }) => {
                const response = await fetch(
                    `/api/resource/Item/${item.name}`,
                    { headers }
                );
                const data = await response.json();
                return data.data;
            })


        );
        return detailedItems.map((item) => ({ ...item }));
    } catch (err) {
        throw new Error(err instanceof Error ? err.message : "An error occurred");
    }
};



