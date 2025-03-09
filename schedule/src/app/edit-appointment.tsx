import React from "react";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Technician } from "../lib/types";
import { AlertTriangle } from "lucide-react";

interface EditValues {
  date: string;
  start: string;
  end: string;
  techId: string;
}

interface EditAppointmentProps {
  editValues: EditValues;
  handleChange: (field: keyof EditValues, value: string) => void;
  technicians: Technician[];
  onCancel: () => void;
  onConfirm: () => void;
  techReadOnly?: boolean;
  errorMessages?: string[];
}

const EditAppointment: React.FC<EditAppointmentProps> = ({
  editValues,
  handleChange,
  technicians,
  onCancel,
  onConfirm,
  techReadOnly = false,
  errorMessages = [],
}) => {
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50">
      <div className="bg-white rounded-lg p-4 w-72 shadow-lg">
        <h4 className="text-sm font-semibold mb-3">Edit Appointment</h4>
        {errorMessages.length > 0 && (
          <div className="bg-red-100 text-red-800 p-2 rounded mb-3 flex flex-col space-y-1 text-xs">
            {errorMessages.map((err, idx) => (
              <div key={idx} className="flex items-center space-x-1">
                <AlertTriangle size={16} />
                <span>{err}</span>
              </div>
            ))}
          </div>
        )}
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Date</label>
          <Input
            type="date"
            value={editValues.date}
            onChange={(e) => handleChange("date", e.target.value)}
            className="w-full text-xs px-2 py-1"
          />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Start</label>
          <Input
            type="time"
            value={editValues.start}
            onChange={(e) => handleChange("start", e.target.value)}
            className="w-full text-xs px-2 py-1"
          />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">End</label>
          <Input
            type="time"
            value={editValues.end}
            onChange={(e) => handleChange("end", e.target.value)}
            className="w-full text-xs px-2 py-1"
          />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Technician</label>
          <select
            value={editValues.techId}
            onChange={(e) => handleChange("techId", e.target.value)}
            className="w-full border border-gray-300 rounded text-xs px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
            disabled={techReadOnly}
          >
            {technicians.map((tech) => (
              <option key={tech.name} value={tech.name}>
                {tech.full_name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex justify-end space-x-2">
          <Button variant="secondary" onClick={onCancel} className="text-xs px-3">
            Cancel
          </Button>
          <Button onClick={onConfirm} className="text-xs px-3">
            Confirm
          </Button>
        </div>
      </div>
    </div>
  );
};

export default EditAppointment;
