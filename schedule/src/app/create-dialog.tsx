// components/create-dialog.tsx
"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "../components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Label } from "../components/ui/label";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { Plus, Trash2, RotateCcw } from "lucide-react";
import { useCalendar } from "../lib/context";
import { fetchItems, createAppointment } from "../lib/appointments-api";
import dayjs from "dayjs";

// Import validations
import {
  validateTimeRange,
  validateMinimumDuration,
  validateBusinessHours,
  validateNonEmptyField,
} from "../lib/validations";

// Updated AppointmentPrefill to include new fields for pre-filling the create dialog.
export interface AppointmentPrefill {
  service_order?: string;
  customer?: string;
  service_type?: string;
  items?: Item[];
  startDate?: string;
  startTime?: string;
  finishTime?: string;
  defaultTechnician?: string;
}

// Frappe-required metadata interfaces for child tables.
interface Item {
  doctype: string;
  parentfield: string;
  parenttype: string;
  item_code: string;
  qty: number;
  item_name?: string;
  rate?: number;
  amount?: number;
}

interface TechnicianItem {
  doctype: string;
  parentfield: string;
  parenttype: string;
  service_technician: string;
  full_name?: string;
}

interface AddDialogProps {
  isOpen: boolean;
  onClose: () => void;
  prefillData?: AppointmentPrefill;
}

