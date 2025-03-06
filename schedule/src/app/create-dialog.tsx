// components/add-dialog.tsx
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
import { fetchItems } from "../lib/appointments-api";

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

export interface AppointmentPrefill {
  service_order?: string;
  customer?: string;
  service_type?: string;
  items?: Item[];
}

interface AddDialogProps {
  isOpen: boolean;
  onClose: () => void;
  prefillData?: AppointmentPrefill;
}

export function CreateDialog({ isOpen, onClose, prefillData }: AddDialogProps) {
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
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

  // Technicians state – now with 'id' field instead of employee.
  const [techniciansItems, setTechniciansItems] = useState<TechnicianItem[]>([]);

  // Update local state if prefillData changes (for auto filling from an Order).
  useEffect(() => {
    if (prefillData) {
      if (prefillData.service_order) {
        setServiceOrder(prefillData.service_order);
      }
      if (prefillData.customer) {
        setCustomer(prefillData.customer);
      }
      if (prefillData.service_type) {
        setServiceType(prefillData.service_type);
      }
      if (prefillData.items) {
        setItems(prefillData.items);
      }
    }
  }, [prefillData]);

  // When a service order is selected, prefill customer, service type, and items from global orders.
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
  };

  useEffect(() => {
    if (!isOpen) {
      resetForm();
    }
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

  // Confirmation dialog.
  const ConfirmationDialog = () => (
    <Dialog open={confirmOpen} onOpenChange={(open) => !open && setConfirmOpen(false)}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Confirm Appointment</DialogTitle>
          <DialogDescription>Please review the appointment details below.</DialogDescription>
        </DialogHeader>
        <div className="mt-4">
          {Object.entries(appointmentSummary).map(([key, value]) => (
            <div key={key} className="flex">
              <span className="font-medium w-32">{key}:</span>
              <span className="flex-1">{value || "-"}</span>
            </div>
          ))}
        </div>
        <div className="mt-4">
          <p className="font-medium">Items:</p>
          <Table className="mt-2">
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Item Code</TableHead>
                <TableHead className="text-xs">Item Name</TableHead>
                <TableHead className="text-xs">Quantity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((it, index) => (
                <TableRow key={index}>
                  <TableCell className="text-xs">{it.item_code}</TableCell>
                  <TableCell className="text-xs">{it.item_name || "-"}</TableCell>
                  <TableCell className="text-xs">{it.qty}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="mt-4">
          <p className="font-medium">Service Technicians:</p>
          <Table className="mt-2">
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Technician</TableHead>
                <TableHead className="text-xs">Name</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {techniciansItems.map((tech, index) => (
                <TableRow key={index}>
                  <TableCell className="text-xs">{tech.service_technician}</TableCell>
                  <TableCell className="text-xs">{tech.full_name || "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <DialogFooter className="mt-4 flex justify-end space-x-2">
          <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
            Cancel
          </Button>
          <Button onClick={() => { setConfirmOpen(false); confirmAndSubmit(); }}>
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  // Submit the appointment: create the draft then submit it.
  const confirmAndSubmit = async () => {
    if (items.length === 0) {
      setErrorMessage("Please add at least one valid item.");
      return;
    }
    // Format datetimes to "YYYY-MM-DD HH:MM:SS"
    const scheduled_start_datetime = formatDateTime(startDate, startTime);
    const scheduled_finish_datetime = formatDateTime(startDate, finishTime);

    // Build the appointment object.
    const appointment: Appointment = {
      name: "",
      posting_date: postingDate,
      service_order: serviceOrder,
      customer,
      service_type: serviceType,
      scheduled_start_datetime,
      scheduled_finish_datetime,
      status: "scheduled",
      priority: "",
      resourceType: "appointment",
      items: items,
      service_technicians: techniciansItems,
    };

    try {
      const headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
      };
      // Create the appointment draft.
      const response = await fetch("/api/resource/Service Appointment", {
        method: "POST",
        headers,
        body: JSON.stringify(appointment),
      });
      const result = await response.json();
      if (!response.ok) {
        setErrorMessage(result.exc || "Error creating appointment.");
        return;
      }
      const appointmentName = result.data.name;

      // Now submit the appointment using the document-level API.
      const submitResponse = await fetch(
        `/api/v2/document/Service Appointment/${appointmentName}/method/submit`,
        {
          method: "POST",
          headers,
          body: "{}",
        }
      );
      const submitResult = await submitResponse.json();
      if (!submitResponse.ok) {
        console.error("Submit error:", submitResult);
        setErrorMessage(submitResult.exc || "Error submitting appointment.");
        return;
      }
      setSuccessMessage("Appointment created and submitted successfully!");
      setTimeout(() => {
        setSuccessMessage("");
        onClose();
      }, 1500);
    } catch (error: any) {
      setErrorMessage(error.message || "An unexpected error occurred.");
    }
  };

  const handleSubmit = () => {
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
    if (
      techniciansItems.length === 0 ||
      techniciansItems.some((tech) => !tech.service_technician)
    ) {
      setErrorMessage("At least one Service Technician must be selected.");
      return;
    }
    setErrorMessage("");
    setConfirmOpen(true);
  };

  // Render Overview tab fields.
  const renderOverviewFields = () => (
    <div className="grid grid-cols-2 gap-4 py-4">
      <div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="serviceOrder" className="text-right">
            Service Order
          </Label>
          <Select value={serviceOrder} onValueChange={(val: string) => setServiceOrder(val)}>
            <SelectTrigger className="w-full text-xs min-w-[200px]">
              <SelectValue placeholder="Select Order" />
            </SelectTrigger>
            <SelectContent className="min-w-[180px]">
              {filteredOrders.map((order) => (
                <SelectItem key={order.name} value={order.name}>
                  {order.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-4 items-center gap-4 mt-4">
          <Label htmlFor="customer" className="text-right">
            Customer
          </Label>
          <Input
            id="customer"
            className="col-span-3 h-8"
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
            readOnly={!!prefillData?.customer}
          />
        </div>
        <div className="grid grid-cols-4 items-center gap-4 mt-4">
          <Label htmlFor="serviceType" className="text-right">
            Service Type
          </Label>
          <Input
            id="serviceType"
            className="col-span-3 h-8"
            value={serviceType}
            onChange={(e) => setServiceType(e.target.value)}
            readOnly={!!prefillData?.service_type}
          />
        </div>
        <div className="grid grid-cols-4 items-center gap-4 mt-4">
          <Label htmlFor="postingDate" className="text-right">
            Posting Date
          </Label>
          <Input id="postingDate" type="date" className="col-span-3 h-8" value={postingDate} readOnly />
        </div>
      </div>
      <div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="startDate" className="text-right">
            Start Date
          </Label>
          <Input
            id="startDate"
            type="date"
            className="col-span-3 h-8"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-4 items-center gap-4 mt-4">
          <Label htmlFor="startTime" className="text-right">
            Start Time
          </Label>
          <Input
            id="startTime"
            type="time"
            className="col-span-3 h-8"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-4 items-center gap-4 mt-4">
          <Label htmlFor="finishTime" className="text-right">
            Finish Time
          </Label>
          <Input
            id="finishTime"
            type="time"
            className="col-span-3 h-8"
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
          {/* New item input row with item_code as Select */}
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
        <DialogContent className="sm:max-w-[800px]">
          <DialogHeader className="flex flex-col">
            <DialogTitle>Create Appointment</DialogTitle>
            <DialogDescription>
              Fill in the details to create a new appointment.
            </DialogDescription>
          </DialogHeader>
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
          {errorMessage && <p className="text-red-600 text-sm mt-2">{errorMessage}</p>}
          {successMessage && <p className="text-green-600 text-sm mt-2">{successMessage}</p>}
          <DialogFooter className="flex justify-end space-x-2">
            {/* Reset button positioned left of Submit */}
            <Button variant="ghost" size="sm" onClick={resetForm}>
              <RotateCcw className="h-4 w-4" />
              <span className="hidden sm:inline">Reset</span>
            </Button>
            <Button onClick={handleSubmit} size="sm">Create & Submit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {confirmOpen && <ConfirmationDialog />}
    </>
  );
}

export default CreateDialog;
