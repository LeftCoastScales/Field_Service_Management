import { Appointment, Technician, Order, Resource } from "./types";

export const fetchAppointments = async (): Promise<Appointment[]> => {
	try {
		const headers = {
			Accept: "application/json",
			"Content-Type": "application/json",
		};
		// First fetch the list (names only) with limit_page_length=0 to return all records
		const listResponse = await fetch(
			'/api/resource/Service Appointment?fields=["name"]&limit_page_length=0',
			{ headers }
		);
		const listData = await listResponse.json();
		if (!listData.data) throw new Error("No appointments found");

		// Then fetch the detailed data for each appointment
		const detailedAppointments = await Promise.all(
			listData.data.map(async (app: { name: string | number }) => {
				const response = await fetch(
					`/api/resource/Service Appointment/${String(app.name)}`,
					{ headers }
				);
				const data = await response.json();
				return data.data;
			})
		);

		return detailedAppointments.map((apt) => ({
			...apt,
			resourceType: "appointment",
		}));
	} catch (err) {
		throw new Error(err instanceof Error ? err.message : "An error occurred");
	}
};

export const fetchTechnicians = async (): Promise<Technician[]> => {
	const headers = {
		Accept: "application/json",
		"Content-Type": "application/json",
	};
	const res = await fetch(
		'/api/resource/Service Technician?fields=["name","full_name","employee","service_area","specialization"]&limit_page_length=0',
		{ headers }
	);
	const data = await res.json();
	if (!data.data) throw new Error("No technicians found");
	return data.data.map((tech: Technician) => ({
		...tech,
		resourceType: "technician",
	}));
};

export const fetchOrders = async (): Promise<Order[]> => {
	try {
		const headers = {
			Accept: "application/json",
			"Content-Type": "application/json",
		};
		// First fetch the list (names only) with limit_page_length=0 to return all records
		const listResponse = await fetch(
			'/api/resource/Service Order?fields=["name"]&limit_page_length=0',
			{ headers }
		);
		const listData = await listResponse.json();
		if (!listData.data) throw new Error("No orders found");

		// Then fetch the detailed data for each order
		const detailedOrders = await Promise.all(
			listData.data.map(async (order: { name: string | number }) => {
				const response = await fetch(
					`/api/resource/Service Order/${String(order.name)}`,
					{ headers }
				);
				const data = await response.json();
				return data.data;
			})
		);
		return detailedOrders.map((order) => ({
			...order,
			resourceType: "order",
		}));
	} catch (err) {
		throw new Error(err instanceof Error ? err.message : "An error occurred");
	}
};

function formatDate(dateString: string): string {
	const [day, month, year] = dateString.split('/');
	const date = new Date(
		parseInt(year, 10),
		parseInt(month, 10) - 1,
		parseInt(day, 10)
	);

	const formattedDate = date.toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
	});
	return formattedDate;
}

export const fetchResources = async (): Promise<Resource[]> => {
	let [appointments, technicians, orders] = await Promise.all([
		fetchAppointments(),
		fetchTechnicians(),
		fetchOrders(),
	]);

	appointments = appointments.map((appointment) => {
		const matchingOrder = orders.find(
			(order) => appointment.service_order === order.name
		);
		return {
			...appointment,
			location: matchingOrder?.address_details?.split('\n')[0] || '',
			startDate: formatDate(
				new Date(appointment.scheduled_start_datetime).toLocaleDateString('en-US')
			),
			startTime: new Date(appointment.scheduled_start_datetime)
				.toLocaleTimeString()
				.slice(0, -3),
			finishTime: new Date(appointment.scheduled_finish_datetime)
				.toLocaleTimeString()
				.slice(0, -3),
		};
	});

	return [...appointments, ...technicians, ...orders];
};
