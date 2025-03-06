/*
 * This module provides helper functions to update a Service Appointment
 * document and to fetch available Items using Frappe REST API.
 *
 * The updateAppointment function sends a POST request to update only
 * specific fields.
 *
 * The fetchItems function fetches Item doctype records.
 */

export interface UpdateAppointmentPayload {
    name: string;
    scheduled_start_datetime?: string;
    scheduled_finish_datetime?: string;
    service_technicians?: any[];
    items?: any[];
}

export async function updateAppointment(
    payload: UpdateAppointmentPayload
): Promise<any> {
    try {
        const response = await fetch(
            '/api/method/beveren_fsm.field_service_management.fsm_utils.update_appointment_from_api',
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                },
                body: JSON.stringify(payload),

            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to get logged in user: ${errorText}`);
        }

        const data = await response.json();
        return data.message;
    } catch (error) {
        console.error("Error getting logged in user:", error);
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



