import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import BusinessProfilePage from '../BusinessProfilePage';
import * as businessApi from '../../api/businessApi';

vi.mock('../../api/businessApi');

const renderComponent = () => {
  return render(
    <BrowserRouter>
      <BusinessProfilePage />
    </BrowserRouter>
  );
};

describe('BusinessProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders business profile form and 7 operating days after loading', async () => {
    businessApi.getCurrentBusiness.mockResolvedValue({
      success: true,
      data: {
        _id: 'biz123',
        name: 'Luxe Salon',
        timezone: 'Asia/Kolkata',
        phone: '+91 9876543210',
        address: { street: '123 St', city: 'Mumbai', state: 'MH', zip: '400001' },
        operatingHours: [
          { day: 'Monday', open: '09:00', close: '18:00', isClosed: false },
          { day: 'Tuesday', open: '09:00', close: '18:00', isClosed: false },
          { day: 'Wednesday', open: '09:00', close: '18:00', isClosed: false },
          { day: 'Thursday', open: '09:00', close: '18:00', isClosed: false },
          { day: 'Friday', open: '09:00', close: '18:00', isClosed: false },
          { day: 'Saturday', open: '10:00', close: '17:00', isClosed: false },
          { day: 'Sunday', open: '00:00', close: '00:00', isClosed: true },
        ],
      },
    });

    renderComponent();

    expect(await screen.findByDisplayValue('Luxe Salon')).toBeInTheDocument();
    expect(screen.getByText('Monday')).toBeInTheDocument();
    expect(screen.getByText('Sunday')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
  });

  it('disables time inputs when Closed is checked', async () => {
    businessApi.getCurrentBusiness.mockResolvedValue({
      success: false,
    });

    renderComponent();

    // Wait for form to load with default days
    expect(await screen.findByText('Monday')).toBeInTheDocument();

    const mondayOpenInput = screen.getByLabelText('Monday Open Time');
    expect(mondayOpenInput).not.toBeDisabled();

    // Check closed for Monday
    const closedCheckboxes = screen.getAllByRole('checkbox');
    const mondayCheckbox = closedCheckboxes[0];

    fireEvent.click(mondayCheckbox);

    expect(mondayOpenInput).toBeDisabled();
  });

  it('shows error when open time is after or equal to close time', async () => {
    businessApi.getCurrentBusiness.mockResolvedValue({
      success: true,
      data: {
        _id: 'biz123',
        name: 'Luxe Salon',
        operatingHours: [
          { day: 'Monday', open: '19:00', close: '09:00', isClosed: false }, // invalid
        ],
      },
    });

    renderComponent();

    expect(await screen.findByDisplayValue('Luxe Salon')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    expect(
      await screen.findByText(/open time .* must be before close time/i)
    ).toBeInTheDocument();
  });
});
