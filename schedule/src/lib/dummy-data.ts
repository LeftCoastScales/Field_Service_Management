import type { AppointmentType, Technician } from "./types"

export const technicians: Technician[] = [
  { id: "1", name: "John Doe", avatar: "/avatars/john-doe.jpg" },
  { id: "2", name: "Jane Smith", avatar: "/avatars/jane-smith.jpg" },
  { id: "3", name: "Bob Johnson", avatar: "/avatars/bob-johnson.jpg" },
]

const serviceTypes: AppointmentType["serviceType"][] = ["repair", "installation", "maintenance", "inspection"]
const statuses: AppointmentType["status"][] = ["scheduled", "in-progress", "completed", "cancelled"]
const priorities: AppointmentType["priority"][] = ["low", "medium", "high", "urgent"]

export function generateDummyAppointments(): AppointmentType[] {
  const appointments: AppointmentType[] = []
  const startDate = new Date()
  startDate.setHours(0, 0, 0, 0)

  for (let i = 0; i < 50; i++) {
    const start = new Date(startDate.getTime() + Math.random() * 7 * 24 * 60 * 60 * 1000)
    start.setHours(8 + Math.floor(Math.random() * 8), 0, 0, 0)
    const end = new Date(start.getTime() + (1 + Math.random() * 3) * 60 * 60 * 1000)

    appointments.push({
      id: `appointment-${i + 1}`,
      start,
      end,
      title: `Service ${i + 1}`,
      description: `This is a ${serviceTypes[i % serviceTypes.length]} service.`,
      address: `${1000 + i} Main St, Anytown, USA`,
      customerName: `Customer ${i + 1}`,
      serviceType: serviceTypes[i % serviceTypes.length],
      status: statuses[i % statuses.length],
      priority: priorities[i % priorities.length],
    })
  }

  return appointments
}

