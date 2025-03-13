"use client";

import { useEffect, useState } from "react";
import { ScrollArea } from "../components/ui/scroll-area";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Search, User, FileText, Calendar, Plus, MoreVertical, Loader } from "lucide-react";
import { Badge } from "../components/ui/badge";
import CreateDialog from "./create-dialog";
import { Resource, Technician, Order, Appointment, AppointmentPrefill } from "../lib/types";
import { useCalendar } from "../lib/context";

// Import popover and details dialog components.
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import ResourceDetailsDialog from "./resource-details-dialog";

// Import the UpdateDialog for updating scheduled appointments.
import UpdateDialog from "./update-dialog";
import { updateAppointment } from "../lib/appointments-api";

// Import a toast library. Adjust the import if you use another toast provider.
import { toast } from "react-hot-toast";
import { any } from "prop-types";
import dayjs from "dayjs";

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
  const { refreshResources } = useCalendar();
  const [mounted, setMounted] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewType, setViewType] = useState<ViewType>("appointments");
  const [showSearch, setShowSearch] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [preFillData, setPrefillData] = useState<AppointmentPrefill>({});

  // For viewing details
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);

  // New state for updating a scheduled appointment
  const [updateDialogData, setUpdateDialogData] = useState<Appointment | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const filteredResources = searchResources(resources, searchTerm, viewType);
  const filtered_resources = filteredResources
    .filter((resource) => {
      if (resource.resourceType === "technician") return true;
      return resource.docstatus === 1;
    })
    .sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime());


  const viewTypeData = {
    appointments: { icon: Calendar, title: "Appointments" },
    orders: { icon: FileText, title: "Orders" },
    technicians: { icon: User, title: "Technicians" },
  };

  const { icon: ViewIcon, title } = viewTypeData[viewType];

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "open": return "bg-cyan-100 text-cyan-800";
      case "scheduled": return "bg-green-100 text-green-800";
      case "dispatched": return "bg-orange-100 text-orange-800";
      case "in progress": return "bg-blue-100 text-blue-800";
      case "pending": return "bg-yellow-100 text-yellow-800"; // may need later
      case "completed": return "bg-purple-100 text-purple-800";
      case "on hold": return "bg-gray-100 text-gray-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case "high":
        return "bg-red-100 text-red-800";
      case "medium":
        return "bg-yellow-100 text-yellow-800";
      case "low":
        return "bg-lime-100 text-lime-800";
      case "critical":
        return "bg-red-300 text-red-900";
      default:
        return "bg-gray-300 text-gray-900";
    }
  };

  // When an option is selected to view details
  const handleViewDetails = (resource: Resource) => {
    setSelectedResource(resource);
    setIsDetailsDialogOpen(true);
  };

  // When creating an appointment from an order
  const handleCreateAppointment = (resource: Resource) => {
    const order = resource as Order;
    const prefill = {
      service_order: order.name,
      customer: order.customer,
      service_type: order.type, // assuming order.type exists
    };
    setPrefillData(prefill);
    setIsAddDialogOpen(true);
  };

  // When updating an appointment (only for scheduled appointments)
  const handleUpdateAppointment = (apt: Appointment) => {
    // console.log("Updating appointment:", apt);
    
    setUpdateDialogData(apt);

    console.log(updateDialogData);
    
  };

  const hasOverlap = (updatedAppointment:any, allAppointments:any) => {
    const technicianId = updatedAppointment.service_technicians[0]?.service_technician;
    const start = dayjs(updatedAppointment.scheduled_start_datetime);
    const end = dayjs(updatedAppointment.scheduled_finish_datetime);
  
    return allAppointments.some((apt:any) => {
      if (apt.name === updatedAppointment.name) return false; // skip the same appointment
  
      const aptStart = dayjs(apt.scheduled_start_datetime);
      const aptEnd = dayjs(apt.scheduled_finish_datetime);
  
      const isSameTechnician = apt.service_technicians.some(
        (tech:any) => tech.service_technician === technicianId
      );
  
      return isSameTechnician && start.isBefore(aptEnd) && end.isAfter(aptStart);
    });
  };

  // Generic onChange handler for the update dialog using dot-notation for nested fields.
  const handleUpdateDialogChange = (field: string, value: any) => {
    if (!updateDialogData) return;
    const updated = { ...updateDialogData };
    if (field.indexOf(".") === -1) {
      updated[field] = value;
    } else {
      const parts = field.split(".");
      if (parts[0] === "items") {
        const index = Number(parts[1]);
        updated.items = [...(updated.items || [])];
        updated.items[index] = {
          ...updated.items[index],
          [parts[2]]: value,
        };
      } else if (parts[0] === "service_technicians") {
        const index = Number(parts[1]);
        updated.service_technicians = [...(updated.service_technicians || [])];
        updated.service_technicians[index] = {
          ...updated.service_technicians[index],
          [parts[2]]: value,
        };
      } else {
        updated[field] = value;
      }
    }
    setUpdateDialogData(updated);
  };

  const handleUpdateConfirm = async () => {
    // console.log("Updating appointment:", updateDialogData);

    if (!updateDialogData) return;

    const appointments = filtered_resources.filter(
      (resource) => resource.resourceType === "appointment"
    ) as Appointment[];

    const overlapExists = hasOverlap(updateDialogData, appointments);
    if (overlapExists) {
      toast.error("Time Overlap! The technician already has an appointment during the selected time.", {
        style: {
          background: "#fef2f2",
          color: "#991b1b",
          fontWeight: "bold",
        },
      });
      return;
    }
    
    
    try {
      const result = await updateAppointment({
        name: updateDialogData.name,
        scheduled_start_datetime: dayjs(updateDialogData.scheduled_start_datetime).format('YYYY-MM-DD HH:mm'),
        scheduled_finish_datetime: dayjs(updateDialogData.scheduled_finish_datetime).format('YYYY-MM-DD HH:mm'),
        service_technicians: updateDialogData.service_technicians,
        items: updateDialogData.items,
        reschedule: true,
        edit_item_list: true,
        edit_technician_list: true,

      });
      // Display a success toast with the returned appointment
      toast.success(`Appointment ${result} Updated Successfully!`);
      refreshResources();
    } catch (error: any) {
      console.error("Error updating appointment:", error);
      // Show an error toast with a message (you can improve this message based on error details)
      toast.error("Failed to Update Appointment.");
    } finally {
      setUpdateDialogData(null);
    }
  };

  const handleUpdateCancel = () => {
    setUpdateDialogData(null);
  };

  // The popover menu for each resource
  const ResourceOptions = ({ resource }: { resource: Resource }) => {
    const isOrder = resource.resourceType === "order";
    const order = resource as Order;
    const isOpenOrder = isOrder && order.status.toLowerCase() === "open";
    const isAppointment = resource.resourceType === "appointment";
    const apt = resource as Appointment;
    const isScheduled = isAppointment && apt.status.toLowerCase() === "scheduled";

    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="p-1">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-40 p-2 shadow-lg rounded-md bg-white">
          {isOrder && isOpenOrder && (
            <button
              onClick={() => {
                handleCreateAppointment(resource);
              }}
              className="flex w-full items-center gap-2 px-2 py-1 hover:bg-gray-100 rounded"
            >
              <Calendar className="h-4 w-4 text-green-600" />
              <span className="text-sm">Create Appointment</span>
            </button>
          )}
          {isAppointment && isScheduled && (
            <button
              onClick={() => {
                handleUpdateAppointment(apt);
              }}
              className="flex w-full items-center gap-2 px-2 py-1 hover:bg-gray-100 rounded"
            >
              <Calendar className="h-4 w-4 text-blue-600" />
              <span className="text-sm">Update</span>
            </button>
          )}
          <button
            onClick={() => {
              handleViewDetails(resource);
            }}
            className="flex w-full items-center gap-2 px-2 py-1 hover:bg-gray-100 rounded"
          >
            <FileText className="h-4 w-4 text-blue-600" />
            <span className="text-sm">View Details</span>
          </button>
        </PopoverContent>
      </Popover>
    );
  };

  const renderResourceContent = (resource: Resource) => {
    if (resource.resourceType === "technician") {
      const tech = resource as Technician;
      return (
        <div className="flex flex-col">
          {tech.full_name && <span className="text-sm font-medium ">{tech.full_name}</span>}
          {tech.name && <span className="text-xs font-medium text-muted-foreground">{tech.name}</span>}
          {tech.specialization && <span className="text-xs text-muted-foreground">{tech.service_area}</span>}
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
        className="flex-grow min-h-[400px]"
        style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(0, 0, 0, 0.2) transparent" }}
      >
        {resources.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center mt-20">
            <Loader className="animate-spin h-10 w-10 text-gray-600 text-md" />
            <div className="mt-4 text-gray-700 text-md">Fetching Resources...</div>
          </div>
        ) : (
          <div className="space-y-1 p-2">
            {filtered_resources.map((resource) => (
              <div
                key={resource.name}
                className="flex items-center justify-between rounded-md px-4 py-1 hover:bg-accent"
              >
                <div>
                  {resource.resourceType !== "technician" && (
                    <div className="text-sm font-medium">{resource.name}</div>
                  )}
                  {renderResourceContent(resource)}
                </div>
                <div>
                  <ResourceOptions resource={resource} />
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Footer with view buttons */}
      <div className="border-t p-2 mt-auto">
        <div className="flex justify-between">
          <Button
            variant={viewType === "appointments" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewType("appointments")}
          >
            <Calendar className="h-4 w-4" />
          </Button>
          <Button
            variant={viewType === "orders" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewType("orders")}
          >
            <FileText className="h-4 w-4" />
          </Button>
          <Button
            variant={viewType === "technicians" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewType("technicians")}
          >
            <User className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Dialogs */}
      <CreateDialog
        isOpen={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
        prefillData={preFillData}
      />
      {selectedResource && (
        <ResourceDetailsDialog
          resource={selectedResource}
          isOpen={isDetailsDialogOpen}
          onClose={() => setIsDetailsDialogOpen(false)}
        />
      )}
      {updateDialogData && (
        <UpdateDialog
          isOpen={true}
          onClose={handleUpdateCancel}
          appointment={updateDialogData}
          onChange={handleUpdateDialogChange}
          onConfirm={handleUpdateConfirm}
        />
      )}
    </div>
  );
}
