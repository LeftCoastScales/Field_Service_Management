import React from "react";
import { Technician } from "../lib/types";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { AlertTriangle } from "lucide-react";

interface TeamUpdateDialogProps {
  oldTech: Technician;
  newTech: Technician;
  newStart: string;
  newEnd: string;
  otherAssignedTechs: { service_technician: string; full_name: string }[];
  onTimeChange: (field: "start" | "end", value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  errorMessages?: string[];
}

const TeamUpdateDialog: React.FC<TeamUpdateDialogProps> = ({
  oldTech,
  newTech,
  newStart,
  newEnd,
  otherAssignedTechs,
  onTimeChange,
  onConfirm,
  onCancel,
  errorMessages = [],
}) => {
  const isSameTech = oldTech.name === newTech.name;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-500 bg-opacity-75">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
        <h3 className="text-lg font-semibold mb-4">Team Appointment Update</h3>
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
        {isSameTech ? (
          <p className="mb-4 text-sm">
            This is a team event assigned to <strong>{oldTech.full_name}</strong>.
            Changing the time will update this same appointment for all team members.
          </p>
        ) : (
          <p className="mb-4 text-sm">
            You are reassigning the appointment from <strong>{oldTech.full_name}</strong> to <strong>{newTech.full_name}</strong>.
          </p>
        )}
        <div className="flex space-x-4 mb-4">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-700 mb-1">New Start</label>
            <Input
              type="time"
              value={newStart}
              onChange={(e) => onTimeChange("start", e.target.value)}
              className="w-full text-xs px-2 py-1"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-700 mb-1">New End</label>
            <Input
              type="time"
              value={newEnd}
              onChange={(e) => onTimeChange("end", e.target.value)}
              className="w-full text-xs px-2 py-1"
            />
          </div>
        </div>
        {otherAssignedTechs.length > 0 && (
          <div className="mb-4">
            <p className="mb-2 text-xs">
              This same appointment will be updated for the following technicians:
            </p>
            <ul className="list-disc ml-5 text-xs">
              {otherAssignedTechs.map((tech) => (
                <li key={tech.service_technician} className="text-gray-700">
                  {tech.full_name}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex justify-end space-x-4">
          <Button
            size="sm"
            className="bg-gray-300 text-gray-700 rounded text-sm hover:bg-gray-200"
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button size="sm" onClick={onConfirm}>
            Confirm
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TeamUpdateDialog;
