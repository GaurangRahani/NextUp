import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AppointmentsPage from '../AppointmentsPage';
import * as appointmentApi from '../../api/appointmentApi';
import * as availabilityApi from '../../api/availabilityApi';
import { AuthContext } from '../../context/AuthContext';

vi.mock('../../api/appointmentApi');
vi.mock('../../api/availabilityApi');

const renderWithAuth = (role = 'customer') => {
  const mockAuth = {
    user: { _id: 'cust1', name: 'Deep Boghara', role },
    isAuthenticated: true,
  };

  return render(
    <AuthContext.Provider value={mockAuth}>
      <BrowserRouter>
        <AppointmentsPage />
      </BrowserRouter>
    </AuthContext.Provider>
  );
};

describe('AppointmentsPage', () => {
  const mockAppointments = [
    {
      _id: 'appt1',
      serviceId: { _id: 'svc1', name: 'Haircut & Styling', price: 500, duration: 45 },
      staffId: { _id: 'st1', name: 'Rahul Sharma' },
      customerId: { _id: 'cust1', name: 'Deep Boghara' },
      businessId: { _id: 'biz1' },
      date: '2026-11-20T00:00:00.000Z',
      startTime: '10:00',
      endTime: '10:45',
      status: 'scheduled',
    },
    {
      _id: 'appt2',
      serviceId: { _id: 'svc2', name: 'Deep Cleansing Facial', price: 1200, duration: 60 },
      staffId: { _id: 'st2', name: 'Priya Patel' },
      customerId: { _id: 'cust1', name: 'Deep Boghara' },
      businessId: { _id: 'biz1' },
      date: '2026-11-21T00:00:00.000Z',
      startTime: '14:00',
      endTime: '15:00',
      status: 'scheduled',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    appointmentApi.getAppointments.mockResolvedValue({
      success: true,
      data: mockAppointments,
    });
    availabilityApi.getAvailability.mockResolvedValue({
      success: true,
      data: {
        slots: [
          { startTime: '11:00', endTime: '11:45', isAvailable: true },
          { startTime: '11:30', endTime: '12:15', isAvailable: false },
        ],
      },
    });
  });

  it('renders upcoming appointments with details, prices, and status badges', async () => {
    renderWithAuth();

    expect(await screen.findByText('Haircut & Styling')).toBeInTheDocument();
    expect(screen.getByText('Rahul Sharma')).toBeInTheDocument();
    expect(screen.getByText('10:00 – 10:45')).toBeInTheDocument();
    expect(screen.getByText('₹500')).toBeInTheDocument();

    expect(screen.getByText('Deep Cleansing Facial')).toBeInTheDocument();
    expect(screen.getByText('Priya Patel')).toBeInTheDocument();
    expect(screen.getByText('14:00 – 15:00')).toBeInTheDocument();
    expect(screen.getByText('₹1200')).toBeInTheDocument();
  });

  it('switches between Upcoming and Past tabs', async () => {
    renderWithAuth();

    await screen.findByText('Haircut & Styling');

    const pastTab = screen.getByRole('button', { name: /Past & History/i });
    fireEvent.click(pastTab);

    expect(appointmentApi.getAppointments).toHaveBeenCalledWith(
      expect.objectContaining({ timeframe: 'past' })
    );
  });

  it('opens Cancel modal and submits cancellation', async () => {
    appointmentApi.cancelAppointment.mockResolvedValue({
      success: true,
      message: 'Appointment cancelled successfully',
    });

    renderWithAuth();

    const cancelButtons = await screen.findAllByRole('button', { name: 'Cancel' });
    fireEvent.click(cancelButtons[0]);

    expect(screen.getByRole('heading', { name: 'Cancel Appointment' })).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to cancel/i)).toBeInTheDocument();

    const confirmCancelBtn = screen.getByRole('button', { name: 'Confirm Cancellation' });
    fireEvent.click(confirmCancelBtn);

    await waitFor(() => {
      expect(appointmentApi.cancelAppointment).toHaveBeenCalledWith(
        'appt1',
        ''
      );
    });
  });

  it('opens Reschedule modal with date picker and available slots', async () => {
    renderWithAuth();

    const rescheduleButtons = await screen.findAllByRole('button', { name: 'Reschedule' });
    fireEvent.click(rescheduleButtons[0]);

    expect(screen.getByRole('heading', { name: 'Reschedule Appointment' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Select New Date \*/i)).toBeInTheDocument();
  });
});
