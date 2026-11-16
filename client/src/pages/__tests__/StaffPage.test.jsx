import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import StaffPage from '../StaffPage';
import * as staffApi from '../../api/staffApi';
import * as serviceApi from '../../api/serviceApi';
import * as businessApi from '../../api/businessApi';
import { AuthContext } from '../../context/AuthContext';

vi.mock('../../api/staffApi');
vi.mock('../../api/serviceApi');
vi.mock('../../api/businessApi');

const renderWithAuth = () => {
  const mockAuth = {
    user: { _id: 'admin1', name: 'Admin', role: 'admin', businessId: 'biz123' },
    isAuthenticated: true,
  };

  return render(
    <AuthContext.Provider value={mockAuth}>
      <BrowserRouter>
        <StaffPage />
      </BrowserRouter>
    </AuthContext.Provider>
  );
};

describe('StaffPage', () => {
  const mockServices = [
    { _id: 's1', name: 'Haircut', duration: 30, price: 300, isActive: true },
    { _id: 's2', name: 'Beard Trim', duration: 15, price: 150, isActive: true },
  ];

  const mockStaff = [
    {
      _id: 'st1',
      userId: { _id: 'u1', name: 'Rahul Sharma', email: 'rahul@example.com', role: 'staff' },
      businessId: 'biz123',
      serviceIds: [mockServices[0], mockServices[1]],
      isActive: true,
    },
    {
      _id: 'st2',
      userId: { _id: 'u2', name: 'Priya Patel', email: 'priya@example.com', role: 'staff' },
      businessId: 'biz123',
      serviceIds: [],
      isActive: false,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    businessApi.getCurrentBusiness.mockResolvedValue({
      success: true,
      data: { _id: 'biz123', name: 'Apex Salon' },
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

  it('renders staff list with names, emails, assigned services, and status badges', async () => {
    renderWithAuth();

    expect(await screen.findByText('Rahul Sharma')).toBeInTheDocument();
    expect(screen.getByText('rahul@example.com')).toBeInTheDocument();
    expect(screen.getByText('Haircut')).toBeInTheDocument();
    expect(screen.getByText('Beard Trim')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();

    expect(screen.getByText('Priya Patel')).toBeInTheDocument();
    expect(screen.getByText('priya@example.com')).toBeInTheDocument();
    expect(screen.getByText('No services assigned')).toBeInTheDocument();
    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });

  it('opens Add Staff Member modal when clicking button', async () => {
    renderWithAuth();

    const addBtn = await screen.findByRole('button', { name: /\+ Add Staff Member/i });
    fireEvent.click(addBtn);

    expect(screen.getByRole('heading', { name: 'Add Staff Member' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. Rahul Sharma')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('rahul@example.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('At least 6 characters')).toBeInTheDocument();
  });

  it('opens Edit & Assign modal with existing staff data', async () => {
    renderWithAuth();

    const editBtns = await screen.findAllByRole('button', { name: /Edit & Assign/i });
    fireEvent.click(editBtns[0]);

    expect(
      screen.getByRole('heading', { name: 'Edit Staff Member & Service Assignment' })
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue('Rahul Sharma')).toBeInTheDocument();
    expect(screen.getByText('Active staff member (available for bookings and walk-ins)')).toBeInTheDocument();
  });

  it('opens deactivate confirmation modal when clicking Deactivate', async () => {
    renderWithAuth();

    const deactivateBtn = await screen.findByRole('button', { name: 'Deactivate' });
    fireEvent.click(deactivateBtn);

    expect(screen.getByRole('heading', { name: 'Deactivate Staff Member' })).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to deactivate/i)).toBeInTheDocument();
  });
});
