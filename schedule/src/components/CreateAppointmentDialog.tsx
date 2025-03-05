import { useState, useEffect } from 'react';

interface ServiceOrder {
  name: string;
  customer: string;
  status: string;
}

interface ServiceTechnician {
  name: string;
  employee: string;
  full_name: string;
}

interface Item {
  doctype: string;
  parentfield: string;
  parenttype: string;
  item_code: string;
  qty: number;
}

interface TechnicianItem {
  doctype: string;
  parentfield: string;
  parenttype: string;
  service_technician: string;
  employee: string;
}

interface TabProps {
  items: Item[];
  onItemsChange: (items: Item[]) => void;
  technicians: TechnicianItem[];
  onTechniciansChange: (techs: TechnicianItem[]) => void;
}

const ItemsTab = ({ items, onItemsChange }: TabProps) => {
  const addItem = () => {
    // Create new row with required Frappe metadata
    onItemsChange([
      ...items,
      {
        doctype: 'Service Order Item',
        parentfield: 'items',
        parenttype: 'Service Appointment',
        item_code: '',
        qty: 1
      }
    ]);
  };

  return (
    <div className="p-4">
      <table className="w-full">
        <thead>
          <tr>
            <th>Item Code</th>
            <th>Quantity</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={index}>
              <td>
                <input
                  type="text"
                  value={item.item_code}
                  onChange={(e) => {
                    const newItems = [...items];
                    newItems[index].item_code = e.target.value;
                    onItemsChange(newItems);
                  }}
                  className="border p-1 rounded"
                />
              </td>
              <td>
                <input
                  type="number"
                  value={item.qty}
                  onChange={(e) => {
                    const newItems = [...items];
                    newItems[index].qty = parseFloat(e.target.value);
                    onItemsChange(newItems);
                  }}
                  className="border p-1 rounded w-20"
                />
              </td>
              <td>
                <button
                  onClick={() => onItemsChange(items.filter((_, i) => i !== index))}
                  className="text-red-500"
                >
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        onClick={addItem}
        className="mt-2 bg-blue-500 text-white px-4 py-2 rounded"
      >
        Add Item
      </button>
    </div>
  );
};

