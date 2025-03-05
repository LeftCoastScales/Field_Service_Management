// components/filter_dialog.tsx
"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import { Button } from "../components/ui/button";
import { useState } from "react";
import { useCalendar } from "../lib/context";
import { FilterCriteria } from "./schedule-grid";

interface FilterDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyFilter: (filters: FilterCriteria) => void;
}

export function FilterDialog({ isOpen, onClose, onApplyFilter }: FilterDialogProps) {
  const { resources } = useCalendar();

  const [location, setLocation] = useState("");
  const [appointment, setAppointment] = useState("");
  const [order, setOrder] = useState("");
  const [technician, setTechnician] = useState("");

  // Extract filter options from live resources.
  const appointmentOptions = Array.from(
    new Set(resources.filter((r) => r.type === "appointment").map((a) => a.name))
  );
  const locationOptions = Array.from(
    new Set(resources.filter((r) => r.type === "appointment").map((a) => a.customer))
  );
  const technicianOptions = Array.from(
    new Set(resources.filter((r) => r.type === "technician").map((t) => t.name))
  );
  const orderOptions = Array.from(
    new Set(resources.filter((r) => r.type === "order").map((o) => o.name))
  );

  const handleApplyFilter = () => {
    onApplyFilter({
      location,
      appointment,
      order,
      technician,
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>Filter</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="location" className="text-right">
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
              <Label htmlFor="appointment" className="text-right">
                Appointment
              </Label>
              <select
                id="appointment"
                value={appointment}
                onChange={(e) => setAppointment(e.target.value)}
                className="col-span-3 h-8 border rounded px-2"
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
              <Label htmlFor="order" className="text-right">
                Order
              </Label>
              <select
                id="order"
                value={order}
                onChange={(e) => setOrder(e.target.value)}
                className="col-span-3 h-8 border rounded px-2"
              >
                <option value="">All</option>
                {orderOptions.map((ord) => (
                  <option key={ord} value={ord}>
                    {ord}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="technician" className="text-right">
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
          <Button onClick={handleApplyFilter}>Apply Filter</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
