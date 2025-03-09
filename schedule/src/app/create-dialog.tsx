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
import type { Appointment } from "../lib/types";
import { fetchItems, createAppointment } from "../lib/appointments-api";
import dayjs from "dayjs";

// Import validations
import {
  validateTimeRange,
  validateMinimumDuration,
  validateBusinessHours,
  validateNonEmptyField,
} from "../lib/validations";

export interface AppointmentPrefill {
  service_order?: string;
  customer?: string;
  service_type?: string;
  items?: Item[];
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
  id: string;
  full_name?: string;
}

interface AddDialogProps {
  isOpen: boolean;
  onClose: () => void;
  prefillData?: AppointmentPrefill;
}

export function CreateDialog({ isOpen, onClose, prefillData }: AddDialogProps) {
  // Message and validation states.
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { orders, technicians, appointments } = useCalendar();
  const filteredOrders = orders.filter((order) => {
    const hasNoLinkedAppointment = !appointments.some(app => app.service_order === order.name);
    return hasNoLinkedAppointment && order.docstatus === 1 && order.status === "Open";
  });

  const todayStr = new Date().toISOString().split("T")[0];
  const [serviceOrder, setServiceOrder] = useState(prefillData?.service_order || "");
  const [customer, setCustomer] = useState(prefillData?.customer || "");
  const [serviceType, setServiceType] = useState(prefillData?.service_type || "");
  const [postingDate] = useState(todayStr);
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [finishTime, setFinishTime] = useState("");
  const [changedStatus, setChangedStatus] = useState("Scheduled");

  // Items state – each item includes Frappe-required metadata.
  const [items, setItems] = useState<Item[]>(prefillData?.items || []);
  // New item input state.
  const [newItem, setNewItem] = useState<Omit<Item, "doctype" | "parentfield" | "parenttype">>({
    item_code: "",
    qty: 1,
    item_name: "",
    rate: 0,
    amount: 0,
  });
  // Available items list fetched from backend.
  const [availableItems, setAvailableItems] = useState<any[]>([]);
  useEffect(() => {
    fetchItems()
      .then((data) => setAvailableItems(data))
      .catch((err) => console.error("Error fetching items", err));
  }, []);

  // Auto compute amount when qty or rate changes.
  useEffect(() => {
    const computedAmount = Number(newItem.rate) * Number(newItem.qty);
    if (computedAmount !== newItem.amount) {
      setNewItem((prev) => ({ ...prev, amount: computedAmount }));
    }
  }, [newItem.qty, newItem.rate]);

  // Technicians state – now with 'id' field.
  const [techniciansItems, setTechniciansItems] = useState<TechnicianItem[]>([]);

  // Update local state if prefillData changes.
  useEffect(() => {
    if (prefillData) {
      if (prefillData.service_order) setServiceOrder(prefillData.service_order);
      if (prefillData.customer) setCustomer(prefillData.customer);
      if (prefillData.service_type) setServiceType(prefillData.service_type);
      if (prefillData.items) setItems(prefillData.items);
    }
  }, [prefillData]);

  // When a service order is selected, prefill customer, service type, and items.
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

  // Helper: format a date/time string into "YYYY-MM-DD HH:MM:SS" format.
  const formatDateTime = (date: string, time: string) => {
    const dt = new Date(`${date}T${time}`);
    return dt.toISOString().replace("T", " ").split(".")[0];
  };

  // Add a new item row.
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

  // Add a new technician row.
  const addTechnician = () => {
    setTechniciansItems([
      ...techniciansItems,
      {
        doctype: "Service Technician Item",
        parentfield: "service_technicians",
        parenttype: "Service Appointment",
        full_name: "",
        service_technician: "",
        id: "",
      },
    ]);
  };

  const removeTechnician = (index: number) => {
    setTechniciansItems(techniciansItems.filter((_, i) => i !== index));
  };

  // Handle technician selection.
  const handleTechnicianSelect = (index: number, techName: string) => {
    const selectedTech = technicians.find((t) => t.name === techName);
    const updated = { ...techniciansItems[index] };
    updated.service_technician = techName;
    updated.id = selectedTech ? selectedTech.name : "";
    updated.full_name = selectedTech ? selectedTech.full_name : "";
    const newTechs = [...techniciansItems];
    newTechs[index] = updated;
    setTechniciansItems(newTechs);
  };

  // Reset form fields.
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

  // Build appointment summary for confirmation.
  const appointmentSummary = {
    "Service Order": serviceOrder,
    Customer: customer,
    "Service Type": serviceType,
    "Posting Date": postingDate,
    "Start Date": startDate,
    "Start Time": startTime,
    "Finish Time": finishTime,
  };

  // Confirmation dialog with tabbed view for Items and Technicians.
  const ConfirmationDialog = () => (
    <Dialog open={confirmOpen} onOpenChange={(open) => !open && setConfirmOpen(false)}>
      <DialogContent className="sm:max-w-[400px] p-4">
        <DialogHeader>
          <DialogTitle className="text-sm">Confirm Appointment</DialogTitle>
          <DialogDescription className="text-xs">
            Review the details below before confirming.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          {Object.entries(appointmentSummary).map(([key, value]) => (
            <div key={key} className="flex flex-col">
              <span className="font-medium">{key}</span>
              <span>{value || "-"}</span>
            </div>
          ))}
        </div>
        {/* Tabbed view for Items and Service Technicians */}
        <div className="mt-3">
          <Tabs defaultValue="items" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="items" className="text-xs">Items</TabsTrigger>
              <TabsTrigger value="technicians" className="text-xs">Technicians</TabsTrigger>
            </TabsList>
            <TabsContent value="items">
              <Table className="mt-2 text-xs">
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Qty</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((it, index) => (
                    <TableRow key={index}>
                      <TableCell>{it.item_code}</TableCell>
                      <TableCell>{it.qty}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>
            <TabsContent value="technicians">
              <Table className="mt-2 text-xs">
                <TableHeader>
                  <TableRow>
                    <TableHead>Technician</TableHead>
                    <TableHead>Name</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {techniciansItems.map((tech, index) => (
                    <TableRow key={index}>
                      <TableCell>{tech.service_technician}</TableCell>
                      <TableCell>{tech.full_name || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>
        </div>
        <DialogFooter className="mt-3 flex justify-end space-x-2">
          <Button variant="ghost" onClick={() => setConfirmOpen(false)} className="text-xs">
            Cancel
          </Button>
          <Button
            onClick={() => { setConfirmOpen(false); setChangedStatus('Scheduled'); confirmAndSubmit('Scheduled'); }}
            className="text-xs"
          >
            Schedule
          </Button>
          <Button
            onClick={() => { setConfirmOpen(false); setChangedStatus('Dispatched'); confirmAndSubmit('Dispatched'); }}
            className="text-xs"
          >
            Schedule &amp; Dispatch
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  // Submit the appointment using the createAppointment API.
  // The function now accepts a parameter for changed_status.
  const confirmAndSubmit = async (changed_status: any) => {
    // Clear previous validations.
    setValidationErrors([]);
    let errors: string[] = [];

    // Run validations.
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

    // Format datetimes.
    const scheduled_start_datetime = formatDateTime(startDate, startTime);
    const scheduled_finish_datetime = formatDateTime(startDate, finishTime);

    // Build the payload using only the keys expected by your backend.
    const appointmentPayload = {
      posting_date: postingDate,
      service_order: serviceOrder, 
      customer:customer,
      scheduled_start_datetime: scheduled_start_datetime,
      scheduled_finish_datetime:scheduled_finish_datetime,
      service_technicians: techniciansItems,
      items:items,
      changed_status: changed_status,
    };
    console.log(appointmentPayload);
    
    try {
      const result = await createAppointment(appointmentPayload);
      console.log(result);
      
      if (result) {
        setSuccessMessage("Appointment created and submitted successfully!");
        setTimeout(() => {
          setSuccessMessage("");
          onClose();
        }, 1500);
      } else {
        setErrorMessage(result.message || "Error creating appointment.");
      }
    } catch (error: any) {
      setErrorMessage(error.message || "An unexpected error occurred.");
    }
  };

  const handleSubmit = () => {
    // Basic field validations.
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
    setConfirmOpen(true);
  };

  // Render Overview tab fields.
  const renderOverviewFields = () => (
    <div className="grid grid-cols-2 gap-4 py-4">
      <div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="serviceOrder" className="text-right text-xs">
            Service Order
          </Label>
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
          <Label htmlFor="customer" className="text-right text-xs">
            Customer
          </Label>
          <Input
            id="customer"
            className="col-span-3 h-8 text-xs"
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
            readOnly={!!prefillData?.customer}
          />
        </div>
        <div className="grid grid-cols-4 items-center gap-4 mt-3">
          <Label htmlFor="serviceType" className="text-right text-xs">
            Service Type
          </Label>
          <Input
            id="serviceType"
            className="col-span-3 h-8 text-xs"
            value={serviceType}
            onChange={(e) => setServiceType(e.target.value)}
            readOnly={!!prefillData?.service_type}
          />
        </div>
        <div className="grid grid-cols-4 items-center gap-4 mt-3">
          <Label htmlFor="postingDate" className="text-right text-xs">
            Posting Date
          </Label>
          <Input id="postingDate" type="date" className="col-span-3 h-8 text-xs" value={postingDate} readOnly />
        </div>
      </div>
      <div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="startDate" className="text-right text-xs">
            Start Date
          </Label>
          <Input
            id="startDate"
            type="date"
            className="col-span-3 h-8 text-xs"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-4 items-center gap-4 mt-3">
          <Label htmlFor="startTime" className="text-right text-xs">
            Start Time
          </Label>
          <Input
            id="startTime"
            type="time"
            className="col-span-3 h-8 text-xs"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-4 items-center gap-4 mt-3">
          <Label htmlFor="finishTime" className="text-right text-xs">
            Finish Time
          </Label>
          <Input
            id="finishTime"
            type="time"
            className="col-span-3 h-8 text-xs"
            value={finishTime}
            onChange={(e) => setFinishTime(e.target.value)}
          />
        </div>
      </div>
    </div>
  );

  // Render Items tab.
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

  // Render Technicians tab.
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

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[800px] p-4">
          <DialogHeader className="flex flex-col">
            <DialogTitle className="text-lg">Create Appointment</DialogTitle>
            <DialogDescription className="text-sm">
              Fill in the details to create a new appointment.
            </DialogDescription>
          </DialogHeader>
          {/* Error / Success / Validation Messages */}
          {(errorMessage || successMessage || validationErrors.length > 0) && (
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
              {errorMessage && <p className="text-red-600 text-sm">{errorMessage}</p>}
              {successMessage && <p className="text-green-600 text-sm">{successMessage}</p>}
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
            <Button onClick={handleSubmit} size="sm" className="text-xs">
              Proceed
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {confirmOpen && <ConfirmationDialog />}
    </>
  );
}

export default CreateDialog;
