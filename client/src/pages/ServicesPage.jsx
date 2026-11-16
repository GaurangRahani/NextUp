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
  getServices,
  createService,
  updateService,
  deleteService,
} from '../api/serviceApi';
import { getCurrentBusiness } from '../api/businessApi';

const ServicesPage = () => {
  const { user } = useAuth();
  const toast = useToast();

  const [services, setServices] = useState([]);
  const [businessId, setBusinessId] = useState(user?.businessId || null);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    duration: '',
    price: '',
    isActive: true,
  });
  const [errors, setErrors] = useState({});

  // Confirmation Modal State for Delete / Deactivate
  const [serviceToDelete, setServiceToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

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
        const res = await getServices(bId, true);
        if (res.success && res.data) {
          setServices(res.data);
        }
      }
    } catch (err) {
      if (err.response?.status !== 404) {
        toast.error('Failed to load services');
      }
    } finally {
      setLoading(false);
    }
  }, [businessId, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openCreateModal = () => {
    setEditingService(null);
    setFormData({
      name: '',
      description: '',
      duration: '',
      price: '',
      isActive: true,
    });
    setErrors({});
    setIsModalOpen(true);
  };

  const openEditModal = (service) => {
    setEditingService(service);
    setFormData({
      name: service.name,
      description: service.description || '',
      duration: service.duration,
      price: service.price,
      isActive: service.isActive,
    });
    setErrors({});
    setIsModalOpen(true);
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.name.trim()) {
      newErrors.name = 'Service name is required';
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    }

    const durationNum = Number(formData.duration);
    if (!formData.duration || isNaN(durationNum) || durationNum <= 0) {
      newErrors.duration = 'Duration must be a positive number of minutes';
    }

    const priceNum = Number(formData.price);
    if (formData.price === '' || isNaN(priceNum) || priceNum < 0) {
      newErrors.price = 'Price must be 0 or greater';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleModalSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    if (!businessId) {
      toast.error('Please configure your Business Profile first before adding services.');
      return;
    }

    setSubmitting(true);
    try {
      if (editingService) {
        const res = await updateService(editingService._id, {
          name: formData.name.trim(),
          description: formData.description,
          duration: Number(formData.duration),
          price: Number(formData.price),
          isActive: formData.isActive,
        });
        toast.success(res.message || 'Service updated successfully');
      } else {
        const res = await createService({
          name: formData.name.trim(),
          description: formData.description,
          duration: Number(formData.duration),
          price: Number(formData.price),
          businessId,
        });
        toast.success(res.message || 'Service created successfully');
      }

      setIsModalOpen(false);
      loadData();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to save service';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!serviceToDelete) return;

    setDeleting(true);
    try {
      const res = await deleteService(serviceToDelete._id);
      if (res.data?.isDeactivated) {
        toast.info(res.message || 'Service has appointments and was deactivated (Rule R3)');
      } else {
        toast.success(res.message || 'Service deleted successfully');
      }
      setServiceToDelete(null);
      loadData();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to remove service';
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    {
      key: 'name',
      header: 'Service Name',
      render: (val, row) => (
        <div>
          <div className="font-medium text-gray-900">{val}</div>
          {row.description && (
            <div className="text-xs text-gray-500 line-clamp-1">{row.description}</div>
          )}
        </div>
      ),
    },
    {
      key: 'duration',
      header: 'Duration',
      render: (val) => `${val} mins`,
    },
    {
      key: 'price',
      header: 'Price',
      render: (val) => `₹${val}`,
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
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={() => setServiceToDelete(row)}
          >
            {row.isActive ? 'Deactivate' : 'Delete'}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <PageWrapper title="Service Management">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <p className="text-sm text-gray-500">
            Manage services offered by your business. Services with upcoming appointments are safely deactivated instead of deleted (Rule R3).
          </p>
        </div>
        <Button onClick={openCreateModal}>
          + Add New Service
        </Button>
      </div>

      <Table
        columns={columns}
        data={services}
        loading={loading}
        emptyMessage="No services found. Click '+ Add New Service' to add your first service."
      />

      {/* Add / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingService ? 'Edit Service' : 'Add New Service'}
      >
        <form onSubmit={handleModalSubmit} className="space-y-4">
          <Input
            label="Service Name *"
            name="name"
            placeholder="e.g. Haircut, Consultation"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            error={errors.name}
          />

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              Description (Optional)
            </label>
            <textarea
              name="description"
              rows={2}
              placeholder="Brief details about this service..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Duration (minutes) *"
              name="duration"
              type="number"
              placeholder="30"
              value={formData.duration}
              onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
              error={errors.duration}
            />

            <Input
              label="Price (₹) *"
              name="price"
              type="number"
              placeholder="500"
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: e.target.value })}
              error={errors.price}
            />
          </div>

          {editingService && (
            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <label htmlFor="isActive" className="text-sm text-gray-700">
                Active for new bookings
              </label>
            </div>
          )}

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              {editingService ? 'Save Changes' : 'Create Service'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete / Deactivate Confirmation Modal */}
      <Modal
        isOpen={!!serviceToDelete}
        onClose={() => setServiceToDelete(null)}
        title="Remove Service"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Are you sure you want to remove <strong>{serviceToDelete?.name}</strong>?
          </p>
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
            <strong>Rule R3 Notice:</strong> If this service has future appointments scheduled, it will be automatically <strong>deactivated</strong> instead of deleted to protect historical appointment data.
          </div>
          <div className="flex justify-end gap-3 pt-3">
            <Button
              variant="secondary"
              onClick={() => setServiceToDelete(null)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={deleting}
              onClick={handleDelete}
            >
              Confirm
            </Button>
          </div>
        </div>
      </Modal>
    </PageWrapper>
  );
};

export default ServicesPage;