const TechniciansTab = ({ technicians, onTechniciansChange }: TabProps) => {
  const [availableTechnicians, setAvailableTechnicians] = useState<ServiceTechnician[]>([]);

  useEffect(() => {
    const fetchTechnicians = async () => {
      try {
        const response = await fetch(
          '/api/resource/Service Technician?fields=["name","employee","full_name"]'
        );
        const data = await response.json();
        if (data.data) {
          setAvailableTechnicians(data.data);
        }
      } catch (error) {
        console.error('Error fetching technicians:', error);
      }
    };
    fetchTechnicians();
  }, []);

  const addTechnician = () => {
    onTechniciansChange([
      ...technicians,
      {
        doctype: 'Service Technician Item',
        parentfield: 'service_technicians',
        parenttype: 'Service Appointment',
        service_technician: '',
        employee: ''
      }
    ]);
  };

  return (
    <div className="p-4">
      <table className="w-full">
        <thead>
          <tr>
            <th>Technician</th>
            <th>Employee</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {technicians.map((tech, index) => (
            <tr key={index}>
              <td>
                <select
                  value={tech.service_technician}
                  onChange={(e) => {
                    const newTechs = [...technicians];
                    const selectedTech = availableTechnicians.find(t => t.name === e.target.value);
                    newTechs[index] = {
                      ...newTechs[index],
                      service_technician: e.target.value,
                      employee: selectedTech?.employee || ''
                    };
                    onTechniciansChange(newTechs);
                  }}
                  className="border p-1 rounded w-full"
                >
                  <option value="">Select Technician</option>
                  {availableTechnicians.map((t) => (
                    <option key={t.name} value={t.name}>
                      {t.full_name} ({t.name})
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <input
                  type="text"
                  value={tech.employee}
                  disabled
                  className="border p-1 rounded w-full bg-gray-100"
                />
              </td>
              <td>
                <button
                  onClick={() => onTechniciansChange(technicians.filter((_, i) => i !== index))}
                  className="text-red-500"
                >
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        onClick={addTechnician}
        className="mt-2 bg-blue-500 text-white px-4 py-2 rounded"
      >
        Add Technician
      </button>
    </div>
  );
};

interface ServiceAppointment {
  name: string;
  service_order: string;
  customer: string;
  service_type: string;
  posting_date: string;
  due_date: string;
  scheduled_start_datetime: string;
  scheduled_finish_datetime: string;
  items: Item[];
  service_technicians: TechnicianItem[];
}

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  mode?: 'create' | 'reschedule';
  appointmentData?: ServiceAppointment;
}

export const CreateAppointmentDialog = ({
  isOpen,
  onClose,
  mode = 'create',
  appointmentData
}: DialogProps) => {
  const [serviceOrders, setServiceOrders] = useState<ServiceOrder[]>([]);
  const [formData, setFormData] = useState<ServiceAppointment>({
    name: '',
    service_order: '',
    customer: '',
    service_type: '',
    posting_date: new Date().toISOString().split('T')[0],
    due_date: new Date().toISOString().split('T')[0],
    scheduled_start_datetime: '',
    scheduled_finish_datetime: '',
    items: [],
    service_technicians: []
  });
  const [activeTab, setActiveTab] = useState('main');

  useEffect(() => {
    if (mode === 'reschedule' && appointmentData) {
      // For reschedule, we expect appointmentData to contain all mandatory data including items.
      const startDate = new Date(appointmentData.scheduled_start_datetime);
      const finishDate = new Date(appointmentData.scheduled_finish_datetime);
      setFormData({
        ...appointmentData,
        posting_date: appointmentData.posting_date,
        due_date: appointmentData.due_date || appointmentData.posting_date,
        scheduled_start_datetime: `${appointmentData.posting_date} ${startDate
          .toTimeString()
          .slice(0, 5)}:00`,
        scheduled_finish_datetime: `${appointmentData.posting_date} ${finishDate
          .toTimeString()
          .slice(0, 5)}:00`
      });
    }
  }, [mode, appointmentData]);

  // Fetch Service Order details and ensure customer is set
  const fetchServiceOrderDetails = async (orderName: string) => {
    try {
      const response = await fetch(`/api/resource/Service Order/${orderName}`);
      const data = await response.json();
      const orderData = data.data;
      if (!orderData) {
        throw new Error('No service order data found');
      }
      if (!orderData.customer) {
        throw new Error('Service Order does not contain a customer');
      }
      setFormData((prev) => ({
        ...prev,
        service_order: orderName,
        customer: orderData.customer,
        service_type: orderData.service_type || '',
        items: Array.isArray(orderData.items)
          ? orderData.items.map((item: any) => ({
              doctype: 'Service Order Item',
              parentfield: 'items',
              parenttype: 'Service Appointment',
              item_code: item.item_code || '',
              qty: item.qty || 0
            }))
          : [],
        service_technicians: Array.isArray(orderData.service_technicians)
          ? orderData.service_technicians.map((tech: any) => ({
              doctype: 'Service Technician Item',
              parentfield: 'service_technicians',
              parenttype: 'Service Appointment',
              service_technician: tech.service_technician || '',
              employee: tech.employee || ''
            }))
          : []
      }));
    } catch (error) {
      console.error('Error fetching service order details:', error);
      // Reset values if error occurs
      setFormData((prev) => ({
        ...prev,
        service_order: orderName,
        customer: '',
        service_type: '',
        items: [],
        service_technicians: []
      }));
    }
  };

  const handleSubmit = async () => {
    try {
      // Ensure required fields are filled
      if (
        !formData.service_order ||
        !formData.customer ||
        !formData.scheduled_start_datetime ||
        !formData.scheduled_finish_datetime ||
        !formData.due_date
      ) {
        alert('Please fill in all required fields, including a valid customer.');
        return;
      }

      // For create mode, ensure at least one item and technician exists
      if (mode === 'create' && (!formData.items.length || !formData.service_technicians.length)) {
        alert('Please add at least one item and one technician');
        return;
      }

      if (mode === 'create') {
        // Create a new appointment (POST)
        const submitData = {
          service_order: formData.service_order,
          customer: formData.customer,
          service_type: formData.service_type,
          posting_date: new Date().toISOString().split('T')[0],
          due_date: formData.due_date,
          scheduled_start_datetime: formData.scheduled_start_datetime,
          scheduled_finish_datetime: formData.scheduled_finish_datetime,
          items: formData.items,
          service_technicians: formData.service_technicians
        };

        console.log('Submitting form:', submitData);

        const response = await fetch('/api/resource/Service Appointment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(submitData)
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(JSON.stringify(errorData));
        }
        const responseData = await response.json();
        console.log('Appointment created successfully:', responseData);
        onClose();
      } else {
        // Reschedule mode: update the existing appointment (PUT)
        // We update only the fields that change, leaving the child tables intact.
        const updateData = {
          due_date: formData.due_date,
          scheduled_start_datetime: formData.scheduled_start_datetime,
          scheduled_finish_datetime: formData.scheduled_finish_datetime
        };

        console.log('Updating appointment:', updateData);

        const response = await fetch(`/api/resource/Service Appointment/${formData.name}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updateData)
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(JSON.stringify(errorData));
        }
        const responseData = await response.json();
        console.log('Appointment updated successfully:', responseData);
        onClose();
      }
    } catch (error: any) {
      console.error('Error submitting form:', error);
      alert(error.message);
    }
  };

  useEffect(() => {
    const fetchServiceOrders = async () => {
      try {
        const response = await fetch(
          '/api/resource/Service Order?filters=[["status","=","Open"]]&fields=["name","customer","status"]'
        );
        const data = await response.json();
        setServiceOrders(data.data);
      } catch (error) {
        console.error('Error fetching service orders:', error);
      }
    };
    fetchServiceOrders();
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
        <h2 className="text-2xl font-bold mb-4">
          {mode === 'create' ? 'Create Appointment' : 'Reschedule Appointment'}
        </h2>

        <div className="flex gap-2 mb-4">
          <button
            className={`px-4 py-2 ${activeTab === 'main' ? 'bg-blue-500 text-white' : 'bg-gray-200'} rounded`}
            onClick={() => setActiveTab('main')}
          >
            Main
          </button>
          {mode === 'create' && (
            <>
              <button
                className={`px-4 py-2 ${activeTab === 'items' ? 'bg-blue-500 text-white' : 'bg-gray-200'} rounded`}
                onClick={() => setActiveTab('items')}
              >
                Items
              </button>
              <button
                className={`px-4 py-2 ${activeTab === 'technicians' ? 'bg-blue-500 text-white' : 'bg-gray-200'} rounded`}
                onClick={() => setActiveTab('technicians')}
              >
                Technicians
              </button>
            </>
          )}
        </div>

        {activeTab === 'main' && (
          <div className="space-y-4">
            {mode === 'create' && (
              <>
                <div>
                  <label className="block mb-1">Service Order</label>
                  <select
                    value={formData.service_order}
                    onChange={(e) => fetchServiceOrderDetails(e.target.value)}
                    className="w-full border p-2 rounded"
                  >
                    <option value="">Select Service Order</option>
                    {serviceOrders.map((order) => (
                      <option key={order.name} value={order.name}>
                        {order.name} - {order.customer}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block mb-1">Customer</label>
                  <input
                    type="text"
                    value={formData.customer}
                    disabled
                    className="w-full border p-2 rounded bg-gray-100"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block mb-1">Due Date</label>
              <input
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                className="w-full border p-2 rounded"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block mb-1">Start Time</label>
                <input
                  type="time"
                  value={
                    formData.scheduled_start_datetime.split(' ')[1]?.slice(0, 5) || ''
                  }
                  onChange={(e) => {
                    const time = e.target.value;
                    setFormData((prev) => {
                      const date = prev.due_date;
                      return { ...prev, scheduled_start_datetime: `${date} ${time}:00` };
                    });
                  }}
                  className="w-full border p-2 rounded"
                />
              </div>
              <div>
                <label className="block mb-1">Finish Time</label>
                <input
                  type="time"
                  value={
                    formData.scheduled_finish_datetime.split(' ')[1]?.slice(0, 5) || ''
                  }
                  onChange={(e) => {
                    const time = e.target.value;
                    setFormData((prev) => {
                      const date = prev.due_date;
                      return { ...prev, scheduled_finish_datetime: `${date} ${time}:00` };
                    });
                  }}
                  className="w-full border p-2 rounded"
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'items' && mode === 'create' && (
          <ItemsTab
            items={formData.items}
            onItemsChange={(items) => setFormData({ ...formData, items })}
            technicians={[]}
            onTechniciansChange={() => {}}
          />
        )}

        {activeTab === 'technicians' && mode === 'create' && (
          <TechniciansTab
            technicians={formData.service_technicians}
            onTechniciansChange={(techs) =>
              setFormData({ ...formData, service_technicians: techs })
            }
            items={[]}
            onItemsChange={() => {}}
          />
        )}

        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 border rounded">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-blue-500 text-white rounded"
          >
            {mode === 'create' ? 'Create' : 'Reschedule'}
          </button>
        </div>
      </div>
    </div>
  );
};
