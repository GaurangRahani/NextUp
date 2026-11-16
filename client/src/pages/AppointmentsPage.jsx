import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import PageWrapper from '../components/layout/PageWrapper';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import Spinner from '../components/ui/Spinner';
import useToast from '../hooks/useToast';
import useAuth from '../hooks/useAuth';
import {
  getAppointments,
  cancelAppointment,
  rescheduleAppointment,
  updateAppointmentStatus,
} from '../api/appointmentApi';
import { getAvailability } from '../api/availabilityApi';

const statusBadgeColorMap = {
  scheduled: 'blue',
  completed: 'green',
  cancelled: 'red',
  'no-show': 'gray',
};

const AppointmentsPage = () => {
  const { user } = useAuth();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState('upcoming'); // 'upcoming' or 'past'
  const [statusFilter, setStatusFilter] = useState('all');
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Cancel Modal State
  const [apptToCancel, setApptToCancel] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  // Reschedule Modal State
  const [apptToReschedule, setApptToReschedule] = useState(null);
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);

  // Action status loading (for mark complete / no-show)
  const [updatingId, setUpdatingId] = useState(null);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const loadAppointments = useCallback(async () => {
    try {
      setLoading(true);
      const params = { timeframe: activeTab };
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }
      const res = await getAppointments(params);
      if (res.success && res.data) {
        setAppointments(res.data);
      }
    } catch (err) {
      toast.error('Failed to load appointments');
    } finally {
      setLoading(false);
    }
  }, [activeTab, statusFilter, toast]);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  // Load slot availability when rescheduling date changes
  useEffect(() => {
    const fetchSlots = async () => {
      if (!apptToReschedule || !newDate) return;
      try {
        setLoadingSlots(true);
        const businessId =
          apptToReschedule.businessId?._id || apptToReschedule.businessId;
        const serviceId =
          apptToReschedule.serviceId?._id || apptToReschedule.serviceId;
        const staffId =
          apptToReschedule.staffId?._id || apptToReschedule.staffId;

        const res = await getAvailability({
          businessId,
          serviceId,
          staffId,
          date: newDate,
          stepMinutes: 30,
        });

        if (res.success && res.data) {
          setAvailableSlots(res.data.slots || []);
        }
      } catch (err) {
        toast.error('Failed to load available slots for this date');
      } finally {
        setLoadingSlots(false);
      }
    };

    fetchSlots();
  }, [apptToReschedule, newDate, toast]);

  // Handle Cancel Submit
  const handleCancelSubmit = async () => {
    if (!apptToCancel) return;
    setCancelling(true);
    try {
      const res = await cancelAppointment(apptToCancel._id, cancelReason);
      toast.success(res.message || 'Appointment cancelled successfully');
      setApptToCancel(null);
      setCancelReason('');
      loadAppointments();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to cancel appointment';
      toast.error(msg);
    } finally {
      setCancelling(false);
    }
  };

  // Handle Reschedule Submit
  const handleRescheduleSubmit = async () => {
    if (!apptToReschedule || !newDate || !newTime) {
      toast.error('Please pick a new date and time slot');
      return;
    }

    setRescheduling(true);
    try {
      const res = await rescheduleAppointment(apptToReschedule._id, {
        date: newDate,
        startTime: newTime,
      });
      toast.success(res.message || 'Appointment rescheduled successfully');
      setApptToReschedule(null);
      setNewDate('');
      setNewTime('');
      setAvailableSlots([]);
      loadAppointments();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to reschedule appointment';
      toast.error(msg);
    } finally {
      setRescheduling(false);
    }
  };

  // Handle Status Update (Staff / Admin action)
  const handleStatusChange = async (id, newStatus) => {
    setUpdatingId(id);
    try {
      const res = await updateAppointmentStatus(id, newStatus);
      toast.success(res.message || `Appointment marked as ${newStatus}`);
      loadAppointments();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to update status';
      toast.error(msg);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <PageWrapper title={user?.role === 'customer' ? 'My Appointments' : 'Appointment Management'}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <p className="text-sm text-gray-500">
            {user?.role === 'customer'
              ? 'View your upcoming appointments, reschedule to another time, or cancel if needed.'
              : 'Manage customer appointments, track attendance, and record completions.'}
          </p>
        </div>
        <Link to="/book">
          <Button>+ Book New Appointment</Button>
        </Link>
      </div>

      {/* Tabs & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-4 mb-6">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setActiveTab('upcoming');
              setStatusFilter('all');
            }}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
              activeTab === 'upcoming'
                ? 'bg-primary-600 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Upcoming Appointments
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('past');
              setStatusFilter('all');
            }}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
              activeTab === 'past'
                ? 'bg-primary-600 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Past & History
          </button>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="statusFilter" className="text-xs font-medium text-gray-500">
            Status:
          </label>
          <select
            id="statusFilter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            <option value="all">All Statuses</option>
            <option value="scheduled">Scheduled</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="no-show">No-Show</option>
          </select>
        </div>
      </div>

      {/* Appointments List */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <Spinner size="lg" />
        </div>
      ) : appointments.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200 p-8 space-y-3">
          <p className="text-gray-500 font-medium">No appointments found</p>
          <p className="text-xs text-gray-400">
            {activeTab === 'upcoming'
              ? 'You have no scheduled upcoming appointments.'
              : 'No past appointment history found.'}
          </p>
          {activeTab === 'upcoming' && (
            <div className="pt-2">
              <Link to="/book">
                <Button size="sm">Book an Appointment Now</Button>
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {appointments.map((appt) => {
            const isScheduled = appt.status === 'scheduled';
            const formattedDate = new Date(appt.date).toLocaleDateString('en-IN', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            });

            return (
              <div
                key={appt._id}
                className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between space-y-4 hover:border-gray-300 transition-all"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-gray-900 text-base">
                        {appt.serviceId?.name || 'Service'}
                      </h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Specialist: <strong>{appt.staffId?.name || 'Staff Member'}</strong>
                      </p>
                      {user?.role !== 'customer' && (
                        <p className="text-xs text-primary-700 font-medium mt-0.5">
                          Customer: {appt.customerId?.name || 'Customer'}
                        </p>
                      )}
                    </div>
                    <Badge color={statusBadgeColorMap[appt.status] || 'gray'} className="capitalize">
                      {appt.status}
                    </Badge>
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap items-center justify-between text-xs text-gray-600 gap-2">
                    <div className="flex items-center gap-1.5 font-medium">
                      <span>📅</span>
                      <span>{formattedDate}</span>
                    </div>
                    <div className="flex items-center gap-1.5 font-bold text-gray-800">
                      <span>⏱</span>
                      <span>
                        {appt.startTime} – {appt.endTime}
                      </span>
                    </div>
                    <div className="font-extrabold text-primary-600">
                      ₹{appt.serviceId?.price || 0}
                    </div>
                  </div>

                  {appt.cancellationReason && (
                    <div className="mt-3 p-2 bg-red-50 border border-red-100 rounded text-xs text-red-700">
                      <strong>Cancellation Reason:</strong> {appt.cancellationReason}
                    </div>
                  )}
                </div>

                {/* Actions Bar */}
                {isScheduled && (
                  <div className="pt-3 border-t border-gray-100 flex flex-wrap items-center justify-end gap-2">
                    {/* Admin / Staff status shortcuts */}
                    {user?.role !== 'customer' && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-green-600 hover:text-green-700 hover:bg-green-50 text-xs"
                          loading={updatingId === appt._id}
                          onClick={() => handleStatusChange(appt._id, 'completed')}
                        >
                          ✓ Mark Complete
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-gray-600 hover:text-gray-700 hover:bg-gray-100 text-xs"
                          loading={updatingId === appt._id}
                          onClick={() => handleStatusChange(appt._id, 'no-show')}
                        >
                          No-Show
                        </Button>
                      </>
                    )}

                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setApptToReschedule(appt);
                        setNewDate(appt.date ? appt.date.split('T')[0] : '');
                        setNewTime('');
                      }}
                    >
                      Reschedule
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => setApptToCancel(appt)}
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      <Modal
        isOpen={!!apptToCancel}
        onClose={() => setApptToCancel(null)}
        title="Cancel Appointment"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Are you sure you want to cancel your appointment for{' '}
            <strong>{apptToCancel?.serviceId?.name}</strong> on{' '}
            <strong>
              {apptToCancel?.date && new Date(apptToCancel.date).toLocaleDateString()} at{' '}
              {apptToCancel?.startTime}
            </strong>
            ?
          </p>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Reason for Cancellation (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Schedule conflict, feeling unwell..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3">
            <Button
              variant="secondary"
              onClick={() => setApptToCancel(null)}
            >
              Keep Appointment
            </Button>
            <Button
              variant="danger"
              loading={cancelling}
              onClick={handleCancelSubmit}
            >
              Confirm Cancellation
            </Button>
          </div>
        </div>
      </Modal>

      {/* Reschedule Modal */}
      <Modal
        isOpen={!!apptToReschedule}
        onClose={() => setApptToReschedule(null)}
        title="Reschedule Appointment"
      >
        <div className="space-y-4">
          <p className="text-xs text-gray-500">
            Rescheduling for <strong>{apptToReschedule?.serviceId?.name}</strong> with{' '}
            <strong>{apptToReschedule?.staffId?.name}</strong>.
          </p>

          <div>
            <label htmlFor="rescheduleDate" className="block text-sm font-medium text-gray-700 mb-1">
              Select New Date *
            </label>
            <input
              id="rescheduleDate"
              type="date"
              min={todayStr}
              value={newDate}
              onChange={(e) => {
                setNewDate(e.target.value);
                setNewTime('');
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {newDate && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold text-gray-700">
                  Select New Time Slot *
                </label>
                {loadingSlots && (
                  <span className="text-xs text-primary-600 flex items-center gap-1">
                    <Spinner size="sm" /> Checking available slots...
                  </span>
                )}
              </div>

              {availableSlots.length === 0 ? (
                <p className="text-xs text-gray-400 italic">
                  No slots available for this date. Please select another date.
                </p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto p-1">
                  {availableSlots.map((slot) => {
                    const isSelected = newTime === slot.startTime;
                    return (
                      <button
                        key={slot.startTime}
                        type="button"
                        disabled={!slot.isAvailable}
                        onClick={() => slot.isAvailable && setNewTime(slot.startTime)}
                        className={`py-2 px-2 text-xs font-semibold rounded-lg border transition-all text-center ${
                          isSelected
                            ? 'bg-primary-600 text-white border-primary-600 shadow'
                            : slot.isAvailable
                            ? 'bg-white text-gray-800 border-gray-200 hover:border-primary-400 cursor-pointer'
                            : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed line-through opacity-60'
                        }`}
                      >
                        {slot.startTime}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {newTime && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-xs text-green-800">
              New appointment time: <strong>{newDate} at {newTime}</strong>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <Button
              variant="secondary"
              onClick={() => setApptToReschedule(null)}
            >
              Cancel
            </Button>
            <Button
              disabled={!newDate || !newTime}
              loading={rescheduling}
              onClick={handleRescheduleSubmit}
            >
              Confirm Reschedule
            </Button>
          </div>
        </div>
      </Modal>
    </PageWrapper>
  );
};

export default AppointmentsPage;
