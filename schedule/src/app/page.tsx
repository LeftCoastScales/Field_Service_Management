
"use client";

import { useState, useEffect } from "react";
import { Home, LayoutPanelLeft, Calendar as CalendarIcon } from "lucide-react";
import { GridProvider } from "../contexts/grid-context";
import { SidebarProvider } from "../components/ui/sidebar";
import GanttView from "../app/gantt-view";
import CalendarProvider from "../lib/context";

import toast, { Toaster } from 'react-hot-toast';
import { any } from "prop-types";

export default function Page() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [viewType, setViewType] = useState<"gantt" | "calendar">("gantt");
  const [filters, setFilters] = useState({});

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  return (
    <GridProvider>
      <CalendarProvider>
        <div className="flex h-screen flex-col bg-background overflow-hidden">
          <GanttView
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            isSidebarOpen={isSidebarOpen}
            toggleSidebar={toggleSidebar}
            filters={filters}
            setFilters={setFilters}
          />
        </div>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 5000,
            style: {
              background: '#333',
              color: '#fff',
            },
          }}
        />    
      </CalendarProvider>
    </GridProvider>
  );
}