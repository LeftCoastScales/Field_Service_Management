import { CalendarProvider } from "@/lib/context";
import TopBar from "@/components/calendar/top-bar";
import Sidebar from "@/components/calendar/sidebar";
import CalendarView from "@/components/calendar/calendar-view";

export default function CalendarViewWrapper() {
  return (
    <CalendarProvider>
      <div className="flex flex-col h-full w-full">
        <TopBar />
        <div className="flex flex-1 w-full overflow-hidden">
          <Sidebar />
          <div className="flex-1 w-full overflow-hidden">
            <CalendarView />
          </div>
        </div>
      </div>
    </CalendarProvider>
  );
}