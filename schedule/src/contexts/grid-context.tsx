"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

interface GridContextType {
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
  highlightedAppointmentId: string | null;
  setHighlightedAppointmentId: (name: string | null) => void;
}

const GridContext = createContext<GridContextType | undefined>(undefined);

export function GridProvider({ children }: { children: ReactNode }) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [highlightedAppointmentId, setHighlightedAppointmentId] = useState<string | null>(null);

  return (
    <GridContext.Provider
      value={{ selectedDate, setSelectedDate, highlightedAppointmentId, setHighlightedAppointmentId }}
    >
      {children}
    </GridContext.Provider>
  );
}

export function useGrid() {
  const context = useContext(GridContext);
  if (!context) {
    throw new Error("useGrid must be used within a GridProvider");
  }
  return context;
}
