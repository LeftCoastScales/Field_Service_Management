import { useState, useEffect } from 'react'
import './App.css'
import { CreateAppointmentDialog } from './components/CreateAppointmentDialog'
import {
	FrappeProvider,
} from 'frappe-react-sdk'

interface ServiceTechnician {
  name: string;
  parent: string;
  parentfield: string;
  parenttype: string;
  idx: number;
  service_technician: string;
  employee: string;
}

interface ServiceItem {
  name: string;
  parent: string;
  parentfield: string;
  parenttype: string;
  idx: number;
  item_code: string;
  qty: number;
}

interface ServiceAppointment {
  name: string;
  service_order: string;
  service_type: string;
  posting_date: string;
  status: string;
  customer: string;
  scheduled_start_datetime: string;
  scheduled_finish_datetime: string;
  items: ServiceItem[];
  service_technicians: ServiceTechnician[];
}

const TestComponent = () => {
  const [appointments, setAppointments] = useState<ServiceAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<ServiceAppointment | null>(null);
  const [dialogMode, setDialogMode] = useState<'create' | 'reschedule'>('create');

  const fetchAppointments = async () => {
    try {
      const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      };
      
      const listResponse = await fetch('/api/resource/Service Appointment?fields=["name"]', {
        headers
      });
      const listData = await listResponse.json();
      
      if (!listData.data) throw new Error('No appointments found');

      const detailedAppointments = await Promise.all(
        listData.data.map(async (app: { name: string }) => {
          const response = await fetch(`/api/resource/Service Appointment/${app.name}`);
          const data = await response.json();
          return data.data;
        })
      );

      setAppointments(detailedAppointments);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setLoading(false);
    }
  };
 

  const handleCreateAppointment = async (formData: any) => {
    try {
      const response = await fetch('/api/resource/Service Appointment', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-Frappe-CSRF-Token': localStorage.getItem('csrf_token') || '',
        },
        body: JSON.stringify({
          doctype: 'Service Appointment',
          service_order: formData.service_order,
          service_type: formData.service_type,
          posting_date: formData.posting_date,
          due_date: formData.due_date,
          scheduled_start_datetime: formData.scheduled_start_datetime,
          scheduled_finish_datetime: formData.scheduled_finish_datetime,
          items: formData.items.map((item: any) => ({
            doctype: 'Service Appointment Item',
            parentfield: 'items',
            parenttype: 'Service Appointment',
            item_code: item.item_code,
            qty: item.qty
          })),
          service_technicians: formData.service_technicians.map((tech: any) => ({
            doctype: 'Service Appointment Technician',
            parentfield: 'service_technicians',
            parenttype: 'Service Appointment',
            service_technician: tech.service_technician,
            employee: tech.employee
          }))
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.exc || 'Failed to create appointment');
      }

      setIsDialogOpen(false);
      fetchAppointments();
    } catch (error) {
      console.error('Error creating appointment:', error);
      alert(error.message);
    }
  };

  const handleRescheduleAppointment = async (formData: any) => {
    if (!selectedAppointment) return;

    try {
      const response = await fetch(`/api/resource/Service Appointment/${selectedAppointment.name}`, {
        method: 'PUT',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-Frappe-CSRF-Token': localStorage.getItem('csrf_token') || '',
        },
        body: JSON.stringify({
          doctype: 'Service Appointment',
          name: selectedAppointment.name,
          scheduled_start_datetime: formData.scheduled_start_datetime,
          scheduled_finish_datetime: formData.scheduled_finish_datetime,
          due_date: formData.due_date
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.exc || 'Failed to reschedule appointment');
      }

      setIsDialogOpen(false);
      setSelectedAppointment(null);
      fetchAppointments();
    } catch (error) {
      console.error('Error rescheduling appointment:', error);
      alert(error.message);
    }
  };

  const handleAppointmentAction = async (formData: any) => {
    if (dialogMode === 'create') {
      await handleCreateAppointment(formData);
    } else {
      await handleRescheduleAppointment(formData);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, []);

  if (loading) return <div className="p-4">Loading...</div>;
  if (error) return <div className="p-4 text-red-500">Error: {error}</div>;

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Service Appointments</h1>
        <button
          onClick={() => setIsDialogOpen(true)}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          Create Appointment
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {appointments.map((appointment) => (
          <div key={appointment.name} className="bg-white shadow-lg rounded-lg p-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">{appointment.name}</h2>
              <span className={`px-2 py-1 rounded text-sm ${
                appointment.status === 'Completed' ? 'bg-green-100 text-green-800' :
                appointment.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {appointment.status}
              </span>
            </div>
            
            <div className="space-y-2">
              <p><span className="font-medium">Customer:</span> {appointment.customer}</p>
              <p><span className="font-medium">Service Type:</span> {appointment.service_type}</p>
              <p><span className="font-medium">Start Date:</span> {new Date(appointment.scheduled_start_datetime).toLocaleDateString()}</p>
              <p><span className="font-medium">Start Time:</span> {new Date(appointment.scheduled_start_datetime).toLocaleTimeString()}</p>
              <p><span className="font-medium">Finish Time:</span> {new Date(appointment.scheduled_finish_datetime).toLocaleTimeString()}</p>
              
              <div className="mt-4">
                <h3 className="font-medium mb-2">Technicians:</h3>
                <div className="space-y-1">
                  {appointment.service_technicians.map((tech) => (
                    <div key={tech.service_technician} className="flex justify-between text-sm">
                      <span>{tech.service_technician}</span>
                      <span>{tech.employee}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4">
                <h3 className="font-medium mb-2">Items:</h3>
                <div className="space-y-1">
                  {appointment.items.map((item) => (
                    <div key={item.name} className="flex justify-between text-sm">
                      <span>{item.item_code}</span>
                      <span>Qty: {item.qty}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {appointment.status === 'Scheduled' && (
              <button
                onClick={() => {
                  setSelectedAppointment(appointment);
                  setDialogMode('reschedule');
                  setIsDialogOpen(true);
                }}
                className="mt-4 w-full bg-yellow-500 text-white px-4 py-2 rounded"
              >
                Reschedule
              </button>
            )}
          </div>
        ))}
      </div>

      <CreateAppointmentDialog
        isOpen={isDialogOpen}
        onClose={() => {
          setIsDialogOpen(false);
          setSelectedAppointment(null);
          setDialogMode('create');
        }}
        onSubmit={handleAppointmentAction}
        mode={dialogMode}
        appointmentData={selectedAppointment}
      />
    </div>
  );
};

function App() {
  return (
    <div className="App bg-gray-100 min-h-screen">
      <FrappeProvider
        siteName={import.meta.env.VITE_SITE_NAME}
        socketPort={import.meta.env.VITE_SOCKET_PORT}
      >
        <TestComponent />
      </FrappeProvider>
    </div>
  )
}

export default App


