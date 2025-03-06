export type AppointmentType = {
  id: string
  start: Date
  end: Date
  title: string
  description: string
  address: string
  customerName: string
  serviceType: "repair" | "installation" | "maintenance" | "inspection" | "off-period"
  status: "scheduled" | "in-progress" | "completed" | "cancelled"
  priority: "low" | "medium" | "high" | "urgent"
}

export type CalendarViewType = "day" | "week" | "month" | "year" | "agenda"

interface BaseResource {
  id: number
  name: string
  modified: number
  resourceType: string
}

export interface Technician extends BaseResource {
  resourceType: "technician"
  name: string
  docstatus: number
  full_name: string
  employee: string
  service_technician: string
  service_area: string
  specialization: string
  yearsOfExperience: number
  events: {
    id: number
    title: string
    start: Date
    end: Date
    type: string
  }[]
}

export interface Order extends BaseResource {
  name: string
  docstatus: number
  resourceType: "order"
  type: string
  posting_date: string
  customer: string
  status: string
  priority: string
  address_details: string
  items: {
    item_code: string
    item_name: string
    qty: number
  }[]
  due_date: string
}

export interface Appointment extends BaseResource {
  name: string
  docstatus: number
  resourceType: "appointment"
  posting_date: string
  status: string
  title: string
  customer: string
  service_type: string
  priority: string
  scheduled_start_datetime: string
  scheduled_finish_datetime: string
  location: string
  startDate: string
  startTime: string
  finishTime: string
  technician: string
  description: string
  service_order: string
  service_technicians: Technician[]
  items: {
    item_code: string
    qty: number
  }[]
}

export interface AppointmentPrefill {}
  

export type Resource = Technician | Order | Appointment 
