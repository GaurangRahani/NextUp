import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import BookAppointmentPage from '../BookAppointmentPage';
import * as businessApi from '../../api/businessApi';
import * as serviceApi from '../../api/serviceApi';
import * as staffApi from '../../api/staffApi';
import * as appointmentApi from '../../api/appointmentApi';
import { AuthContext } from '../../context/AuthContext';

vi.mock('../../api/businessApi');
vi.mock('../../api/serviceApi');
vi.mock('../../api/staffApi');
vi.mock('../../api/appointmentApi');

const renderWithAuth = () => {
  const mockAuth = {
    user: { _id: 'cust1', name: 'Deep Boghara', role: 'customer' },
    isAuthenticated: true,
  };

  return render(
    <AuthContext.Provider value={mockAuth}>
      <BrowserRouter>
        <BookAppointmentPage />
      </BrowserRouter>
    </AuthContext.Provider>
  );
};

describe('BookAppointmentPage', () => {
  const mockBusiness = {
    _id: 'biz123',
    name: 'Apex Salon & Spa',
    timezone: 'Asia/Kolkata',
    operatingHours: [
      { day: 'Monday', open: '09:00', close: '18:00', isClosed: false },
      { day: 'Tuesday', open: '09:00', close: '18:00', isClosed: false },
      { day: 'Wednesday', open: '09:00', close: '18:00', isClosed: false },
      { day: 'Thursday', open: '09:00', close: '18:00', isClosed: false },
      { day: 'Friday', open: '09:00', close: '18:00', isClosed: false },
      { day: 'Saturday', open: '10:00', close: '17:00', isClosed: false },
      { day: 'Sunday', open: '00:00', close: '00:00', isClosed: true },
    ],
  };

  const mockServices = [
    {
      _id: 'svc1',
      name: 'Haircut & Styling',
      description: 'Classic cut and wash',
      duration: 45,
      price: 500,
      isActive: true,
    },
    {
      _id: 'svc2',
      name: 'Deep Cleansing Facial',
      description: 'Skin rejuvenation',
      duration: 60,
      price: 1200,
      isActive: true,
    },
  ];

  const mockStaff = [
    {
      _id: 'st1',
      userId: { _id: 'u1', name: 'Rahul Sharma', email: 'rahul@nextup.com' },
      serviceIds: ['svc1'],
      isActive: true,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    businessApi.getCurrentBusiness.mockResolvedValue({
      success: true,
      data: mockBusiness,
    });
    serviceApi.getServices.mockResolvedValue({
      success: true,
      data: mockServices,
    });
    staffApi.getStaff.mockResolvedValue({
      success: true,
      data: mockStaff,
    });
  });

  it('renders Step 1 with active services list', async () => {
    renderWithAuth();

    expect(await screen.findByText('1. Select a Service')).toBeInTheDocument();
    expect(screen.getByText('Haircut & Styling')).toBeInTheDocument();
    expect(screen.getByText('₹500')).toBeInTheDocument();
    expect(screen.getByText('Deep Cleansing Facial')).toBeInTheDocument();
    expect(screen.getByText('₹1200')).toBeInTheDocument();
  });

  it('advances to Step 2 (Staff Selection) upon clicking a service', async () => {
    renderWithAuth();

    const haircutCard = await screen.findByText('Haircut & Styling');
    fireEvent.click(haircutCard);

    expect(await screen.findByText('2. Select Staff Member')).toBeInTheDocument();
    expect(screen.getByText('Any Available Staff')).toBeInTheDocument();
    expect(screen.getByText('Rahul Sharma')).toBeInTheDocument();
  });

  it('advances through staff and date selection to review and booking', async () => {
    appointmentApi.bookAppointment.mockResolvedValue({
      success: true,
      data: {
        _id: 'app123',
        serviceId: mockServices[0],
        staffId: { name: 'Rahul Sharma' },
        date: '2026-11-20',
        startTime: '10:00',
        endTime: '10:45',
      },
      message: 'Appointment booked successfully',
    });

    renderWithAuth();

    // 1. Select Service
    const haircutCard = await screen.findByText('Haircut & Styling');
    fireEvent.click(haircutCard);

    // 2. Select "Any Available Staff"
    const anyStaffCard = await screen.findByText('Any Available Staff');
    fireEvent.click(anyStaffCard);

    // 3. Select Date
    expect(await screen.findByText('3. Pick Date & Time')).toBeInTheDocument();
    const dateInput = screen.getByLabelText(/Select Appointment Date \*/i);
    fireEvent.change(dateInput, { target: { value: '2026-11-20' } });

    // Pick a slot
    const slotBtn = await screen.findByRole('button', { name: '09:00' });
    fireEvent.click(slotBtn);

    // Continue to Review
    const continueBtn = screen.getByRole('button', { name: /Continue to Summary/i });
    fireEvent.click(continueBtn);

    // 4. Review & Confirm
    expect(await screen.findByText('4. Review & Confirm')).toBeInTheDocument();
    expect(screen.getByText(/Haircut & Styling/i)).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: /Confirm & Book Appointment/i });
    fireEvent.click(confirmBtn);

    // 5. Success Screen
    expect(await screen.findByText('Appointment Confirmed!')).toBeInTheDocument();
    expect(screen.getByText(/10:00/)).toBeInTheDocument();
    expect(screen.getByText(/10:45/)).toBeInTheDocument();
  });
});
