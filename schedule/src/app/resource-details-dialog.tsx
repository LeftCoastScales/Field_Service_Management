// components/ResourceDetailsDialog.tsx
"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "../components/ui/dialog";
import { Button } from "../components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Calendar, FileText, User } from "lucide-react";

interface ResourceDetailsDialogProps {
  resource: any; // adjust type if needed
  isOpen: boolean;
  onClose: () => void;
}

const ResourceDetailsDialog: React.FC<ResourceDetailsDialogProps> = ({
  resource,
  isOpen,
  onClose,
}) => {
  // Helper to render a labeled field
  const renderField = (label: string, value: any) => (
    <div className="flex">
      <span className="font-medium w-32">{label}:</span>
      <span className="text-sm">{value?.toString() || "-"}</span>
    </div>
  );

  // Render for Technician: show all fields except resourceType, and use better labels
  const renderTechnicianDetails = () => (
    <div className="space-y-2">
      {renderField("Name", resource.name)}
      {renderField("Full Name", resource.full_name)}
      {renderField("Employee", resource.employee)}
      {renderField("Service Area", resource.service_area)}
      {renderField("Specialization", resource.specialization)}
      {/* Add any other fields */}
    </div>
  );

  // Render for Order: show selected fields and an Items table
  const renderOrderDetails = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        {renderField("Name", resource.name)}
        {renderField("Posting Date", resource.posting_date)}
        {renderField("Due Date", resource.due_date)}
        {renderField("Customer", resource.customer)}
        {renderField("Status", resource.status)}
        {renderField("Priority", resource.priority)}
        <span className="flex flex-col text-xs text-muted-foreground">
            {renderField("Address", resource.address_details?.split('\n')[0]) || "-"}
            {renderField("Email Contact", resource.address_details?.split('\n')[1].split(':')[1]) || "-"}
            {renderField("Phone Contact", resource.address_details?.split('\n')[2].split(':')[1]) || "-"}
        </span>
      </div>
      <div>
        <h3 className="font-medium mb-2">Items</h3>
        {resource.items && resource.items.length > 0 ? (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="px-2 py-1 text-left">Item Code</th>
                <th className="px-2 py-1 text-left">Item Name</th>
                <th className="px-2 py-1 text-left">Qty</th>
              </tr>
            </thead>
            <tbody>
              {resource.items.map((item: any, index: number) => (
                <tr key={index} className="border-b">
                  <td className="px-2 py-1">{item.item_code}</td>
                  <td className="px-2 py-1">{item.item_name}</td>
                  <td className="px-2 py-1">{item.qty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-gray-500">No items found.</p>
        )}
      </div>
    </div>
  );

  // Render for Appointment: show selected fields and tabs for Items and Service Technicians.
  const renderAppointmentDetails = () => {
    // Extract start_date, start time, finish time from scheduled_start_datetime and scheduled_finish_datetime.
    const startDate = new Date(resource.scheduled_start_datetime).toLocaleDateString();
    const startTime = new Date(resource.scheduled_start_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const finishTime = new Date(resource.scheduled_finish_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          {renderField("Name", resource.name)}
          {renderField("Posting Date", resource.posting_date)}
          {renderField("Service Order", resource.service_order)}
          {renderField("Priority", resource.priority)}
          {renderField("Customer", resource.customer)}
          {renderField("Start Date", startDate)}
          {renderField("Start Time", startTime)}
          {renderField("Finish Time", finishTime)}
          {renderField("Status", resource.status)}
        </div>
        <Tabs defaultValue="items" className="w-full">
          <TabsList className="flex space-x-2 border-b">
            <TabsTrigger value="items" className="text-xs">
              Items
            </TabsTrigger>
            <TabsTrigger value="technicians" className="text-xs">
              Service Technicians
            </TabsTrigger>
          </TabsList>
          <TabsContent value="items">
            {resource.items && resource.items.length > 0 ? (
              <table className="min-w-full text-sm mt-2">
                <thead>
                  <tr className="border-b">
                    <th className="px-2 py-1 text-left">Item Code</th>
                    <th className="px-2 py-1 text-left">Item Name</th>
                    <th className="px-2 py-1 text-left">Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {resource.items.map((item: any, index: number) => (
                    <tr key={index} className="border-b">
                      <td className="px-2 py-1">{item.item_code}</td>
                      <td className="px-2 py-1">{item.item_name}</td>
                      <td className="px-2 py-1">{item.qty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-gray-500">No items found.</p>
            )}
          </TabsContent>
          <TabsContent value="technicians">
            {resource.service_technicians && resource.service_technicians.length > 0 ? (
              <table className="min-w-full text-sm mt-2">
                <thead>
                  <tr className="border-b">
                    <th className="px-2 py-1 text-left">Technician</th>
                    <th className="px-2 py-1 text-left">Full Name</th>
                    {/* <th className="px-2 py-1 text-left">Service Area</th>
                    <th className="px-2 py-1 text-left">Specialization</th> */}
                  </tr>
                </thead>
                <tbody>
                  {resource.service_technicians.map((tech: any, index: number) => (
                    <tr key={index} className="border-b">
                      <td className="px-2 py-1">{tech.service_technician}</td>
                      <td className="px-2 py-1">{tech.full_name}</td>
                      {/* <td className="px-2 py-1">{tech.service_area}</td>
                      <td className="px-2 py-1">{tech.specialization}</td> */}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-gray-500">No service technicians found.</p>
            )}
          </TabsContent>
        </Tabs>
      </div>
    );
  };

  // Choose which details view to render based on resource type
  const renderDetails = () => {
    if (resource.resourceType === "technician") {
      return renderTechnicianDetails();
    } else if (resource.resourceType === "order") {
      return renderOrderDetails();
    } else if (resource.resourceType === "appointment") {
      return renderAppointmentDetails();
    }
    return <p>No details available.</p>;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {resource.name}{" "}
            {resource.resourceType === "order" && (
              <span className="text-sm text-gray-500">Order Details</span>
            )}
            {resource.resourceType === "appointment" && (
              <span className="text-sm text-gray-500">Appointment Details</span>
            )}
            {resource.resourceType === "technician" && (
              <span className="text-sm text-gray-500">Technician Details</span>
            )}
          </DialogTitle>
          <DialogDescription>
            This Resource Has the following Details
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4">{renderDetails()}</div>
        <DialogFooter>
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ResourceDetailsDialog;
