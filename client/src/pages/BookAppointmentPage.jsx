import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import PageWrapper from '../components/layout/PageWrapper';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Spinner from '../components/ui/Spinner';
import useToast from '../hooks/useToast';
import useAuth from '../hooks/useAuth';
import { getCurrentBusiness } from '../api/businessApi';
import { getServices } from '../api/serviceApi';
import { getStaff } from '../api/staffApi';
import { bookAppointment } from '../api/appointmentApi';
import { getAvailability } from '../api/availabilityApi';

const timeToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
};

const minutesToTime = (totalMinutes) => {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const BookAppointmentPage = () => {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  // Wizard state: 1: Service, 2: Staff, 3: Date & Time, 4: Review, 5: Success
  const [step, setStep] = useState(1);

  // Data state
  const [business, setBusiness] = useState(null);
  const [services, setServices] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Selection state
  const [selectedService, setSelectedService] = useState(null);
  const [selectedStaff, setSelectedStaff] = useState('any'); // 'any' or staff object
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [notes, setNotes] = useState('');

  // Real-time slot availability state (Module 6: Rule R1)
  const [apiSlots, setApiSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [bookedAppointment, setBookedAppointment] = useState(null);

  // Min date string (today in local YYYY-MM-DD)
  const todayStr = useMemo(() => {
    const now = new Date();
    return now.toISOString().split('T')[0];
  }, []);

  // Fetch initial business & services
  const loadInitialData = useCallback(async () => {
    try {
      setLoading(true);
      const bizRes = await getCurrentBusiness();
      if (bizRes.success && bizRes.data) {
        setBusiness(bizRes.data);

        // Fetch active services for this business
        const svcRes = await getServices(bizRes.data._id, false);
        if (svcRes.success && svcRes.data) {
          setServices(svcRes.data);
        }
      }
    } catch (err) {
      toast.error('Failed to load business details. Please ensure business profile is setup.');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // When service is selected, load qualified staff for that service
  const handleServiceSelect = async (service) => {
    setSelectedService(service);
    setSelectedStaff('any');
    try {
      if (business) {
        const staffRes = await getStaff(business._id, service._id, false);
        if (staffRes.success && staffRes.data) {
          setStaffList(staffRes.data);
        }
      }
    } catch (err) {
      // Continue even if staff fetch fails
    }
    setStep(2);
  };

  // Operating hours for selected date
  const dayOperatingHours = useMemo(() => {
    if (!selectedDate || !business?.operatingHours) return null;
    const dateObj = new Date(selectedDate);
    const dayName = new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      timeZone: business.timezone || 'Asia/Kolkata',
    }).format(dateObj);

    const hours = business.operatingHours.find((h) => h.day === dayName);
    return { dayName, ...hours };
  }, [selectedDate, business]);

  // Generate available time slots based on operating hours and service duration
  const availableSlots = useMemo(() => {
    if (!dayOperatingHours || dayOperatingHours.isClosed || !selectedService) {
      return [];
    }

    const openMin = timeToMinutes(dayOperatingHours.open);
    const closeMin = timeToMinutes(dayOperatingHours.close);
    const duration = selectedService.duration;

    const slots = [];
    const stepMin = 30; // 30-minute interval grid

    // Current time in minutes if selected date is today
    const now = new Date();
    const isToday = selectedDate === todayStr;
    const currentMin = now.getHours() * 60 + now.getMinutes();

    for (let m = openMin; m + duration <= closeMin; m += stepMin) {
      // If today, filter out past slots (with 15 min buffer)
      if (isToday && m <= currentMin + 15) {
        continue;
      }
      slots.push({
        start: minutesToTime(m),
        end: minutesToTime(m + duration),
      });
    }

    return slots;
  }, [dayOperatingHours, selectedService, selectedDate, todayStr]);

  // Calculated end time for the selected start time
  const calculatedEndTime = useMemo(() => {
    if (!selectedTime || !selectedService) return '';
    const startMin = timeToMinutes(selectedTime);
    return minutesToTime(startMin + selectedService.duration);
  }, [selectedTime, selectedService]);

  // Fetch real-time availability from API (Rule R1)
  const fetchAvailability = useCallback(async () => {
    if (!selectedDate || !business?._id || !selectedService?._id) return;
    try {
      setLoadingSlots(true);
      const staffParam =
        selectedStaff === 'any'
          ? 'any'
          : selectedStaff?.userId?._id || selectedStaff?._id;

      const res = await getAvailability({
        businessId: business._id,
        serviceId: selectedService._id,
        date: selectedDate,
        staffId: staffParam,
        stepMinutes: 30,
      });

      if (res.success && res.data) {
        setApiSlots(res.data.slots || []);
      }
    } catch (err) {
      // Fallback
    } finally {
      setLoadingSlots(false);
    }
  }, [selectedDate, business, selectedService, selectedStaff]);

  useEffect(() => {
    if (step === 3 && selectedDate) {
      fetchAvailability();
    }
  }, [step, selectedDate, fetchAvailability]);

  // Handle final booking submission
  const handleBook = async () => {
    if (!business || !selectedService || !selectedDate || !selectedTime) {
      toast.error('Please complete all required fields');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        businessId: business._id,
        serviceId: selectedService._id,
        staffId: selectedStaff === 'any' ? 'any' : selectedStaff.userId?._id || selectedStaff._id,
        date: selectedDate,
        startTime: selectedTime,
        notes: notes.trim(),
      };

      const res = await bookAppointment(payload);
      setBookedAppointment(res.data);
      setStep(5); // Success state
      toast.success(res.message || 'Appointment booked successfully!');
    } catch (err) {
      if (err.response?.status === 409) {
        toast.error('Slot was just taken! Please select another time slot.');
        setStep(3);
        setSelectedTime('');
        fetchAvailability();
      } else {
        const msg = err.response?.data?.message || 'Failed to book appointment';
        toast.error(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <PageWrapper title="Book an Appointment">
        <div className="flex justify-center items-center py-20">
          <Spinner size="lg" />
        </div>
      </PageWrapper>
    );
  }

  // Step 5: Success Screen
  if (step === 5 && bookedAppointment) {
    return (
      <PageWrapper title="Booking Confirmation">
        <div className="max-w-xl mx-auto bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center space-y-6">
          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto text-3xl">
            ✓
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Appointment Confirmed!</h2>
            <p className="text-sm text-gray-500 mt-1">
              Your appointment has been successfully scheduled.
            </p>
          </div>

          <div className="bg-gray-50 rounded-lg p-5 text-left space-y-3 border border-gray-100 text-sm">
            <div className="flex justify-between border-b border-gray-200 pb-2">
              <span className="text-gray-500">Service:</span>
              <span className="font-semibold text-gray-900">
                {bookedAppointment.serviceId?.name}
              </span>
            </div>
            <div className="flex justify-between border-b border-gray-200 pb-2">
              <span className="text-gray-500">Staff Member:</span>
              <span className="font-semibold text-gray-900">
                {bookedAppointment.staffId?.name || 'Assigned Staff'}
              </span>
            </div>
            <div className="flex justify-between border-b border-gray-200 pb-2">
              <span className="text-gray-500">Date:</span>
              <span className="font-semibold text-gray-900">
                {new Date(bookedAppointment.date).toLocaleDateString('en-IN', {
                  weekday: 'short',
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </div>
            <div className="flex justify-between border-b border-gray-200 pb-2">
              <span className="text-gray-500">Time:</span>
              <span className="font-semibold text-gray-900">
                {bookedAppointment.startTime} – {bookedAppointment.endTime}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Price:</span>
              <span className="font-bold text-primary-600">
                ₹{bookedAppointment.serviceId?.price}
              </span>
            </div>
          </div>

          <div className="flex justify-center gap-4 pt-2">
            <Button
              variant="secondary"
              onClick={() => {
                setStep(1);
                setSelectedService(null);
                setSelectedStaff('any');
                setSelectedDate('');
                setSelectedTime('');
                setNotes('');
                setBookedAppointment(null);
              }}
            >
              Book Another
            </Button>
            <Button onClick={() => navigate('/dashboard')}>
              Go to Dashboard
            </Button>
          </div>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper title="Book an Appointment">
      {/* Wizard Step Indicator */}
      <div className="max-w-3xl mx-auto mb-8">
        <div className="flex items-center justify-between relative">
          <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-gray-200 -z-0 -translate-y-1/2" />
          {[
            { num: 1, label: 'Service' },
            { num: 2, label: 'Staff' },
            { num: 3, label: 'Date & Time' },
            { num: 4, label: 'Review' },
          ].map((s) => {
            const isCompleted = step > s.num;
            const isCurrent = step === s.num;
            return (
              <div key={s.num} className="relative z-10 flex flex-col items-center bg-gray-50 px-3">
                <button
                  type="button"
                  onClick={() => s.num < step && setStep(s.num)}
                  disabled={s.num > step}
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                    isCurrent
                      ? 'bg-primary-600 text-white ring-4 ring-primary-100 shadow'
                      : isCompleted
                      ? 'bg-green-600 text-white cursor-pointer'
                      : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {isCompleted ? '✓' : s.num}
                </button>
                <span
                  className={`text-xs mt-1 font-medium ${
                    isCurrent ? 'text-primary-700' : 'text-gray-500'
                  }`}
                >
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="max-w-3xl mx-auto">
        {/* Step 1: Select Service */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">1. Select a Service</h2>
              <span className="text-xs text-gray-500">
                {business?.name || 'NextUp Business'}
              </span>
            </div>

            {services.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border border-gray-200 p-6">
                <p className="text-sm text-gray-500">
                  No active services currently available for booking.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {services.map((svc) => (
                  <div
                    key={svc._id}
                    onClick={() => handleServiceSelect(svc)}
                    className="bg-white p-5 rounded-xl border border-gray-200 hover:border-primary-500 hover:shadow-md cursor-pointer transition-all flex flex-col justify-between group"
                  >
                    <div>
                      <div className="flex justify-between items-start gap-2">
                        <h3 className="font-semibold text-gray-900 group-hover:text-primary-600 transition-colors">
                          {svc.name}
                        </h3>
                        <span className="text-sm font-bold text-primary-600">
                          ₹{svc.price}
                        </span>
                      </div>
                      {svc.description && (
                        <p className="text-xs text-gray-500 mt-2 line-clamp-2">
                          {svc.description}
                        </p>
                      )}
                    </div>
                    <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                      <span>⏱ {svc.duration} mins</span>
                      <span className="text-primary-600 font-medium group-hover:underline">
                        Select →
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Select Staff */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">2. Select Staff Member</h2>
              <Button variant="ghost" size="sm" onClick={() => setStep(1)}>
                ← Change Service
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Option A: Any Available Staff */}
              <div
                onClick={() => {
                  setSelectedStaff('any');
                  setStep(3);
                }}
                className={`bg-white p-5 rounded-xl border cursor-pointer transition-all ${
                  selectedStaff === 'any'
                    ? 'border-primary-500 ring-2 ring-primary-100 bg-primary-50/20'
                    : 'border-gray-200 hover:border-primary-400'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center font-bold text-lg">
                    ✨
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Any Available Staff</h3>
                    <p className="text-xs text-gray-500">
                      Auto-assigns the fastest available specialist
                    </p>
                  </div>
                </div>
              </div>

              {/* Option B: Specific Staff Members assigned to this service */}
              {staffList.map((st) => (
                <div
                  key={st._id}
                  onClick={() => {
                    setSelectedStaff(st);
                    setStep(3);
                  }}
                  className={`bg-white p-5 rounded-xl border cursor-pointer transition-all ${
                    selectedStaff?._id === st._id
                      ? 'border-primary-500 ring-2 ring-primary-100 bg-primary-50/20'
                      : 'border-gray-200 hover:border-primary-400'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center font-bold">
                      {st.userId?.name?.charAt(0) || 'S'}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {st.userId?.name || 'Staff Member'}
                      </h3>
                      <p className="text-xs text-gray-500">Assigned Specialist</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Date & Time Slot */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">3. Pick Date & Time</h2>
              <Button variant="ghost" size="sm" onClick={() => setStep(2)}>
                ← Change Staff
              </Button>
            </div>

            <div className="bg-white p-6 rounded-xl border border-gray-200 space-y-6">
              {/* Date Picker */}
              <div>
                <label
                  htmlFor="appointmentDate"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Select Appointment Date *
                </label>
                <input
                  id="appointmentDate"
                  type="date"
                  min={todayStr}
                  value={selectedDate}
                  onChange={(e) => {
                    setSelectedDate(e.target.value);
                    setSelectedTime('');
                  }}
                  className="w-full sm:w-64 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {/* Operating Hours Banner */}
              {selectedDate && dayOperatingHours && (
                <div
                  className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
                    dayOperatingHours.isClosed
                      ? 'bg-red-50 text-red-800 border border-red-200'
                      : 'bg-blue-50 text-blue-800 border border-blue-200'
                  }`}
                >
                  <span>ℹ️</span>
                  <span>
                    <strong>{dayOperatingHours.dayName}:</strong>{' '}
                    {dayOperatingHours.isClosed
                      ? 'Business is closed on this day. Please select another date.'
                      : `Operating Hours ${dayOperatingHours.open} – ${dayOperatingHours.close}`}
                  </span>
                </div>
              )}

              {/* Time Slots Grid */}
              {selectedDate && !dayOperatingHours?.isClosed && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Available Slots ({selectedService?.duration} mins) *
                    </label>
                    {loadingSlots && (
                      <span className="text-xs text-primary-600 flex items-center gap-1">
                        <Spinner size="sm" /> Checking slot availability...
                      </span>
                    )}
                  </div>

                  {apiSlots.length > 0 ? (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 max-h-56 overflow-y-auto p-1">
                      {apiSlots.map((slot) => {
                        const isSelected = selectedTime === slot.startTime;
                        return (
                          <button
                            key={slot.startTime}
                            type="button"
                            disabled={!slot.isAvailable}
                            onClick={() => slot.isAvailable && setSelectedTime(slot.startTime)}
                            title={!slot.isAvailable ? `Unavailable (${slot.reason || 'Booked'})` : 'Available'}
                            className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-all text-center ${
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
                  ) : availableSlots.length > 0 ? (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 max-h-56 overflow-y-auto p-1">
                      {availableSlots.map((slot) => (
                        <button
                          key={slot.start}
                          type="button"
                          onClick={() => setSelectedTime(slot.start)}
                          className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-all text-center ${
                            selectedTime === slot.start
                              ? 'bg-primary-600 text-white border-primary-600 shadow'
                              : 'bg-white text-gray-800 border-gray-200 hover:border-primary-400'
                          }`}
                        >
                          {slot.start}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 italic">
                      No slots available for this day.
                    </p>
                  )}
                </div>
              )}

              {selectedTime && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-xs text-green-800 flex justify-between items-center">
                  <span>Selected Time Slot:</span>
                  <span className="font-bold">
                    {selectedTime} – {calculatedEndTime}
                  </span>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <Button
                  disabled={!selectedDate || !selectedTime}
                  onClick={() => setStep(4)}
                >
                  Continue to Summary →
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Summary & Confirm */}
        {step === 4 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">4. Review & Confirm</h2>
              <Button variant="ghost" size="sm" onClick={() => setStep(3)}>
                ← Change Time
              </Button>
            </div>

            <div className="bg-white p-6 rounded-xl border border-gray-200 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <span className="text-xs text-gray-400 uppercase tracking-wide font-bold">
                    Service
                  </span>
                  <h4 className="font-bold text-gray-900 text-base mt-1">
                    {selectedService?.name}
                  </h4>
                  <p className="text-xs text-gray-500 mt-1">
                    Duration: {selectedService?.duration} mins
                  </p>
                  <p className="text-sm font-extrabold text-primary-600 mt-2">
                    ₹{selectedService?.price}
                  </p>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <span className="text-xs text-gray-400 uppercase tracking-wide font-bold">
                    Schedule
                  </span>
                  <h4 className="font-bold text-gray-900 text-base mt-1">
                    {new Date(selectedDate).toLocaleDateString('en-IN', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </h4>
                  <p className="text-sm font-bold text-gray-800 mt-1">
                    {selectedTime} – {calculatedEndTime}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    Specialist:{' '}
                    <strong>
                      {selectedStaff === 'any'
                        ? 'Any Available Specialist'
                        : selectedStaff.userId?.name || 'Assigned Staff'}
                    </strong>
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Special Notes or Requests (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Any specific preference, questions, or notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <Button variant="secondary" onClick={() => setStep(3)}>
                  Back
                </Button>
                <Button loading={submitting} onClick={handleBook}>
                  Confirm & Book Appointment
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageWrapper>
  );
};

export default BookAppointmentPage;
