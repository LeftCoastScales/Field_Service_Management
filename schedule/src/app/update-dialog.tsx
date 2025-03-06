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
import dayjs from "dayjs";
import { fetchItems } from "../lib/appointments-api";
import { updateAppointment } from "../lib/appointments-api";
import { useCalendar } from "../lib/context";

export interface UpdateDialogProps {
    isOpen: boolean;
    onClose: () => void;
    // The full appointment object – all fields are available.
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
    // onChange callback; for nested fields use dot notation (e.g., "items.0.item_code")
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

    // Fetch available items once when the dialog mounts.
    useEffect(() => {
        fetchItems()
            .then((items) => setAvailableItems(items))
            .catch((error) => console.error("Error fetching items:", error));
    }, []);

    useEffect(() => {
        setAvailableTechs(technicians);
    }, [technicians]);

    // Local state for new row inputs.
    const [newItem, setNewItem] = useState({ item_code: "", item_name: "", qty: 1, rate: 0, amount: 0 });
    // Auto compute newItem.amount when qty or rate changes.
    useEffect(() => {
        const computedAmount = Number(newItem.qty) * Number(newItem.rate);
        if (computedAmount !== newItem.amount) {
            setNewItem((prev) => ({ ...prev, amount: computedAmount }));
        }
    }, [newItem.qty, newItem.rate]);

    // Note: newTech now uses "service_technician" as the key.
    const [newTech, setNewTech] = useState({ service_technician: "", full_name: "" });

