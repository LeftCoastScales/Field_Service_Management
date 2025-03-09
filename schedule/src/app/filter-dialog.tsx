// components/filter_dialog.tsx
"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import { Button } from "../components/ui/button";
// import { Select} from "../components/ui/select";
import { useState } from "react";
import { useCalendar } from "../lib/context";
import { FilterCriteria } from "./schedule-grid";
import { DialogDescription } from "@radix-ui/react-dialog";

interface FilterDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyFilter: (filters: FilterCriteria) => void;
}

export function FilterDialog({ isOpen, onClose, onApplyFilter }: FilterDialogProps) {
  const { resources } = useCalendar();

  const [location, setLocation] = useState("");
  const [appointment, setAppointment] = useState("");
  // const [order, setOrder] = useState("");
  const [technician, setTechnician] = useState("");

  // Extract filter options from live resources.
  const appointmentOptions = Array.from(
    new Set(resources.filter((r) => r.resourceType === "appointment").map((a) => a.name))
  );
  const locationOptions = Array.from(
    new Set(resources.filter((r) => r.resourceType === "appointment").map((a) => a.location))
  );
  const technicianOptions = Array.from(
    new Set(resources.filter((r) => r.resourceType === "technician").map((t) => t.full_name))
  );

  const handleApplyFilter = () => {
    onApplyFilter({
      location,
      appointment,
      // order,
      technician,
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Filter</DialogTitle>
        </DialogHeader>
        <DialogDescription className="text-sm text-gray-500">Add filters to filter the Appointments Grid</DialogDescription>
        <div className="grid gap-4 py-4">
          <div className="space-y-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="location" className="text-right text-sm">
                Location
              </Label>
              <select
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="col-span-3 h-8 border rounded px-2"
              >
                <option value="">All</option>
                {locationOptions.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="appointment" className="text-right text-sm">
                Appointment
              </Label>
              <select
                id="appointment"
                value={appointment}
                onChange={(e) => setAppointment(e.target.value)}
                className="col-span-3 h-8 border rounded px-2 text-sm"
              >
                <option value="">All</option>
                {appointmentOptions.map((apt) => (
                  <option key={apt} value={apt}>
                    {apt}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="technician" className="text-right text-sm">
                Technician
              </Label>
              <select
                id="technician"
                value={technician}
                onChange={(e) => setTechnician(e.target.value)}
                className="col-span-3 h-8 border rounded px-2"
              >
                <option value="">All</option>
                {technicianOptions.map((tech) => (
                  <option key={tech} value={tech}>
                    {tech}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className="flex justify-end">
          <Button size={'sm'} onClick={handleApplyFilter}>Apply Filter</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
