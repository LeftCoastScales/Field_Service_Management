"use client";

import { useEffect, useState } from "react";
import { Button } from "../components/ui/button";
import { Home, LayoutPanelLeft, Calendar as CalendarIcon, X } from "lucide-react";
import { ResourceList } from "./resource-list";
import { ScheduleGrid, FilterCriteria } from "./schedule-grid";
import { CalendarProvider } from "../lib/context";
import CalendarView from "../components/calendar/calendar-view";
import Sidebar from "../components/calendar/sidebar";
import TopBar from "../components/calendar/top-bar";
import { ScrollArea } from "../components/ui/scroll-area";
import {
	ChevronLeft,
	ChevronRight,
	Filter,
	CalendarIcon as CalendarIconImport,
	PanelLeftClose,
	PanelLeftOpen,
} from "lucide-react";
import { DateSelector } from "./date-selector";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import {format, addMonths, subMonths } from "date-fns";
import { FilterDialog } from "./filter-dialog";
import { Calendar } from "../components/ui/calendar";
import { GridProvider } from "../contexts/grid-context";
import { SidebarProvider } from "../components/ui/sidebar";

function countActiveFilters(filters: FilterCriteria): number {
	// Count only fields that are neither empty nor "All"
	return Object.values(filters).filter(
		(val) => val && val !== "All"
	).length;
}

export default function GanttView() {
	const [selectedDate, setSelectedDate] = useState<Date>(new Date());
	const [view, setView] = useState<"today" | "tomorrow" | "custom">("today");
	const [isSidebarOpen, setIsSidebarOpen] = useState(true);
	const [isFilterOpen, setIsFilterOpen] = useState(false);
	const [viewType, setViewType] = useState<"gantt" | "calendar">("gantt");
	const [filters, setFilters] = useState<FilterCriteria>({});

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

	const handlePreviousMonth = () => {
		setSelectedDate(subMonths(selectedDate, 1));
	};

	const handleNextMonth = () => {
		setSelectedDate(addMonths(selectedDate, 1));
	};

	const toggleSidebar = () => {
		setIsSidebarOpen(!isSidebarOpen);
	};

	const activeFilterCount = countActiveFilters(filters);
	const isFilterActive = activeFilterCount > 0;
	const [filterDialogKey, setFilterDialogKey] = useState(0);

	return (
		<GridProvider>
			<CalendarProvider>
				<div className="flex h-screen flex-col bg-background overflow-hidden">
					{/* Top Navigation */}
					<header className="sticky top-0 z-50 flex h-14 items-center border-b bg-background px-6">
						<a href="/app/service" className="flex items-center gap-2 hover:text-primary">
							<Home className="h-5 w-5" />
							<span className="font-medium">Home</span>
						</a>
						<div className="ml-auto flex items-center gap-2">
							<div className="flex items-center rounded-lg border bg-card p-1">
								<Button
									variant={viewType === "gantt" ? "secondary" : "ghost"}
									size="sm"
									className="flex items-center gap-2"
									onClick={() => setViewType("gantt")}
								>
									<LayoutPanelLeft className="h-4 w-4" />
									<span>Gantt</span>
								</Button>
								<Button
									variant={viewType === "calendar" ? "secondary" : "ghost"}
									size="sm"
									className="flex items-center gap-2"
									onClick={() => setViewType("calendar")}
								>
									<CalendarIcon className="h-4 w-4" />
									<span>Calendar</span>
								</Button>
							</div>
						</div>
					</header>

					{/* Calendar Navigation */}
					<div className="flex flex-wrap items-center justify-between border-b px-4 py-2">
						<div className="flex items-center gap-2">
							<Button variant="ghost" size="icon" onClick={handlePreviousMonth}>
								<ChevronLeft className="h-4 w-4" />
							</Button>
							<span className="text-sm">{format(selectedDate, "MMMM yyyy")}</span>
							<Button variant="ghost" size="icon" onClick={handleNextMonth}>
								<ChevronRight className="h-4 w-4" />
							</Button>
						</div>
						<div className="flex items-center gap-2 mt-2 sm:mt-0">
							<Button
								variant={view === "today" ? "default" : "outline"}
								size="sm"
								className="h-7 px-2 text-xs"
								onClick={() => {
									setView("today");
									setSelectedDate(new Date());
								}}
							>
								TODAY
							</Button>
							<Button
								variant={view === "tomorrow" ? "default" : "outline"}
								size="sm"
								className="h-7 px-2 text-xs"
								onClick={() => {
									setView("tomorrow");
									const tomorrow = new Date();
									tomorrow.setDate(tomorrow.getDate() + 1);
									setSelectedDate(tomorrow);
								}}
							>
								TOMORROW
							</Button>
							<Popover>
								<PopoverTrigger asChild>
									<Button variant="outline" size="icon" className="h-7 w-7">
										<CalendarIconImport className="h-4 w-4" />
									</Button>
								</PopoverTrigger>
								<PopoverContent className="w-auto p-0">
									<Calendar
										mode="single"
										selected={selectedDate}
										onSelect={(date) => {
											if (date) {
												setSelectedDate(date);
												setView("custom");
											}
										}}
										initialFocus
									/>
								</PopoverContent>
							</Popover>
							<div className="relative inline-flex">
								<Button
									variant={isFilterActive ? "default" : "outline"}
									size="sm"
									className="h-7 px-2 text-xs !rounded-r-none flex items-center gap-2"
									onClick={() => setIsFilterOpen(true)}
								>
									{isFilterActive && (
										<span className="text-xs">{activeFilterCount}</span>
									)}
									<Filter className="h-3 w-3" />
									<span>FILTER</span>
								</Button>

								{isFilterActive && (
									<Button
										variant="destructive"
										size="sm"
										className="h-7 px-2 text-xs !rounded-l-none"
										onClick={(e) => {
											e.stopPropagation();
											setFilters({});
										}}
									>
										<X className="h-3 w-3" />
									</Button>
								)}
							</div>
						</div>
					</div>

					{/* Date Selector with Sidebar Toggle */}
					<div className="flex items-center border-b">
						<Button variant="ghost" size="icon" onClick={toggleSidebar} className="h-14 w-14 rounded-none border-r">
							{isSidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
						</Button>
						<DateSelector selectedDate={selectedDate} onDateSelect={setSelectedDate} />
					</div>

					{/* Main Content */}
					<div className="flex flex-1 overflow-hidden">
						{isSidebarOpen && (
							<div className="w-64 border-r transition-all duration-200">
								<ResourceList />
							</div>
						)}
						<div className={`flex-1 ${isSidebarOpen ? "" : "ml-0"} transition-all duration-200`}>
							{viewType === "gantt" ? (
								<ScheduleGrid selectedDate={selectedDate} filters={filters} />
							) : (
								<div className="flex-1 flex items-center justify-center text-muted-foreground">
									<div className="flex flex-col h-screen w-full">
										<TopBar />
										<div className="flex flex-1 w-full overflow-hidden">
											{/* <Sidebar /> */}
											<div className="flex-1 overflow-hidden">
												<CalendarView selectedDate={selectedDate} filters={filters} />
											</div>
										</div>
									</div>
								</div>
							)}
						</div>
					</div>

					<FilterDialog
						isOpen={isFilterOpen}
						onClose={() => setIsFilterOpen(false)}
						onApplyFilter={(newFilters) => setFilters(newFilters)}
					/>
				</div>
			</CalendarProvider>
		</GridProvider>
	);
}
