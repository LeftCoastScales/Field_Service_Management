// "use client";

// import { useState, useEffect } from "react";
// import { Home, LayoutPanelLeft, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Filter, CalendarIcon as CalendarIconImport, PanelLeftClose, PanelLeftOpen } from "lucide-react";
// import { ResourceList } from "./resource-list";
// import { ScheduleGrid, FilterCriteria } from "./schedule-grid";
// import { DateSelector } from "./date-selector";
// import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
// import { FilterDialog } from "./filter-dialog";
// import { GridProvider } from "@/contexts/grid-context";
// import { SidebarProvider } from "@/components/ui/sidebar";
// import { CalendarProvider } from "@/lib/context";
// import { Calendar } from "@/components/ui/calendar";
// import CalendarView from "@/components/calendar/calendar-view";
// import Sidebar from "@/components/calendar/sidebar";
// import { Button } from "@/components/calendar/ui/button";
// import { format, addMonths, subMonths } from "date-fns";
// import TopBar from "@/components/calendar/top-bar";
// import Navbar from "@/components/ui/navbar";

// export default function Page() {
//   const [selectedDate, setSelectedDate] = useState<Date>(new Date());
//   const [view, setView] = useState<"today" | "tomorrow" | "custom">("today");
//   const [isSidebarOpen, setIsSidebarOpen] = useState(true);
//   const [isFilterOpen, setIsFilterOpen] = useState(false);
//   const [viewType, setViewType] = useState<"gantt" | "calendar">("gantt");
//   const [filters, setFilters] = useState<FilterCriteria>({});

//   useEffect(() => {
//     const handleResize = () => {
//       if (window.innerWidth < 768) {
//         setIsSidebarOpen(false);
//       } else {
//         setIsSidebarOpen(true);
//       }
//     };
//     handleResize();
//     window.addEventListener("resize", handleResize);
//     return () => window.removeEventListener("resize", handleResize);
//   }, []);

//   const handlePreviousMonth = () => {
//     setSelectedDate(subMonths(selectedDate, 1));
//   };

//   const handleNextMonth = () => {
//     setSelectedDate(addMonths(selectedDate, 1));
//   };

//   const toggleSidebar = () => {
//     setIsSidebarOpen(!isSidebarOpen);
//   };

//   return (
//     <GridProvider>
//       <SidebarProvider>
//         <div className="flex h-screen flex-col bg-background overflow-hidden">
//           <Navbar viewType={viewType} setViewType={setViewType} />

//           {viewType === "gantt" ? (
//             <>
//               {/* Gantt Navigation */}
//               <div className="flex flex-wrap items-center justify-between border-b px-4 py-2">
//                 <div className="flex items-center gap-2">
//                   <Button variant="ghost" size="icon" onClick={handlePreviousMonth}>
//                     <ChevronLeft className="h-4 w-4" />
//                   </Button>
//                   <span className="text-sm">{format(selectedDate, "MMMM yyyy")}</span>
//                   <Button variant="ghost" size="icon" onClick={handleNextMonth}>
//                     <ChevronRight className="h-4 w-4" />
//                   </Button>
//                 </div>
//                 <div className="flex items-center gap-2 mt-2 sm:mt-0">
//                   <Button
//                     variant={view === "today" ? "default" : "outline"}
//                     size="sm"
//                     className="h-7 px-2 text-xs"
//                     onClick={() => {
//                       setView("today");
//                       setSelectedDate(new Date());
//                     }}
//                   >
//                     TODAY
//                   </Button>
//                   <Button
//                     variant={view === "tomorrow" ? "default" : "outline"}
//                     size="sm"
//                     className="h-7 px-2 text-xs"
//                     onClick={() => {
//                       setView("tomorrow");
//                       const tomorrow = new Date();
//                       tomorrow.setDate(tomorrow.getDate() + 1);
//                       setSelectedDate(tomorrow);
//                     }}
//                   >
//                     TOMORROW
//                   </Button>
//                   <Popover>
//                     <PopoverTrigger asChild>
//                       <Button variant="outline" size="icon" className="h-7 w-7">
//                         <CalendarIconImport className="h-4 w-4" />
//                       </Button>
//                     </PopoverTrigger>
//                     <PopoverContent className="w-auto p-0">
//                       <Calendar
//                         mode="single"
//                         selected={selectedDate}
//                         onSelect={(date) => {
//                           if (date) {
//                             setSelectedDate(date);
//                             setView("custom");
//                           }
//                         }}
//                         initialFocus
//                       />
//                     </PopoverContent>
//                   </Popover>
//                   <Button
//                     variant="outline"
//                     size="sm"
//                     className="h-7 px-2 text-xs flex items-center gap-1"
//                     onClick={() => setIsFilterOpen(true)}
//                   >
//                     <Filter className="h-3 w-3" />
//                     FILTER
//                   </Button>
//                 </div>
//               </div>

//               {/* Gantt Date Selector and Main Content */}
//               <div className="flex items-center border-b">
//                 <Button variant="ghost" size="icon" onClick={toggleSidebar} className="h-14 w-14 rounded-none border-r">
//                   {isSidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
//                 </Button>
//                 <DateSelector selectedDate={selectedDate} onDateSelect={setSelectedDate} />
//               </div>
//               <div className="flex flex-1 overflow-hidden">
//                 {isSidebarOpen && (
//                   <div className="w-64 border-r transition-all duration-200">
//                     <ResourceList />
//                   </div>
//                 )}
//                 <div className={`flex-1 ${isSidebarOpen ? "" : "ml-0"} transition-all duration-200`}>
//                   <ScheduleGrid selectedDate={selectedDate} filters={filters} />
//                 </div>
//               </div>
//               <FilterDialog
//                 isOpen={isFilterOpen}
//                 onClose={() => setIsFilterOpen(false)}
//                 onApplyFilter={(newFilters) => setFilters(newFilters)}
//               />
//             </>
//           ) : (
//             // Calendar View – replace everything below the navbar
//             <CalendarProvider>
//               <div className="flex flex-col h-screen w-full">
//                 <TopBar />
//                 <div className="flex flex-1 w-full overflow-hidden">
//                   <Sidebar />
//                   <div className="flex-1 overflow-hidden">
//                     <CalendarView />
//                   </div>
//                 </div>
//               </div>
//             </CalendarProvider>
//           )}
//         </div>
//       </SidebarProvider>
//     </GridProvider>
//   );
// }


"use client";

import { useState, useEffect } from "react";
import { Home, LayoutPanelLeft, Calendar as CalendarIcon } from "lucide-react";
import { GridProvider } from "../contexts/grid-context";
import { SidebarProvider } from "../components/ui/sidebar";
import GanttView from "../app/gantt-view";
import CalendarProvider from "../lib/context";

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
      </CalendarProvider>
    </GridProvider>
  );
}