export function CreateDialog({ isOpen, onClose, prefillData }: AddDialogProps) {
  // State declarations
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const { refreshResources, orders, technicians, appointments } = useCalendar();

  const filteredOrders = orders.filter((order) => {
    const hasNoLinkedAppointment = !appointments.some(app => app.service_order === order.name);
    return hasNoLinkedAppointment && order.docstatus === 1 && order.status === "Open";
  });

  const todayStr = new Date().toISOString().split("T")[0];
  const [serviceOrder, setServiceOrder] = useState(prefillData?.service_order || "");
  const [customer, setCustomer] = useState(prefillData?.customer || "");
  const [serviceType, setServiceType] = useState(prefillData?.service_type || "");
  const [postingDate] = useState(todayStr);
  const [startDate, setStartDate] = useState(prefillData?.startDate || "");
  const [startTime, setStartTime] = useState(prefillData?.startTime || "");
  const [finishTime, setFinishTime] = useState(prefillData?.finishTime || "");
  const [changedStatus, setChangedStatus] = useState("Scheduled");

  const [items, setItems] = useState<Item[]>(prefillData?.items || []);
  const [newItem, setNewItem] = useState<Omit<Item, "doctype" | "parentfield" | "parenttype">>({
    item_code: "",
    qty: 1,
    item_name: "",
    rate: 0,
    amount: 0,
  });
  const [availableItems, setAvailableItems] = useState<any[]>([]);
  const [techniciansItems, setTechniciansItems] = useState<TechnicianItem[]>([]);

  // Fetch available items.
  useEffect(() => {
    fetchItems()
      .then((data) => setAvailableItems(data))
      .catch((err) => console.error("Error fetching items", err));
  }, []);

  // Auto-compute amount when qty or rate changes.
  useEffect(() => {
    const computedAmount = Number(newItem.rate) * Number(newItem.qty);
    if (computedAmount !== newItem.amount) {
      setNewItem((prev) => ({ ...prev, amount: computedAmount }));
    }
  }, [newItem.qty, newItem.rate]);

  // Update local state if prefillData changes.
  useEffect(() => {
    if (prefillData) {
      if (prefillData.service_order) setServiceOrder(prefillData.service_order);
      if (prefillData.customer) setCustomer(prefillData.customer);
      if (prefillData.service_type) setServiceType(prefillData.service_type);
      if (prefillData.items) setItems(prefillData.items);
      if (prefillData.startDate) setStartDate(prefillData.startDate);
      if (prefillData.startTime) setStartTime(prefillData.startTime);
      if (prefillData.finishTime) setFinishTime(prefillData.finishTime);
      if (prefillData.defaultTechnician) {
        const selectedTech = technicians.find(t => t.name === prefillData.defaultTechnician);
        setTechniciansItems([{
          doctype: "Service Technician Item",
          parentfield: "service_technicians",
          parenttype: "Service Appointment",
          service_technician: prefillData.defaultTechnician,
          full_name: selectedTech ? selectedTech.full_name : "",
        }]);
      }
    }
  }, [prefillData, technicians]);

  // Auto-fill Customer, Service Type, and Items when a Service Order is selected.
  useEffect(() => {
    if (serviceOrder) {
      const order = orders.find((o) => o.name === serviceOrder);
      if (order) {
        setCustomer(order.customer || "");
        setServiceType(order.type || "");
        if (order.items) {
          const mappedItems = order.items.map((it: any) => ({
            doctype: "Service Order Item",
            parentfield: "items",
            parenttype: "Service Appointment",
            item_code: it.item_code || "",
            qty: Number(it.qty) || 1,
            item_name: it.item_name || "",
            rate: it.rate ? Number(it.rate) : 0,
            amount: it.amount ? Number(it.amount) : 0,
          }));
          setItems(mappedItems);
        }
      }
    }
  }, [serviceOrder, orders]);

  // Reset form fields when dialog closes.
  const resetForm = () => {
    setServiceOrder("");
    setCustomer("");
    setServiceType("");
    setStartDate("");
    setStartTime("");
    setFinishTime("");
    setItems([]);
    setNewItem({ item_code: "", qty: 1, item_name: "", rate: 0, amount: 0 });
    setTechniciansItems([]);
    setErrorMessage("");
    setSuccessMessage("");
    setValidationErrors([]);
  };

  useEffect(() => {
    if (!isOpen) resetForm();
  }, [isOpen]);

  // -----------------------------
  // Helper functions for items and technicians
  // -----------------------------
  const addItem = () => {
    if (!newItem.item_code || newItem.qty <= 0) {
      setErrorMessage("Item Code and a quantity greater than 0 are required.");
      return;
    }
    const itemToAdd: Item = {
      doctype: "Service Order Item",
      parentfield: "items",
      parenttype: "Service Appointment",
      item_code: newItem.item_code,
      qty: newItem.qty,
      item_name: newItem.item_name,
      rate: newItem.rate,
      amount: newItem.amount,
    };
    setItems([...items, itemToAdd]);
    setNewItem({ item_code: "", qty: 1, item_name: "", rate: 0, amount: 0 });
    setErrorMessage("");
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const addTechnician = () => {
    setTechniciansItems([
      ...techniciansItems,
      {
        doctype: "Service Technician Item",
        parentfield: "service_technicians",
        parenttype: "Service Appointment",
        service_technician: "",
        full_name: "",
      },
    ]);
  };

  const removeTechnician = (index: number) => {
    setTechniciansItems(techniciansItems.filter((_, i) => i !== index));
  };

  const handleTechnicianSelect = (index: number, techName: string) => {
    const selectedTech = technicians.find((t) => t.name === techName);
    const updated = { ...techniciansItems[index] };
    updated.service_technician = techName;
    updated.full_name = selectedTech ? selectedTech.full_name : "";
    const newTechs = [...techniciansItems];
    newTechs[index] = updated;
    setTechniciansItems(newTechs);
  };

  // -----------------------------
  // Render helper functions
  // -----------------------------
  const renderOverviewFields = () => (
    <div className="grid grid-cols-2 gap-4 py-4">
      <div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="serviceOrder" className="text-right text-xs">Service Order</Label>
          <Select value={serviceOrder} onValueChange={(val: string) => setServiceOrder(val)}>
            <SelectTrigger className="w-full text-xs min-w-[120px]">
              <SelectValue placeholder="Select Order" />
            </SelectTrigger>
            <SelectContent className="min-w-[120px]">
              {filteredOrders.map((order) => (
                <SelectItem key={order.name} value={order.name}>
                  {order.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-4 items-center gap-4 mt-3">
          <Label htmlFor="customer" className="text-right text-xs">Customer</Label>
          <Input
            id="customer"
            className="col-span-3 h-8 text-xs"
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
            readOnly={!!prefillData?.customer}
          />
        </div>
        <div className="grid grid-cols-4 items-center gap-4 mt-3">
          <Label htmlFor="serviceType" className="text-right text-xs">Service Type</Label>
          <Input
            id="serviceType"
            className="col-span-3 h-8 text-xs"
            value={serviceType}
            onChange={(e) => setServiceType(e.target.value)}
            readOnly={!!prefillData?.service_type}
          />
        </div>
        <div className="grid grid-cols-4 items-center gap-4 mt-3">
          <Label htmlFor="postingDate" className="text-right text-xs">Posting Date</Label>
          <Input id="postingDate" type="date" className="col-span-3 h-8 text-xs" value={postingDate} readOnly />
        </div>
      </div>
      <div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="startDate" className="text-right text-xs">Start Date</Label>
          <Input
            id="startDate"
            type="date"
            className="col-span-3 h-8 text-xs"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-4 items-center gap-4 mt-3">
          <Label htmlFor="startTime" className="text-right text-xs">Start Time</Label>
          <Input
            id="startTime"
            type="time"
            step="600"
            className="col-span-3 h-8 text-xs"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-4 items-center gap-4 mt-3">
          <Label htmlFor="finishTime" className="text-right text-xs">Finish Time</Label>
          <Input
            id="finishTime"
            type="time"
            step="600"
            className="col-span-3 h-8 text-xs"
            value={finishTime}
            onChange={(e) => setFinishTime(e.target.value)}
          />
        </div>
      </div>
    </div>
  );

  const renderItemsTable = () => (
    <div className="py-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs">Item Code</TableHead>
            <TableHead className="text-xs">Item Name</TableHead>
            <TableHead className="text-xs">Quantity</TableHead>
            <TableHead className="text-xs">Rate</TableHead>
            <TableHead className="text-xs">Amount</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((it, index) => (
            <TableRow key={index}>
              <TableCell className="text-xs">{it.item_code}</TableCell>
              <TableCell className="text-xs">{it.item_name || "-"}</TableCell>
              <TableCell className="text-xs">{it.qty}</TableCell>
              <TableCell className="text-xs">{it.rate || "-"}</TableCell>
              <TableCell className="text-xs">{it.amount || "-"}</TableCell>
              <TableCell>
                <Button variant="ghost" size="sm" onClick={() => removeItem(index)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {/* New item input row */}
          <TableRow>
            <TableCell>
              <Select
                value={newItem.item_code}
                onValueChange={(val: string) => {
                  const selected = availableItems.find(item => item.item_code === val);
                  if (selected) {
                    setNewItem((prev) => ({
                      ...prev,
                      item_code: val,
                      item_name: selected.item_name,
                      rate: Number(selected.standard_rate) || 0,
                    }));
                  }
                }}
              >
                <SelectTrigger className="w-full text-xs">
                  <SelectValue placeholder="Select Item" />
                </SelectTrigger>
                <SelectContent>
                  {availableItems.map((item) => (
                    <SelectItem key={item.item_code} value={item.item_code}>
                      {item.item_code} - {item.item_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </TableCell>
            <TableCell>
              <Input
                value={newItem.item_name}
                readOnly
                placeholder="Item Name"
                className="text-xs"
              />
            </TableCell>
            <TableCell>
              <Input
                type="number"
                value={newItem.qty}
                onChange={(e) => setNewItem({ ...newItem, qty: Number(e.target.value) })}
                placeholder="Qty"
                className="text-xs"
              />
            </TableCell>
            <TableCell>
              <Input
                type="number"
                value={newItem.rate}
                onChange={(e) => setNewItem({ ...newItem, rate: Number(e.target.value) })}
                placeholder="Rate"
                className="text-xs"
              />
            </TableCell>
            <TableCell>
              <Input
                type="number"
                value={newItem.amount}
                readOnly
                placeholder="Amount"
                className="text-xs"
              />
            </TableCell>
            <TableCell>
              <Button variant="ghost" size="sm" onClick={addItem}>
                <Plus className="h-4 w-4" />
              </Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );

  const renderTechniciansTable = () => (
    <div className="py-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs">Technician</TableHead>
            <TableHead className="text-xs">Name</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {techniciansItems.map((tech, index) => (
            <TableRow key={index}>
              <TableCell>
                <Select
                  value={tech.service_technician}
                  onValueChange={(val: string) => handleTechnicianSelect(index, val)}
                >
                  <SelectTrigger className="w-full text-xs">
                    <SelectValue placeholder="Select technician" />
                  </SelectTrigger>
                  <SelectContent>
                    {technicians.map((t) => (
                      <SelectItem key={t.name} value={t.name}>
                        {t.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell className="text-xs">{tech.full_name || "-"}</TableCell>
              <TableCell>
                <Button variant="ghost" size="sm" onClick={() => removeTechnician(index)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="mt-4 flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={addTechnician}>
          <Plus className="h-4 w-4" />
          <span className="text-xs">Add Technician</span>
        </Button>
      </div>
    </div>
  );

  // -----------------------------
  // Functions for submission
  // -----------------------------
  const handleSchedule = (changed_status: string) => {
    if (!serviceOrder) {
      setErrorMessage("Service Order is required.");
      return;
    }
    if (!startDate) {
      setErrorMessage("Start Date is required.");
      return;
    }
    if (!startTime) {
      setErrorMessage("Start Time is required.");
      return;
    }
    if (!finishTime) {
      setErrorMessage("Finish Time is required.");
      return;
    }
    if (techniciansItems.length === 0 || techniciansItems.some((tech) => !tech.service_technician)) {
      setErrorMessage("At least one Service Technician must be selected.");
      return;
    }
    setErrorMessage("");
    setValidationErrors([]);
    setChangedStatus(changed_status);
    confirmAndSubmit(changed_status);
  };

  const hasOverlap = (updatedAppointment, allAppointments) => {
    const technicianId = updatedAppointment.service_technicians[0]?.service_technician;
    const start = dayjs(updatedAppointment.scheduled_start_datetime);
    const end = dayjs(updatedAppointment.scheduled_finish_datetime);
  
    return allAppointments.some((apt) => {
      if (apt.name === updatedAppointment.name) return false; // skip the same appointment
  
      const aptStart = dayjs(apt.scheduled_start_datetime);
      const aptEnd = dayjs(apt.scheduled_finish_datetime);
  
      const isSameTechnician = apt.service_technicians.some(
        (tech) => tech.service_technician === technicianId
      );
  
      return isSameTechnician && start.isBefore(aptEnd) && end.isAfter(aptStart);
    });
  };

  const confirmAndSubmit = async (changed_status: string) => {
    let errors: string[] = [];
    const timeRangeResult = validateTimeRange(startTime, finishTime);
    if (timeRangeResult !== true) errors.push(timeRangeResult as string);
    const durationResult = validateMinimumDuration(startTime, finishTime, 60);
    if (durationResult !== true) errors.push(durationResult as string);
    const businessResult = validateBusinessHours(startTime, finishTime, "07:00", "19:00");
    if (businessResult !== true) errors.push(businessResult as string);
    const serviceOrderResult = validateNonEmptyField(serviceOrder, "Service Order");
    if (serviceOrderResult !== true) errors.push(serviceOrderResult as string);

    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    const scheduled_start_datetime = dayjs(`${startDate} ${startTime}`).format("YYYY-MM-DDTHH:mm");
    const scheduled_finish_datetime = dayjs(`${startDate} ${finishTime}`).format("YYYY-MM-DDTHH:mm");

    console.log("scheduled_start_datetime", scheduled_start_datetime);
    console.log("scheduled_finish_datetime", scheduled_finish_datetime);

    const appointmentPayload = {
      posting_date: postingDate,
      service_order: serviceOrder,
      customer: customer,
      scheduled_start_datetime: scheduled_start_datetime,
      scheduled_finish_datetime: scheduled_finish_datetime,
      service_technicians: techniciansItems,
      items: items,
      changed_status: changed_status,
    };
    console.log(appointmentPayload);

    const overlapExists = hasOverlap(appointmentPayload, appointments);

    if (overlapExists) {
      setErrorMessage("Time Overlap! The technician already has an appointment during the selected time.");
      // toast.error("This technician already has an appointment during the selected time.", {
      //   style: {
      //     background: "#fef2f2",
      //     color: "#991b1b",
      //     fontWeight: "bold",
      //   },
      // });
      return;
    }


    try {
      const result = await createAppointment(appointmentPayload);
      console.log(result);
      if (result) {
        setSuccessMessage("Appointment created and submitted successfully!");
        refreshResources();
        setTimeout(() => {
          setSuccessMessage("");
          onClose();
        }, 2000);
      } else {
        setErrorMessage(result.message || "Error creating appointment.");
      }
    } catch (error: any) {
      setErrorMessage(error.message || "An unexpected error occurred.");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px] p-4">
        <DialogHeader className="flex flex-col">
          <DialogTitle className="text-lg">Create Appointment</DialogTitle>
          <DialogDescription className="text-sm">
            Fill in the details to create a new appointment.
          </DialogDescription>
        </DialogHeader>
        {/* Message display area */}
        {(validationErrors.length > 0 || errorMessage || successMessage) && (
          <div className="mt-2">
            {validationErrors.length > 0 && (
              <div className="bg-red-100 text-red-800 p-2 rounded mb-3 flex flex-col space-y-1 text-xs">
                {validationErrors.map((err, idx) => (
                  <div key={idx} className="flex items-center space-x-1">
                    <Trash2 size={16} />
                    <span>{err}</span>
                  </div>
                ))}
              </div>
            )}
            {errorMessage && (
              <div className="bg-red-100 text-red-800 p-2 rounded mb-3 flex items-center text-xs">
                <Trash2 size={16} />
                <span>{errorMessage}</span>
              </div>
            )}
            {successMessage && (
              <div className="bg-green-100 text-green-800 p-2 rounded mb-3 flex items-center text-xs">
                <span>{successMessage}</span>
              </div>
            )}
          </div>
        )}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
            <TabsTrigger value="items" className="text-xs">Items</TabsTrigger>
            <TabsTrigger value="technicians" className="text-xs">Technicians</TabsTrigger>
          </TabsList>
          <TabsContent value="overview">{renderOverviewFields()}</TabsContent>
          <TabsContent value="items">{renderItemsTable()}</TabsContent>
          <TabsContent value="technicians">{renderTechniciansTable()}</TabsContent>
        </Tabs>
        <DialogFooter className="flex justify-end space-x-2 mt-4">
          <Button variant="ghost" size="sm" onClick={resetForm}>
            <RotateCcw className="h-4 w-4" />
            <span className="hidden sm:inline text-xs">Reset</span>
          </Button>
          <Button onClick={() => handleSchedule("Scheduled")} size="sm" className="text-xs">
            Schedule
          </Button>
          <Button onClick={() => handleSchedule("Dispatched")} size="sm" className="text-xs">
            Schedule &amp; Dispatch
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CreateDialog;
