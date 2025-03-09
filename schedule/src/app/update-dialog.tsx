"use client";

import { ChangeEvent, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "../components/ui/dialog";
import { Button } from "../components/ui/button";
import { Label } from "../components/ui/label";
import { Input } from "../components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { Plus, Trash2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { fetchItems } from "../lib/appointments-api";
import { useCalendar } from "../lib/context";
import { validateTimeRange, validateMinimumDuration, validateBusinessHours } from "../lib/validations";


import dayjs from "dayjs";

export interface UpdateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: {
    name: string;
    service_order: string;
    posting_date: string;
    customer: string;
    service_type: string;
    scheduled_start_datetime: string;
    scheduled_finish_datetime: string;
    items: any[];
    service_technicians: any[];
  };
  onChange: (field: string, value: any) => void;
  onConfirm: () => void;
}

export default function UpdateDialog({
  isOpen,
  onClose,
  appointment,
  onChange,
  onConfirm,
}: UpdateDialogProps) {
  const [availableItems, setAvailableItems] = useState<any[]>([]);
  const [availableTechs, setAvailableTechs] = useState<any[]>([]);
  const { technicians } = useCalendar();

  useEffect(() => {
    fetchItems()
      .then((items) => setAvailableItems(items))
      .catch((error) => console.error("Error fetching items:", error));
  }, []);

  useEffect(() => {
    setAvailableTechs(technicians);
  }, [technicians]);

  // Local state for new item row inputs.
  const [newItem, setNewItem] = useState({
    item_code: "",
    item_name: "",
    qty: 1,
    rate: 0,
    amount: 0,
  });
  useEffect(() => {
    const computedAmount = Number(newItem.qty) * Number(newItem.rate);
    if (computedAmount !== newItem.amount) {
      setNewItem((prev) => ({ ...prev, amount: computedAmount }));
    }
  }, [newItem.qty, newItem.rate]);

  // Local state for new technician row inputs.
  const [newTech, setNewTech] = useState({ service_technician: "", full_name: "" });

  const addItem = () => {
    onChange("items", [...appointment.items, newItem]);
    setNewItem({ item_code: "", qty: 1, item_name: "", rate: 0, amount: 0 });
  };

  const removeItem = (index: number) => {
    const updated = appointment.items.filter((_: any, i: number) => i !== index);
    onChange("items", updated);
  };

  const addTech = () => {
    onChange("service_technicians", [...appointment.service_technicians, newTech]);
    setNewTech({ service_technician: "", full_name: "" });
  };

  const removeTech = (index: number) => {
    const updated = appointment.service_technicians.filter((_: any, i: number) => i !== index);
    onChange("service_technicians", updated);
  };

  const handleTechnicianSelect = (index: number, techName: string) => {
    const selectedTech = availableTechs.find((t) => t.name === techName);
    onChange(`service_technicians.${index}.service_technician`, techName);
    onChange(`service_technicians.${index}.full_name`, selectedTech ? selectedTech.full_name : "");
  };

  // Local state for inline validation errors.
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Validate before confirming update.
  const confirmUpdate = () => {
    const errors: string[] = [];
    const startStr = dayjs(appointment.scheduled_start_datetime).format("YYYY-MM-DDTHH:mm");
    const finishStr = dayjs(appointment.scheduled_finish_datetime).format("YYYY-MM-DDTHH:mm");
    const startTimeLocal = startStr.split("T")[1];
    const finishTimeLocal = finishStr.split("T")[1];
    const timeRangeResult = validateTimeRange(startTimeLocal, finishTimeLocal);
    if (timeRangeResult !== true) errors.push(timeRangeResult);
    const durationResult = validateMinimumDuration(startTimeLocal, finishTimeLocal);
    if (durationResult !== true) errors.push(durationResult);
    const businessResult = validateBusinessHours(startTimeLocal, finishTimeLocal, "07:00", "19:00");
    if (businessResult !== true) errors.push(businessResult);

    console.log("Validation errors:", startStr, finishStr, errors);
    

    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors([]);
    onConfirm();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px] p-4">
        <DialogHeader>
          <DialogTitle className="text-sm">Update Appointment</DialogTitle>
          <DialogDescription className="text-xs">
            Review and adjust the appointment details below.
          </DialogDescription>
        </DialogHeader>
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
        <Tabs defaultValue="overview" className="w-full text-xs mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
            <TabsTrigger value="items" className="text-xs">Items</TabsTrigger>
            <TabsTrigger value="technicians" className="text-xs">Technicians</TabsTrigger>
          </TabsList>
          {/* Overview Tab */}
          <TabsContent value="overview" className="text-xs mt-2">
            <div className=" flex grid grid-cols-2 gap-4 py-4">
              <div>
                <Label className="text-sm">Service Order</Label>
                <Input type="text" value={appointment.service_order} readOnly className="text-xs" />
                <Label className="text-sm mt-2">Posting Date</Label>
                <Input type="date" value={dayjs(appointment.posting_date).format("YYYY-MM-DD")} readOnly className="text-xs" />
                <Label className="text-sm mt-2">Customer</Label>
                <Input type="text" value={appointment.customer} readOnly className="text-xs" />
              </div>
              <div>
                <Label className="text-sm">Service Type</Label>
                <Input type="text" value={appointment.service_type} readOnly className="text-xs" />
                <Label className="text-sm mt-2">Scheduled Start</Label>
                <Input
                  type="datetime-local"
                  value={dayjs(appointment.scheduled_start_datetime).format("YYYY-MM-DDTHH:mm")}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    onChange("scheduled_start_datetime", dayjs(e.target.value).toISOString())
                  }
                  className="text-xs"
                />
                <Label className="text-sm mt-2">Scheduled Finish</Label>
                <Input
                  type="datetime-local"
                  value={dayjs(appointment.scheduled_finish_datetime).format("YYYY-MM-DDTHH:mm")}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    onChange("scheduled_finish_datetime", dayjs(e.target.value).toISOString())
                  }
                  className="text-xs"
                />
              </div>
            </div>
          </TabsContent>
          {/* Items Tab */}
          <TabsContent value="items" className="text-xs mt-2">
            <div className="py-4">
              <Table className="text-xs">
                <TableHeader>
                  <TableRow>
                    <TableHead className="px-1 py-1 text-xs">Item Code</TableHead>
                    <TableHead className="px-1 py-1 text-xs">Item Name</TableHead>
                    <TableHead className="px-1 py-1 text-xs">Quantity</TableHead>
                    <TableHead className="px-1 py-1 text-xs">Rate</TableHead>
                    <TableHead className="px-1 py-1 text-xs">Amount</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {appointment.items.map((it: any, index: number) => (
                    <TableRow key={index} className="text-xs">
                      <TableCell className="px-1 py-1 text-xs">{it.item_code}</TableCell>
                      <TableCell className="px-1 py-1 text-xs">{it.item_name || "-"}</TableCell>
                      <TableCell className="px-1 py-1 text-xs">{it.qty}</TableCell>
                      <TableCell className="px-1 py-1 text-xs">{it.rate || "-"}</TableCell>
                      <TableCell className="px-1 py-1 text-xs">{it.amount || "-"}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => removeItem(index)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="text-xs">
                    <TableCell className="px-1 py-1 text-xs">
                      <Select
                        value={newItem.item_code}
                        onValueChange={(val: string) => {
                          const selected = availableItems.find((item) => item.item_code === val);
                          if (selected) {
                            const rate = Number(selected.standard_rate) || 0;
                            const qty = Number(newItem.qty) || 0;
                            setNewItem({
                              ...newItem,
                              item_code: val,
                              item_name: selected.item_name,
                              rate,
                              amount: rate * qty,
                            });
                          } else {
                            setNewItem({ ...newItem, item_code: val });
                          }
                        }}
                      >
                        <SelectTrigger className="w-full text-xs">
                          <SelectValue placeholder="Select Item" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableItems.map((item) => (
                            <SelectItem key={item.name} value={item.item_code}>
                              {item.item_code} - {item.item_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="px-1 py-1 text-xs">
                      <Input
                        type="text"
                        placeholder="Item Name"
                        value={newItem.item_name}
                        onChange={(e) => setNewItem({ ...newItem, item_name: e.target.value })}
                        className="text-xs"
                      />
                    </TableCell>
                    <TableCell className="px-1 py-1 text-xs">
                      <Input
                        type="number"
                        placeholder="Qty"
                        value={newItem.qty}
                        onChange={(e) => {
                          const qty = Number(e.target.value);
                          setNewItem((prev) => {
                            const rate = Number(prev.rate) || 0;
                            return { ...prev, qty, amount: rate * qty };
                          });
                        }}
                        className="text-xs"
                      />
                    </TableCell>
                    <TableCell className="px-1 py-1 text-xs">
                      <Input
                        type="number"
                        placeholder="Rate"
                        value={newItem.rate}
                        onChange={(e) => {
                          const rate = Number(e.target.value);
                          setNewItem((prev) => {
                            const qty = Number(prev.qty) || 0;
                            return { ...prev, rate, amount: rate * qty };
                          });
                        }}
                        className="text-xs"
                      />
                    </TableCell>
                    <TableCell className="px-1 py-1 text-xs">
                      <Input type="number" placeholder="Amount" value={newItem.amount} readOnly className="text-xs" />
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
          </TabsContent>
          <TabsContent value="technicians" className="text-xs mt-2">
            <div className="py-4">
              <Table className="text-xs">
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Technician</TableHead>
                    <TableHead className="text-xs">Full Name</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {appointment.service_technicians.map((tech: any, index: number) => (
                    <TableRow key={index} className="text-xs">
                      <TableCell className="px-1 py-1 text-xs">
                        <Select
                          value={tech.service_technician}
                          onValueChange={(val: string) => handleTechnicianSelect(index, val)}
                        >
                          <SelectTrigger className="w-full text-xs">
                            <SelectValue placeholder="Select Technician" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableTechs.map((t) => (
                              <SelectItem key={t.name} value={t.name}>
                                {t.name} - {t.full_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="px-1 py-1 text-xs">
                        <Input type="text" value={tech.full_name || "-"} readOnly className="text-xs" />
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => removeTech(index)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="mt-4 flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={addTech}>
                  <Plus className="h-4 w-4" />
                  <span className="text-xs hidden sm:inline">Add Technician</span>
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
        <DialogFooter className="mt-4 flex justify-end space-x-2">
          <Button variant="ghost" size="sm" onClick={() => onClose()} className="text-xs">
            Cancel
          </Button>
          <Button onClick={confirmUpdate} size="sm" className="text-xs">
            Confirm Update
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
