// components/resource-list.tsx
"use client";

import { useEffect, useState } from "react";
import { ScrollArea } from "../components/ui/scroll-area";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Search, User, FileText, Calendar, Plus } from "lucide-react";
import { Badge } from "../components/ui/badge";
import { AddDialog } from "./add-dialog";
import { Resource, Technician, Order, Appointment } from "../lib/types";
import { useCalendar } from "../lib/context";

type ViewType = "orders" | "appointments" | "technicians";

const searchResources = (
  resources: Resource[],
  searchTerm: string,
  viewType: ViewType
) => {
  const searchString = searchTerm.toLowerCase();
  // Convert viewType to singular for filtering
  const resourceType = viewType.slice(0, -1) as "technician" | "order" | "appointment";
  return resources.filter((resource) => {
    if (resource.resourceType !== resourceType) return false;
    if (resource.resourceType === "technician") {
      const tech = resource as Technician;
      return (
        tech.name.toLowerCase().includes(searchString) ||
        (tech.full_name && tech.full_name.toLowerCase().includes(searchString)) ||
        (tech.employee && tech.employee.toLowerCase().includes(searchString)) ||
        (tech.service_area && tech.service_area.toLowerCase().includes(searchString)) ||
        (tech.specialization && tech.specialization.toLowerCase().includes(searchString))
      );
    }
    if (resource.resourceType === "order") {
      const order = resource as Order;
      return (
        order.name.toLowerCase().includes(searchString) ||
        order.customer.toLowerCase().includes(searchString) ||
        order.status.toLowerCase().includes(searchString) ||
        order.priority.toLowerCase().includes(searchString)
      );
    }
    if (resource.resourceType === "appointment") {
      const apt = resource as Appointment;
      return (
        apt.name.toLowerCase().includes(searchString) ||
        apt.customer.toLowerCase().includes(searchString) ||
        apt.status.toLowerCase().includes(searchString) ||
        apt.service_type.toLowerCase().includes(searchString)
      );
    }
    return false;
  });
};

export function ResourceList() {
  const { resources } = useCalendar();
  const [mounted, setMounted] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewType, setViewType] = useState<ViewType>("appointments");
  const [showSearch, setShowSearch] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const filteredResources = searchResources(resources, searchTerm, viewType);

  const viewTypeData = {
    appointments: { icon: Calendar, title: "Appointments" },
    orders: { icon: FileText, title: "Orders" },
    technicians: { icon: User, title: "Technicians" },
  };

  const { icon: ViewIcon, title } = viewTypeData[viewType];

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "in progress":
        return "bg-blue-100 text-blue-800";
      case "scheduled":
        return "bg-green-100 text-green-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "completed":
        return "bg-purple-100 text-purple-800";
      case "on hold":
      case "cancelled":
        return "bg-red-100 text-red-800";
      case "rescheduled":
        return "bg-orange-100 text-orange-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case "high":
        return "bg-red-100 text-red-800";
      case "medium":
        return "bg-yellow-100 text-yellow-800";
      case "low":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const renderResourceContent = (resource: Resource) => {
    if (resource.resourceType === "technician") {
      const tech = resource as Technician;
      return (
        <div className="flex flex-col text-xs text-muted-foreground">
          {tech.full_name && <span>{tech.full_name}</span>}
          {tech.specialization && <span>{tech.service_area}</span>}
        </div>
      );
    }
    if (resource.resourceType === "order") {
      const order = resource as Order;
      return (
        <div className="flex flex-col gap-1">
          <div className="flex gap-1">
            <Badge variant="secondary" className={`text-xs ${getStatusColor(order.status)}`}>
              {order.status}
            </Badge>
            <Badge variant="secondary" className={`text-xs ${getPriorityColor(order.priority)}`}>
              {order.priority}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground">
            <span>{order.customer}</span>
            <span> • {order.posting_date}</span>
          </div>
        </div>
      );
    }
    if (resource.resourceType === "appointment") {
      const apt = resource as Appointment;
      return (
        <div className="flex flex-col gap-1">
          <Badge variant="secondary" className={`text-xs w-fit ${getStatusColor(apt.status)}`}>
            {apt.status}
          </Badge>
          <div className="text-xs text-muted-foreground">
            <span>{apt.customer}</span>
            <span> • {new Date(apt.scheduled_start_datetime).toLocaleDateString()}</span>
          </div>
          <div className="text-xs text-muted-foreground">
            <span>
              {new Date(apt.scheduled_start_datetime).toLocaleTimeString()} -{" "}
              {new Date(apt.scheduled_finish_datetime).toLocaleTimeString()}
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex flex-col h-full w-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b p-2">
        <div className="flex items-center gap-2">
          <ViewIcon className="h-5 w-5" />
          <span className="text-base font-medium">{title}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setShowSearch(!showSearch)}>
            <Search className="h-4 w-4" />
          </Button>
          {viewType === "appointments" && (
            <Button variant="ghost" size="icon" onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Search Input */}
      {showSearch && (
        <div className="p-2">
          <Input
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-7 text-sm"
          />
        </div>
      )}

      {/* Resource List */}
      <ScrollArea
        className="flex-grow"
        style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(0, 0, 0, 0.2) transparent" }}
      >
        <div className="space-y-1 p-2">
          {filteredResources.map((resource) => (
            <div key={resource.name} className="flex flex-col gap-1 rounded-md px-4 py-1 hover:bg-accent">
              <div className="flex items-center">
                <span className="text-sm font-medium">{resource.name}</span>
              </div>
              {renderResourceContent(resource)}
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Footer with view buttons */}
      <div className="border-t p-2 mt-auto">
        <div className="flex justify-between">
          <Button variant={viewType === "appointments" ? "default" : "ghost"} size="sm" onClick={() => setViewType("appointments")}>
            <Calendar className="h-4 w-4" />
          </Button>
          <Button variant={viewType === "orders" ? "default" : "ghost"} size="sm" onClick={() => setViewType("orders")}>
            <FileText className="h-4 w-4" />
          </Button>
          <Button variant={viewType === "technicians" ? "default" : "ghost"} size="sm" onClick={() => setViewType("technicians")}>
            <User className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <AddDialog isOpen={isAddDialogOpen} onClose={() => setIsAddDialogOpen(false)} type={viewType} />
    </div>
  );
}