    const addItem = () => {
        onChange("items", [...appointment.items, newItem]);
        setNewItem({ item_code: "", item_name: "", qty: 1, rate: 0, amount: 0 });
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

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[800px]">
                <DialogHeader>
                    <DialogTitle>Update Appointment</DialogTitle>
                    <DialogDescription>
                        Review and adjust the appointment details below. You can edit all fields.
                    </DialogDescription>
                </DialogHeader>
                <Tabs defaultValue="overview" className="w-full mt-4">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="overview" className="text-xs">
                            Overview
                        </TabsTrigger>
                        <TabsTrigger value="items" className="text-xs">
                            Items
                        </TabsTrigger>
                        <TabsTrigger value="technicians" className="text-xs">
                            Technicians
                        </TabsTrigger>
                    </TabsList>
                    {/* Overview Tab */}
                    <TabsContent value="overview">
                        <div className="grid grid-cols-2 gap-4 py-4">
                            <div>
                                <Label>Service Order</Label>
                                <Input type="text" value={appointment.service_order} readOnly />
                            </div>
                            <div>
                                <Label>Posting Date</Label>
                                <Input type="date" value={dayjs(appointment.posting_date).format("YYYY-MM-DD")} readOnly />
                            </div>
                            <div>
                                <Label>Customer</Label>
                                <Input type="text" value={appointment.customer} readOnly />
                            </div>
                            <div>
                                <Label>Service Type</Label>
                                <Input type="text" value={appointment.service_type} readOnly />
                            </div>
                            <div>
                                <Label>Scheduled Start</Label>
                                <Input
                                    type="datetime-local"
                                    value={dayjs(appointment.scheduled_start_datetime).format("YYYY-MM-DDTHH:mm")}
                                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                        onChange("scheduled_start_datetime", dayjs(e.target.value).toISOString())
                                    }
                                />
                            </div>
                            <div>
                                <Label>Scheduled Finish</Label>
                                <Input
                                    type="datetime-local"
                                    value={dayjs(appointment.scheduled_finish_datetime).format("YYYY-MM-DDTHH:mm")}
                                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                        onChange("scheduled_finish_datetime", dayjs(e.target.value).toISOString())
                                    }
                                />
                            </div>
                        </div>
                    </TabsContent>
                    {/* Items Tab */}
                    <TabsContent value="items">
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
                                    {appointment.items.map((it: any, index: number) => (
                                        <TableRow key={index}>
                                            <TableCell className="text-xs">
                                                <Select
                                                    value={it.item_code}
                                                    onValueChange={(val: string) => {
                                                        const selected = availableItems.find(
                                                            (item) => item.item_code === val
                                                        );
                                                        if (selected) {
                                                            onChange(`items.${index}.item_code`, val);
                                                            onChange(`items.${index}.item_name`, selected.item_name);
                                                            const rate = Number(selected.standard_rate) || 0;
                                                            onChange(`items.${index}.rate`, rate);
                                                            const qty = Number(it.qty) || 0;
                                                            onChange(`items.${index}.amount`, rate * qty);
                                                        } else {
                                                            onChange(`items.${index}.item_code`, val);
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
                                            <TableCell className="text-xs">
                                                <Input
                                                    type="text"
                                                    value={it.item_name}
                                                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                                        onChange(`items.${index}.item_name`, e.target.value)
                                                    }
                                                />
                                            </TableCell>
                                            <TableCell className="text-xs">
                                                <Input
                                                    type="number"
                                                    value={it.qty}
                                                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                                                        const qty = Number(e.target.value);
                                                        onChange(`items.${index}.qty`, qty);
                                                        const rate = Number(it.rate) || 0;
                                                        onChange(`items.${index}.amount`, rate * qty);
                                                    }}
                                                />
                                            </TableCell>
                                            <TableCell className="text-xs">
                                                <Input
                                                    type="number"
                                                    value={it.rate}
                                                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                                                        const rate = Number(e.target.value);
                                                        onChange(`items.${index}.rate`, rate);
                                                        const qty = Number(it.qty) || 0;
                                                        onChange(`items.${index}.amount`, rate * qty);
                                                    }}
                                                />
                                            </TableCell>
                                            <TableCell className="text-xs">
                                                <Input
                                                    type="number"
                                                    value={it.amount}
                                                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                                        onChange(`items.${index}.amount`, Number(e.target.value))
                                                    }
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Button variant="ghost" size="sm" onClick={() => removeItem(index)}>
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    <TableRow>
                                        <TableCell className="text-xs">
                                            <Select
                                                value={newItem.item_code}
                                                onValueChange={(val: string) => {
                                                    const selected = availableItems.find(
                                                        (item) => item.item_code === val
                                                    );
                                                    if (selected) {
                                                        const rate = Number(selected.standard_rate) || 0;
                                                        const qty = Number(newItem.qty) || 0;
                                                        const amount = rate * qty;
                                                        setNewItem({
                                                            ...newItem,
                                                            item_code: val,
                                                            item_name: selected.item_name,
                                                            rate,
                                                            amount,
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
                                        <TableCell className="text-xs">
                                            <Input
                                                type="text"
                                                placeholder="Item Name"
                                                value={newItem.item_name}
                                                onChange={(e) => setNewItem({ ...newItem, item_name: e.target.value })}
                                            />
                                        </TableCell>
                                        <TableCell className="text-xs">
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
                                            />
                                        </TableCell>
                                        <TableCell className="text-xs">
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
                                            />
                                        </TableCell>
                                        <TableCell className="text-xs">
                                            <Input
                                                type="number"
                                                placeholder="Amount"
                                                value={newItem.amount}
                                                readOnly
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
                    </TabsContent>
                    {/* Technicians Tab */}
                    <TabsContent value="technicians">
                        <div className="py-4">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="text-xs">Service Technician</TableHead>
                                        <TableHead className="text-xs">Full Name</TableHead>
                                        <TableHead></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {appointment.service_technicians.map((tech: any, index: number) => (
                                        <TableRow key={index}>
                                            <TableCell className="text-xs">
                                                <Select
                                                    value={tech.service_technician}
                                                    onValueChange={(val: string) => {
                                                        const selectedTech = availableTechs.find((t) => t.name === val);
                                                        if (selectedTech) {
                                                            onChange(`service_technicians.${index}.service_technician`, selectedTech.name);
                                                            onChange(`service_technicians.${index}.full_name`, selectedTech.full_name);
                                                        }
                                                    }}
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
                                            <TableCell className="text-xs">
                                                <Input
                                                    type="text"
                                                    value={tech.full_name}
                                                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                                        onChange(`service_technicians.${index}.full_name`, e.target.value)
                                                    }
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Button variant="ghost" size="sm" onClick={() => removeTech(index)}>
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    <TableRow>
                                        <TableCell className="text-xs">
                                            <Select
                                                value={newTech.service_technician}
                                                onValueChange={(val: string) => {
                                                    const selectedTech = availableTechs.find((t) => t.name === val);
                                                    if (selectedTech) {
                                                        setNewTech({
                                                            service_technician: selectedTech.name,
                                                            full_name: selectedTech.full_name,
                                                        });
                                                    }
                                                }}
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
                                        <TableCell className="text-xs">
                                            <Input
                                                type="text"
                                                placeholder="Full Name"
                                                value={newTech.full_name}
                                                onChange={(e) => setNewTech({ ...newTech, full_name: e.target.value })}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Button variant="ghost" size="sm" onClick={addTech}>
                                                <Plus className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </div>
                    </TabsContent>
                </Tabs>
                <DialogFooter className="mt-4 flex justify-end space-x-2">
                    <Button variant="ghost" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button onClick={onConfirm}>Confirm Update</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
