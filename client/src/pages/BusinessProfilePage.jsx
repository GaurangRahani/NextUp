import { useState, useEffect } from 'react';
import PageWrapper from '../components/layout/PageWrapper';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import Spinner from '../components/ui/Spinner';
import useToast from '../hooks/useToast';
import { getCurrentBusiness, createBusiness, updateBusiness } from '../api/businessApi';

const DEFAULT_DAYS = [
  { day: 'Monday', open: '09:00', close: '18:00', isClosed: false },
  { day: 'Tuesday', open: '09:00', close: '18:00', isClosed: false },
  { day: 'Wednesday', open: '09:00', close: '18:00', isClosed: false },
  { day: 'Thursday', open: '09:00', close: '18:00', isClosed: false },
  { day: 'Friday', open: '09:00', close: '19:00', isClosed: false },
  { day: 'Saturday', open: '10:00', close: '17:00', isClosed: false },
  { day: 'Sunday', open: '00:00', close: '00:00', isClosed: true },
];

const BusinessProfilePage = () => {
  const [businessId, setBusinessId] = useState(null);
  const [name, setName] = useState('');
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState({
    street: '',
    city: '',
    state: '',
    zip: '',
  });
  const [operatingHours, setOperatingHours] = useState(DEFAULT_DAYS);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const toast = useToast();

  useEffect(() => {
    const fetchBusiness = async () => {
      try {
        const res = await getCurrentBusiness();
        if (res.success && res.data) {
          const b = res.data;
          setBusinessId(b._id);
          setName(b.name || '');
          setTimezone(b.timezone || 'Asia/Kolkata');
          setPhone(b.phone || '');
          setAddress(b.address || { street: '', city: '', state: '', zip: '' });
          if (b.operatingHours && b.operatingHours.length > 0) {
            setOperatingHours(b.operatingHours);
          }
        }
      } catch (err) {
        if (err.response?.status !== 404) {
          toast.error('Failed to load business profile');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchBusiness();
  }, []);

  const handleHourChange = (index, field, value) => {
    setOperatingHours((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const validate = () => {
    const newErrors = {};
    if (!name.trim()) {
      newErrors.name = 'Business name is required';
    }

    for (const h of operatingHours) {
      if (!h.isClosed) {
        if (!h.open || !h.close) {
          newErrors.hours = `Please enter open and close times for ${h.day}`;
          break;
        }
        if (h.open >= h.close) {
          newErrors.hours = `${h.day}: open time (${h.open}) must be before close time (${h.close})`;
          break;
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) {
      if (errors.hours) toast.error(errors.hours);
      return;
    }

    setSaving(true);
    const payload = {
      name: name.trim(),
      timezone,
      phone,
      address,
      operatingHours,
    };

    try {
      if (businessId) {
        const res = await updateBusiness(businessId, payload);
        toast.success(res.message || 'Business profile updated successfully');
      } else {
        const res = await createBusiness(payload);
        setBusinessId(res.data._id);
        toast.success(res.message || 'Business profile created successfully');
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to save business profile';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <PageWrapper title="Business Profile">
        <div className="flex justify-center py-20">
          <Spinner size="lg" />
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper title="Business Profile & Operating Hours">
      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Basic Information */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Business Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Business Name *"
              name="name"
              placeholder="e.g. Luxe Salon & Spa"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) setErrors((prev) => ({ ...prev, name: '' }));
              }}
              error={errors.name}
            />

            <Input
              label="Phone Number"
              name="phone"
              placeholder="+91 98765 43210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />

            <div className="flex flex-col gap-1">
              <label htmlFor="timezone" className="text-sm font-medium text-gray-700">
                Timezone
              </label>
              <select
                id="timezone"
                name="timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="Asia/Kolkata">Asia/Kolkata (IST, UTC+5:30)</option>
                <option value="UTC">UTC (Universal Time)</option>
                <option value="America/New_York">America/New_York (EST)</option>
                <option value="Europe/London">Europe/London (GMT)</option>
                <option value="Asia/Dubai">Asia/Dubai (GST)</option>
              </select>
            </div>
          </div>

          {/* Address fields */}
          <div className="mt-4 pt-4 border-t border-gray-100">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Address</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Street"
                name="street"
                placeholder="123 Main Street"
                value={address.street}
                onChange={(e) =>
                  setAddress((prev) => ({ ...prev, street: e.target.value }))
                }
              />
              <Input
                label="City"
                name="city"
                placeholder="City"
                value={address.city}
                onChange={(e) =>
                  setAddress((prev) => ({ ...prev, city: e.target.value }))
                }
              />
              <Input
                label="State"
                name="state"
                placeholder="State / Province"
                value={address.state}
                onChange={(e) =>
                  setAddress((prev) => ({ ...prev, state: e.target.value }))
                }
              />
              <Input
                label="Postal / Zip Code"
                name="zip"
                placeholder="Zip Code"
                value={address.zip}
                onChange={(e) =>
                  setAddress((prev) => ({ ...prev, zip: e.target.value }))
                }
              />
            </div>
          </div>
        </div>

        {/* Operating Hours */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Weekly Operating Hours</h2>
              <p className="text-sm text-gray-500">
                Set opening and closing times. Appointments cannot be booked outside these hours.
              </p>
            </div>
          </div>

          {errors.hours && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {errors.hours}
            </div>
          )}

          <div className="space-y-3 divide-y divide-gray-100">
            {operatingHours.map((item, idx) => (
              <div
                key={item.day}
                className={`pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  item.isClosed ? 'opacity-60' : ''
                }`}
              >
                <div className="w-32 font-medium text-sm text-gray-800">
                  {item.day}
                </div>

                <div className="flex items-center gap-3">
                  <label className="inline-flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={item.isClosed}
                      onChange={(e) =>
                        handleHourChange(idx, 'isClosed', e.target.checked)
                      }
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span>Closed</span>
                  </label>

                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      aria-label={`${item.day} Open Time`}
                      disabled={item.isClosed}
                      value={item.open}
                      onChange={(e) => handleHourChange(idx, 'open', e.target.value)}
                      className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100 disabled:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <span className="text-gray-400 text-xs font-semibold">TO</span>
                    <input
                      type="time"
                      aria-label={`${item.day} Close Time`}
                      disabled={item.isClosed}
                      value={item.close}
                      onChange={(e) => handleHourChange(idx, 'close', e.target.value)}
                      className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100 disabled:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Save button */}
        <div className="flex justify-end">
          <Button type="submit" size="lg" loading={saving}>
            {businessId ? 'Save Changes' : 'Create Business Profile'}
          </Button>
        </div>
      </form>
    </PageWrapper>
  );
};

export default BusinessProfilePage;
