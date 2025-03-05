"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs"
import { Label } from "../components/ui/label"
import { Input } from "../components/ui/input"
import { Button } from "../components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table"
import { Plus, Trash2 } from "lucide-react"
import { useState } from "react"

interface AddDialogProps {
  isOpen: boolean
  onClose: () => void
  type: "technicians" | "orders" | "appointments"
}

export function AddDialog({ isOpen, onClose, type }: AddDialogProps) {
  const [activeTab, setActiveTab] = useState("overview")
  const [items, setItems] = useState<any[]>([])
  const [technicians, setTechnicians] = useState<any[]>([])
  const [newItem, setNewItem] = useState({ code: "", name: "", quantity: "", rate: "", amount: "" })
  const [newTechnician, setNewTechnician] = useState({ name: "", employeeId: "" })

  const renderOverviewFields = () => {
    switch (type) {
      case "technicians":
        return (
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="technicianName" className="text-right">
                Technician Name
              </Label>
              <Input id="technicianName" className="col-span-3 h-8" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="employee" className="text-right">
                Employee
              </Label>
              <Input id="employee" className="col-span-3 h-8" />
            </div>
          </div>
        )
      case "orders":
        return (
          <div className="grid grid-cols-2 gap-4 py-4">
            <div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="postingDate" className="text-right">
                  Posting Date
                </Label>
                <Input id="postingDate" type="date" className="col-span-3 h-8" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4 mt-4">
                <Label htmlFor="dueDate" className="text-right">
                  Due Date
                </Label>
                <Input id="dueDate" type="date" className="col-span-3 h-8" />
              </div>
            </div>
            <div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="customer" className="text-right">
                  Customer
                </Label>
                <Input id="customer" className="col-span-3 h-8" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4 mt-4">
                <Label htmlFor="serviceAddress" className="text-right">
                  Service Address
                </Label>
                <Input id="serviceAddress" className="col-span-3 h-8" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4 mt-4">
                <Label htmlFor="contactPerson" className="text-right">
                  Contact Person
                </Label>
                <Input id="contactPerson" className="col-span-3 h-8" />
              </div>
            </div>
          </div>
        )
      case "appointments":
        return (
          <div className="grid grid-cols-2 gap-4 py-4">
            <div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="serviceOrder" className="text-right">
                  Service Order
                </Label>
                <Input id="serviceOrder" className="col-span-3 h-8" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4 mt-4">
                <Label htmlFor="customer" className="text-right">
                  Customer
                </Label>
                <Input id="customer" className="col-span-3 h-8" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4 mt-4">
                <Label htmlFor="postingDate" className="text-right">
                  Posting Date
                </Label>
                <Input id="postingDate" type="date" className="col-span-3 h-8" />
              </div>
            </div>
            <div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="scheduledStartDate" className="text-right">
                  Start Date
                </Label>
                <Input id="scheduledStartDate" type="date" className="col-span-3 h-8" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4 mt-4">
                <Label htmlFor="scheduledFinishDate" className="text-right">
                  Finish Date
                </Label>
                <Input id="scheduledFinishDate" type="date" className="col-span-3 h-8" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4 mt-4">
                <Label htmlFor="startTime" className="text-right">
                  Start Time
                </Label>
                <Input id="startTime" type="time" className="col-span-3 h-8" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4 mt-4">
                <Label htmlFor="finishTime" className="text-right">
                  Finish Time
                </Label>
                <Input id="finishTime" type="time" className="col-span-3 h-8" />
              </div>
            </div>
          </div>
        )
    }
  }

  const renderItemsTable = () => (
    <div className="py-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Item Code</TableHead>
            <TableHead>Item Name</TableHead>
            <TableHead>Quantity</TableHead>
            <TableHead>Rate</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item, index) => (
            <TableRow key={index}>
              <TableCell>{item.code}</TableCell>
              <TableCell>{item.name}</TableCell>
              <TableCell>{item.quantity}</TableCell>
              <TableCell>{item.rate}</TableCell>
              <TableCell>{item.amount}</TableCell>
              <TableCell>
                <Button variant="ghost" size="sm" onClick={() => removeItem(index)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="mt-4 flex gap-2">
        <Input
          placeholder="Item Code"
          value={newItem.code}
          onChange={(e) => setNewItem({ ...newItem, code: e.target.value })}
          className="h-7 text-xs"
        />
        <Input
          placeholder="Item Name"
          value={newItem.name}
          onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
          className="h-7 text-xs"
        />
        <Input
          placeholder="Quantity"
          value={newItem.quantity}
          onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })}
          className="h-7 text-xs"
        />
        <Input
          placeholder="Rate"
          value={newItem.rate}
          onChange={(e) => setNewItem({ ...newItem, rate: e.target.value })}
          className="h-7 text-xs"
        />
        <Input
          placeholder="Amount"
          value={newItem.amount}
          onChange={(e) => setNewItem({ ...newItem, amount: e.target.value })}
          className="h-7 text-xs"
        />
        <Button onClick={addItem} size="sm" className="h-7">
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )

  const renderTechniciansTable = () => (
    <div className="py-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Technician Name</TableHead>
            <TableHead>Employee ID</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {technicians.map((technician, index) => (
            <TableRow key={index}>
              <TableCell>{technician.name}</TableCell>
              <TableCell>{technician.employeeId}</TableCell>
              <TableCell>
                <Button variant="ghost" size="sm" onClick={() => removeTechnician(index)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="mt-4 flex gap-2">
        <Input
          placeholder="Technician Name"
          value={newTechnician.name}
          onChange={(e) => setNewTechnician({ ...newTechnician, name: e.target.value })}
          className="h-7 text-xs"
        />
        <Input
          placeholder="Employee ID"
          value={newTechnician.employeeId}
          onChange={(e) => setNewTechnician({ ...newTechnician, employeeId: e.target.value })}
          className="h-7 text-xs"
        />
        <Button onClick={addTechnician} size="sm" className="h-7">
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )

  const addItem = () => {
    if (newItem.code && newItem.name && newItem.quantity && newItem.rate && newItem.amount) {
      setItems([...items, newItem])
      setNewItem({ code: "", name: "", quantity: "", rate: "", amount: "" })
    }
  }

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const addTechnician = () => {
    if (newTechnician.name && newTechnician.employeeId) {
      setTechnicians([...technicians, newTechnician])
      setNewTechnician({ name: "", employeeId: "" })
    }
  }

  const removeTechnician = (index: number) => {
    setTechnicians(technicians.filter((_, i) => i !== index))
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px]">
        <DialogHeader>
          <DialogTitle>Add {type.slice(0, -1)}</DialogTitle>
        </DialogHeader>
        {type === "technicians" ? (
          <div className="grid gap-4 py-4">{renderOverviewFields()}</div>
        ) : (
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="items">Items</TabsTrigger>
              <TabsTrigger value="technicians">Technicians</TabsTrigger>
            </TabsList>
            <TabsContent value="overview">{renderOverviewFields()}</TabsContent>
            <TabsContent value="items">{renderItemsTable()}</TabsContent>
            <TabsContent value="technicians">{renderTechniciansTable()}</TabsContent>
          </Tabs>
        )}
        <div className="flex justify-end">
          <Button onClick={onClose} size="sm">
            Add
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

