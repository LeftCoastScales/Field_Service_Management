import { Appointment, Technician, Order, Resource } from "./types";

// Sample locations
const locations = [
  "Corporate HQ", 
  "Downtown Office", 
  "Westside Branch", 
  "North Campus", 
  "Tech Center", 
  "Industrial Park"
];

// Sample appointment names
const appointmentNames = [
  "Network Setup",
  "Fiber Installation",
  "Server Maintenance",
  "Security Audit",
  "System Upgrade",
  "WiFi Configuration",
  "Backup System Check",
  "Cloud Migration",
  "Hardware Installation",
  "Software Update",
  "VoIP Phone Setup",
  "Network Troubleshooting",
  "Firewall Configuration",
  "Data Recovery",
  "Printer Setup",
  "Cable Management",
];

// Sample technician names
export const technicianNames = [
  "John Smith",
  "Emma Johnson",
  "Michael Brown",
  "Olivia Davis",
  "William Wilson",
  "Sophia Martinez",
  "James Anderson",
  "Isabella Taylor",
  "Robert Thomas",
  "Ava Garcia",
  "David Hernandez",
  "Mia Lopez",
  "Joseph Perez",
  "Charlotte Adams",
];

// Create mock technicians
export const mockTechnicians: Technician[] = technicianNames.map((name, i) => ({
  id: i + 1,
  name,
  type: "technician",
  location: ["Seattle", "Portland", "San Francisco", "Los Angeles", "Chicago"][i % 5],
  specialization: [
    "Network Infrastructure",
    "Security Systems",
    "Fiber Optics",
    "Wireless Networks",
    "VoIP Systems"
  ][i % 5],
  yearsOfExperience: 2 + Math.floor(Math.random() * 15),
  events: []
}));

// Create mock appointments between Feb 28 and Mar 5
export const mockAppointments: Appointment[] = [];

// Create sample appointment data for Feb 28 - Mar 5
import dayjs from "dayjs";

const today = dayjs();
const dateRange = Array.from({ length: 7 }, (_, i) =>
  today.add(i - 3, "day").format("YYYY-MM-DD")
);

// Generate several appointments for each date with technicians
let appointmentId = 100;

// For each date, create 3-5 appointments
dateRange.forEach(date => {
  // Each technician gets 1-2 appointments per day
  mockTechnicians.forEach((tech, techIndex) => {
    // How many appointments for this technician on this date (0-2)
    const appointmentsCount = Math.floor(Math.random() * 3);
    
    for (let i = 0; i < appointmentsCount; i++) {
      // Create staggered time slots throughout the day
      const baseHour = 7 + ((techIndex * 2 + i) % 10); // 7am-5pm spread across technicians
      const startMinute = [0, 15, 30, 45][Math.floor(Math.random() * 4)];
      
      // Duration between 1.5 and 3 hours
      const durationHours = 1.5 + Math.random() * 1.5;
      
      // Calculate end time
      const endHour = baseHour + Math.floor(durationHours);
      const endMinute = startMinute + Math.floor((durationHours % 1) * 60);
      
      // Adjust for minute overflow
      const adjustedEndHour = endHour + Math.floor(endMinute / 60);
      const adjustedEndMinute = endMinute % 60;
      
      // Pick a status
      const statuses = ["Scheduled", "In Progress", "Completed", "Cancelled", "Rescheduled"];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      
      // Create the appointment
      mockAppointments.push({
        id: appointmentId++,
        name: `${appointmentNames[Math.floor(Math.random() * appointmentNames.length)]}`,
        type: "appointment",
        status,
        location: locations[Math.floor(Math.random() * locations.length)],
        startDate: date,
        startTime: `${String(baseHour).padStart(2, "0")}:${String(startMinute).padStart(2, "0")}`,
        finishTime: `${String(adjustedEndHour).padStart(2, "0")}:${String(adjustedEndMinute).padStart(2, "0")}`,
        technician: tech.name
      });
    }
  });
});

// Sample orders
export const mockOrders: Order[] = Array.from({ length: 15 }, (_, i) => ({
  id: 500 + i,
  name: `Order #${1000 + i}`,
  type: "order",
  postingDate: dateRange[i % dateRange.length],
  customer: `Customer ${i+1}`,
  status: ["In Progress", "Scheduled", "Pending", "Completed", "On Hold"][i % 5],
  priority: ["High", "Medium", "Low"][i % 3],
  estimatedCompletion: dateRange[Math.min(i % dateRange.length + 2, dateRange.length - 1)]
}));

// Combine all resources into a single array
export const mockResources: Resource[] = [
  ...mockTechnicians,
  ...mockAppointments,
  ...mockOrders
];
