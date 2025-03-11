"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import type { Resource, Appointment, Technician, Order } from "./types";
import { fetchResources } from "./resources-data";

const extractAppointments = (resources: Resource[]): Appointment[] =>
  resources.filter((r) => r.resourceType === "appointment") as Appointment[];

const extractTechnicians = (resources: Resource[]): Technician[] =>
  resources.filter((r) => r.resourceType === "technician") as Technician[];

const extractOrders = (resources: Resource[]): Order[] =>
  resources.filter((r) => r.resourceType === "order") as Order[];

export type CalendarViewType = "day" | "week" | "month";

type CalendarContextType = {
  resources: Resource[];
  appointments: Appointment[];
  technicians: Technician[];
  orders: Order[];
  refreshResources: () => Promise<void>;
  loading: boolean;
  addAppointment: (appointment: Appointment) => void;
  updateAppointment: (id: number, updatedFields: Partial<Appointment>) => void;
  removeAppointment: (id: number) => void;
  view: CalendarViewType;
  setView: (view: CalendarViewType) => void;
  currentDate: Date;
  setCurrentDate: (date: Date) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  selectedTechnician: Technician | null;
  setSelectedTechnician: (technician: Technician | null) => void;
  changeDate: (direction: "prev" | "next") => void;
};

const CalendarContext = createContext<CalendarContextType | undefined>(undefined);

export const CalendarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [resources, setResources] = useState<Resource[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshVersion, setRefreshVersion] = useState(0);

  const [view, setView] = useState<CalendarViewType>("week");
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedTechnician, setSelectedTechnician] = useState<Technician | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchResources();
      setResources(data);
      setAppointments(extractAppointments(data));
      setTechnicians(extractTechnicians(data));
      setOrders(extractOrders(data));
    } catch (error) {
      console.error("Error fetching resources:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [refreshVersion]);

  const refreshResources = async () => {
    setRefreshVersion((v) => v + 1);
  };

  const addAppointment = (appointment: Appointment) => {
    setAppointments((prev) => [...prev, appointment]);
    setResources((prev) => [...prev, appointment]);
  };

  const updateAppointment = (id: number, updatedFields: Partial<Appointment>) => {
    setAppointments((prev) =>
      prev.map((app) => (app.id === id ? { ...app, ...updatedFields } : app))
    );
    setResources((prev) =>
      prev.map((r) =>
        r.id === id && r.resourceType === "appointment"
          ? ({ ...r, ...updatedFields } as Appointment)
          : r
      )
    );
  };

  const removeAppointment = (id: number) => {
    setAppointments((prev) => prev.filter((app) => app.id !== id));
    setResources((prev) => prev.filter((r) => r.id !== id));
  };

  const changeDate = (direction: "prev" | "next") => {
    const newDate = new Date(currentDate);
    if (view === "day") {
      newDate.setDate(newDate.getDate() + (direction === "next" ? 1 : -1));
    } else if (view === "week") {
      newDate.setDate(newDate.getDate() + (direction === "next" ? 7 : -7));
    } else if (view === "month") {
      newDate.setMonth(newDate.getMonth() + (direction === "next" ? 1 : -1));
    }
    setCurrentDate(newDate);
  };

  return (
    <CalendarContext.Provider
      value={{
        resources,
        appointments,
        technicians,
        orders,
        refreshResources,
        loading,
        addAppointment,
        updateAppointment,
        removeAppointment,
        view,
        setView,
        currentDate,
        setCurrentDate,
        searchTerm,
        setSearchTerm,
        selectedTechnician,
        setSelectedTechnician,
        changeDate,
      }}
    >
      {children}
    </CalendarContext.Provider>
  );
};

export const useCalendar = () => {
  const context = useContext(CalendarContext);
  if (context === undefined) {
    throw new Error("useCalendar must be used within a CalendarProvider");
  }
  return context;
};

export default CalendarProvider;
