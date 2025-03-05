"use client"

import { useState, useEffect } from "react"
import { useCalendar } from "../../lib/context"
import { Calendar } from "../../components/calendar/ui/calendar"
import { Badge } from "../../components/calendar/ui/badge"
import { ScrollArea } from "../../components/calendar/ui/scroll-area"
import { Clock, MapPin, User } from "lucide-react"

const serviceTypes = [
  "HVAC Repair",
  "Plumbing Installation",
  "Electrical Maintenance",
  "Appliance Repair",
  "Home Security Setup",
  "Pest Control",
  "Carpet Cleaning",
  "Window Installation",
  "Roof Inspection",
  "Landscaping",
]

export default function Sidebar() {
  const { appointments, currentDate, setCurrentDate, searchTerm, selectedTechnician } = useCalendar()
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(currentDate)

  useEffect(() => {
    setSelectedDate(currentDate)
  }, [currentDate])

  const filteredAppointments = appointments.filter(
    (app) =>
      (app.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        app.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        app.address.toLowerCase().includes(searchTerm.toLowerCase())) &&
      (!selectedTechnician || app.id.includes(selectedTechnician.id)),
  )

  const handleSelect = (date: Date | undefined) => {
    setSelectedDate(date)
    if (date) setCurrentDate(date)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "scheduled":
        return "bg-blue-100 text-blue-800"
      case "dispatched":
        return "bg-yellow-100 text-yellow-800"
      case "in-progress":
        return "bg-green-100 text-green-800"
      case "completed":
        return "bg-gray-100 text-gray-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const capitalizeFirstLetter = (string: string) => {
    return string.charAt(0).toUpperCase() + string.slice(1)
  }

  return (
    <div className="w-full md:w-72 bg-white overflow-hidden flex-shrink-0 border-r border-gray-200 flex flex-col h-full">
      <div className="p-2 flex-shrink-0">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleSelect}
          className="rounded-md border"
          classNames={{
            months: "space-y-2",
            month: "space-y-2",
            caption: "flex justify-center pt-1 relative items-center text-xs",
            caption_label: "text-xs font-medium",
            nav: "space-x-1 flex items-center",
            nav_button: "h-6 w-6 bg-transparent p-0 opacity-50 hover:opacity-100",
            nav_button_previous: "absolute left-1",
            nav_button_next: "absolute right-1",
            table: "w-full border-collapse space-y-1",
            head_row: "flex justify-center",
            head_cell: "text-muted-foreground rounded-md w-7 font-normal text-[0.6rem] text-center",
            row: "flex w-full mt-1 justify-center",
            cell: "text-center text-xs p-0 relative [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
            day: "h-7 w-7 p-0 font-normal aria-selected:opacity-100 rounded-full",
            day_selected:
              "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
            day_today: "bg-accent text-accent-foreground",
            day_outside: "text-muted-foreground opacity-50",
            day_disabled: "text-muted-foreground opacity-50",
            day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
            day_hidden: "invisible",
          }}
        />
      </div>
      <ScrollArea className="flex-grow">
        <div className="p-2 space-y-3">
          {filteredAppointments.map((appointment, index) => (
            <div
              key={appointment.id}
              className="p-3 rounded-lg bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200"
            >
              <div className="flex justify-between items-start mb-1">
                <h3 className="font-semibold text-sm">{serviceTypes[index % serviceTypes.length]}</h3>
                <Badge className={`${getStatusColor(appointment.status)} text-[0.6rem] px-1 py-0`}>
                  {capitalizeFirstLetter(appointment.status.replace("-", " "))}
                </Badge>
              </div>
              <div className="space-y-1 text-[0.7rem]">
                <div className="flex items-center text-gray-600">
                  <Clock className="w-3 h-3 mr-1" />
                  {appointment.start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} -{" "}
                  {appointment.end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
                <div className="flex items-center text-gray-600">
                  <User className="w-3 h-3 mr-1" />
                  {appointment.customerName}
                </div>
                <div className="flex items-center text-gray-600">
                  <MapPin className="w-3 h-3 mr-1" />
                  {appointment.address}
                </div>
              </div>
              <div className="mt-2 text-[0.65rem] text-gray-500">{appointment.description}</div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}

