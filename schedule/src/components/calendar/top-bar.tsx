// components/top-bar.tsx
"use client";

import { useCalendar } from "../../lib/context";
import { Input } from "../../components/calendar/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/calendar/ui/select";
import { useState } from "react";

export default function TopBar() {
  const {
    technicians,
    view,
    currentDate,
    searchTerm,
    setSearchTerm,
    selectedTechnician,
    setView,
    setSelectedTechnician,
  } = useCalendar();
  const [isAddEventOpen, setIsAddEventOpen] = useState(false);
  const [newEvent, setNewEvent] = useState({
    start: "",
    end: "",
  });

  // Sort technicians by name
  const sortedTechnicians = technicians.slice().sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="flex flex-col md:flex-row items-center justify-between px-4 py-2 bg-white border-b border-gray-200">
      <div className="flex items-center space-x-4 mb-2 md:mb-0">
        <h2 className="text-lg font-semibold">
          {currentDate.toLocaleDateString("en-US", {
            month: "long",
            year: "numeric",
            ...(view === "day" && { day: "numeric" }),
            ...(view === "week" && { day: "numeric" }),
          })}
        </h2>
      </div>
      <div className="flex flex-wrap items-center space-x-2 space-y-2 md:space-y-0">
        <Select value={view} onValueChange={(value: any) => setView(value)}>
          <SelectTrigger className="w-[100px] text-xs">
            <SelectValue placeholder="Select view" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="day">Day</SelectItem>
            <SelectItem value="week">Week</SelectItem>
            <SelectItem value="month">Month</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={selectedTechnician?.name || "all"}
          onValueChange={(value) =>
            setSelectedTechnician(technicians.find((t) => t.name === value) || null)
          }
        >
          <SelectTrigger className="w-[150px] text-xs">
            <SelectValue placeholder="Select technician" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem key="all" value="all">
              All Technicians
            </SelectItem>
            {sortedTechnicians.map((tech) => (
              <SelectItem key={tech.name} value={tech.name}>
                {tech.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="text"
          placeholder="Search appointments..."
          className="w-48 text-xs"
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
    </div>
  );
}
