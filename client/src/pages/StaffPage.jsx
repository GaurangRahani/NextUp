import { useState, useEffect, useCallback } from 'react';
import PageWrapper from '../components/layout/PageWrapper';
import Table from '../components/ui/Table';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import useToast from '../hooks/useToast';
import useAuth from '../hooks/useAuth';
import {
  getStaff,
  createStaff,
  updateStaff,
  deactivateStaff,
} from '../api/staffApi';
import { getServices } from '../api/serviceApi';
import { getCurrentBusiness } from '../api/businessApi';

const StaffPage = () => {
  const { user } = useAuth();
  const toast = useToast();

  const [staffList, setStaffList] = useState([]);
  const [availableServices, setAvailableServices] = useState([]);
  const [businessId, setBusinessId] = useState(user?.businessId || null);
  const [loading, setLoading] = useState(true);

  // Modal State for Add
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addFormData, setAddFormData] = useState({
    name: '',
    email: '',
    password: '',
    serviceIds: [],
  });
  const [addErrors, setAddErrors] = useState({});
  const [submittingAdd, setSubmittingAdd] = useState(false);

  // Modal State for Edit & Assign
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    serviceIds: [],
    isActive: true,
  });
  const [submittingEdit, setSubmittingEdit] = useState(false);

  // Confirmation Modal for Deactivate
  const [staffToDeactivate, setStaffToDeactivate] = useState(null);
  const [deactivating, setDeactivating] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      let bId = businessId;

      if (!bId) {
        const bizRes = await getCurrentBusiness();
        if (bizRes.success && bizRes.data) {
          bId = bizRes.data._id;
          setBusinessId(bId);
        }
      }

      if (bId) {
        const [staffRes, servicesRes] = await Promise.all([
          getStaff(bId, null, true),
          getServices(bId, false),
        ]);

        if (staffRes.success && staffRes.data) {
          setStaffList(staffRes.data);
        }
        if (servicesRes.success && servicesRes.data) {
          setAvailableServices(servicesRes.data);
        }
      }
    } catch (err) {
      if (err.response?.status !== 404) {
        toast.error('Failed to load staff list');
      }
    } finally {
      setLoading(false);
    }
  }, [businessId, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Open Add Modal
  const openAddModal = () => {
    setAddFormData({
      name: '',
      email: '',
      password: '',
      serviceIds: [],
    });
    setAddErrors({});
    setIsAddModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (staff) => {
    setEditingStaff(staff);
    const existingServiceIds = (staff.serviceIds || []).map((s) =>
      typeof s === 'object' ? s._id : s
    );
    setEditFormData({
      name: staff.userId?.name || '',
      serviceIds: existingServiceIds,
      isActive: staff.isActive,
    });
    setIsEditModalOpen(true);
  };

  // Handle Add Form Service Checkbox
  const toggleAddService = (serviceId) => {
    setAddFormData((prev) => {
      const exists = prev.serviceIds.includes(serviceId);
      return {
        ...prev,
        serviceIds: exists
          ? prev.serviceIds.filter((id) => id !== serviceId)
          : [...prev.serviceIds, serviceId],
      };
    });
  };

  // Handle Edit Form Service Checkbox
  const toggleEditService = (serviceId) => {
    setEditFormData((prev) => {
      const exists = prev.serviceIds.includes(serviceId);
      return {
        ...prev,
        serviceIds: exists
          ? prev.serviceIds.filter((id) => id !== serviceId)
          : [...prev.serviceIds, serviceId],
      };
    });
  };

  // Validate Add
  const validateAdd = () => {
    const errs = {};
    if (!addFormData.name.trim()) {
      errs.name = 'Staff name is required';
    } else if (addFormData.name.trim().length < 2) {
      errs.name = 'Name must be at least 2 characters';
    }

    if (!addFormData.email.trim()) {
      errs.email = 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addFormData.email.trim())) {
      errs.email = 'Please provide a valid email address';
    }

    if (!addFormData.password) {
      errs.password = 'Password is required';
    } else if (addFormData.password.length < 6) {
      errs.password = 'Password must be at least 6 characters';
    }

    setAddErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Submit Add
  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!validateAdd()) return;

    if (!businessId) {
      toast.error('Please configure your Business Profile first.');
      return;
    }

    setSubmittingAdd(true);
    try {
      const res = await createStaff({
        name: addFormData.name.trim(),
        email: addFormData.email.trim().toLowerCase(),
        password: addFormData.password,
        serviceIds: addFormData.serviceIds,
        businessId,
      });

      toast.success(res.message || 'Staff member added successfully');
      setIsAddModalOpen(false);
      loadData();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to create staff member';
      toast.error(msg);
    } finally {
      setSubmittingAdd(false);
    }
  };

  // Submit Edit
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingStaff) return;

    setSubmittingEdit(true);
    try {
      const res = await updateStaff(editingStaff._id, {
        name: editFormData.name.trim(),
        serviceIds: editFormData.serviceIds,
        isActive: editFormData.isActive,
      });

      toast.success(res.message || 'Staff profile updated successfully');
      setIsEditModalOpen(false);
      loadData();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to update staff profile';
      toast.error(msg);
    } finally {
      setSubmittingEdit(false);
    }
  };

  // Handle Deactivate Confirm
  const handleDeactivate = async () => {
    if (!staffToDeactivate) return;

    setDeactivating(true);
    try {
      const res = await deactivateStaff(staffToDeactivate._id);
      toast.success(res.message || 'Staff member deactivated');
      setStaffToDeactivate(null);
      loadData();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to deactivate staff';
      toast.error(msg);
    } finally {
      setDeactivating(false);
    }
  };

  const columns = [
    {
      key: 'name',
      header: 'Staff Member',
      render: (_, row) => (
        <div>
          <div className="font-medium text-gray-900">
            {row.userId?.name || 'Unknown'}
          </div>
          <div className="text-xs text-gray-500">{row.userId?.email || '—'}</div>
        </div>
      ),
    },
    {
      key: 'serviceIds',
      header: 'Assigned Services',
      render: (services) => {
        if (!services || services.length === 0) {
          return <span className="text-xs text-gray-400 italic">No services assigned</span>;
        }
        return (
          <div className="flex flex-wrap gap-1 max-w-md">
            {services.map((svc) => (
              <span
                key={svc._id || svc}
                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200"
              >
                {svc.name || 'Service'}
              </span>
            ))}
          </div>
        );
      },
    },
    {
      key: 'isActive',
      header: 'Status',
      render: (val) => (
        <Badge color={val ? 'green' : 'gray'}>
          {val ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (_, row) => (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => openEditModal(row)}
          >
            Edit & Assign
          </Button>
          {row.isActive && (
            <Button
              variant="ghost"
              size="sm"
              className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
              onClick={() => setStaffToDeactivate(row)}
            >
              Deactivate
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <PageWrapper title="Staff Management">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <p className="text-sm text-gray-500">
            Manage your team members and assign services they are qualified to perform.
          </p>
        </div>
        <Button onClick={openAddModal}>
          + Add Staff Member
        </Button>
      </div>

      <Table
        columns={columns}
        data={staffList}
        loading={loading}
        emptyMessage="No staff members found. Click '+ Add Staff Member' to get started."
      />

      {/* Add Staff Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Staff Member"
      >
        <form onSubmit={handleAddSubmit} className="space-y-4">
          <Input
            label="Full Name *"
            name="name"
            placeholder="e.g. Rahul Sharma"
            value={addFormData.name}
            onChange={(e) => setAddFormData({ ...addFormData, name: e.target.value })}
            error={addErrors.name}
          />

          <Input
            label="Email Address *"
            name="email"
            type="email"
            placeholder="rahul@example.com"
            value={addFormData.email}
            onChange={(e) => setAddFormData({ ...addFormData, email: e.target.value })}
            error={addErrors.email}
          />

          <Input
            label="Initial Password *"
            name="password"
            type="password"
            placeholder="At least 6 characters"
            value={addFormData.password}
            onChange={(e) => setAddFormData({ ...addFormData, password: e.target.value })}
            error={addErrors.password}
          />

          <div className="pt-2">
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Assign Services
            </label>
            {availableServices.length === 0 ? (
              <p className="text-xs text-gray-400 italic">
                No active services available. Please create services first in the Services tab.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 border border-gray-200 rounded-lg bg-gray-50">
                {availableServices.map((svc) => (
                  <label
                    key={svc._id}
                    className="flex items-center gap-2 text-sm p-1.5 rounded hover:bg-white cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={addFormData.serviceIds.includes(svc._id)}
                      onChange={() => toggleAddService(svc._id)}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-gray-800 font-medium text-xs">
                      {svc.name} ({svc.duration}m)
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsAddModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={submittingAdd}>
              Create Staff Member
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit & Assign Services Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Staff Member & Service Assignment"
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <Input
            label="Full Name"
            name="name"
            value={editFormData.name}
            onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
          />

          <div className="pt-2">
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Assigned Services (Multi-select)
            </label>
            {availableServices.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No services available</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 border border-gray-200 rounded-lg bg-gray-50">
                {availableServices.map((svc) => (
                  <label
                    key={svc._id}
                    className="flex items-center gap-2 text-sm p-1.5 rounded hover:bg-white cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={editFormData.serviceIds.includes(svc._id)}
                      onChange={() => toggleEditService(svc._id)}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-gray-800 font-medium text-xs">
                      {svc.name} ({svc.duration}m)
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="staffIsActive"
              checked={editFormData.isActive}
              onChange={(e) => setEditFormData({ ...editFormData, isActive: e.target.checked })}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <label htmlFor="staffIsActive" className="text-sm text-gray-700">
              Active staff member (available for bookings and walk-ins)
            </label>
          </div>

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsEditModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={submittingEdit}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* Deactivate Confirmation Modal */}
      <Modal
        isOpen={!!staffToDeactivate}
        onClose={() => setStaffToDeactivate(null)}
        title="Deactivate Staff Member"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Are you sure you want to deactivate{' '}
            <strong>{staffToDeactivate?.userId?.name}</strong>?
          </p>
          <p className="text-xs text-gray-500">
            Deactivating will prevent new bookings and queue assignments for this staff member.
            Historical records will remain preserved.
          </p>
          <div className="flex justify-end gap-3 pt-3">
            <Button
              variant="secondary"
              onClick={() => setStaffToDeactivate(null)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={deactivating}
              onClick={handleDeactivate}
            >
              Confirm Deactivation
            </Button>
          </div>
        </div>
      </Modal>
    </PageWrapper>
  );
};

export default StaffPage;
