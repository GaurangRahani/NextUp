import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ServicesPage from '../ServicesPage';
import * as serviceApi from '../../api/serviceApi';
import * as businessApi from '../../api/businessApi';
import { AuthContext } from '../../context/AuthContext';

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
        <ServicesPage />
      </BrowserRouter>
    </AuthContext.Provider>
  );
};

describe('ServicesPage', () => {
  const mockServices = [
    {
      _id: 's1',
      name: 'Haircut',
      description: 'Standard cut',
      duration: 30,
      price: 350,
      isActive: true,
    },
    {
      _id: 's2',
      name: 'Beard Trim',
      description: 'Clean beard shaping',
      duration: 15,
      price: 150,
      isActive: false,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    businessApi.getCurrentBusiness.mockResolvedValue({
      success: true,
      data: { _id: 'biz123', name: 'Salon' },
    });
  });

  it('renders services table with durations, prices, and status badges', async () => {
    serviceApi.getServices.mockResolvedValue({
      success: true,
      data: mockServices,
    });

    renderWithAuth();

    expect(await screen.findByText('Haircut')).toBeInTheDocument();
    expect(screen.getByText('30 mins')).toBeInTheDocument();
    expect(screen.getByText('₹350')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();

    expect(screen.getByText('Beard Trim')).toBeInTheDocument();
    expect(screen.getByText('15 mins')).toBeInTheDocument();
    expect(screen.getByText('₹150')).toBeInTheDocument();
    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });

  it('opens Add New Service modal when clicking button', async () => {
    serviceApi.getServices.mockResolvedValue({
      success: true,
      data: [],
    });

    renderWithAuth();

    const addBtn = await screen.findByRole('button', { name: /\+ add new service/i });
    fireEvent.click(addBtn);

    expect(screen.getByRole('heading', { name: /add new service/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/service name \*/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/duration \(minutes\) \*/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/price \(₹\) \*/i)).toBeInTheDocument();
  });

  it('validates empty inputs on service creation modal submit', async () => {
    serviceApi.getServices.mockResolvedValue({
      success: true,
      data: [],
    });

    renderWithAuth();

    const addBtn = await screen.findByRole('button', { name: /\+ add new service/i });
    fireEvent.click(addBtn);

    const submitBtn = screen.getByRole('button', { name: /create service/i });
    fireEvent.click(submitBtn);

    expect(await screen.findByText(/service name is required/i)).toBeInTheDocument();
    expect(screen.getByText(/duration must be a positive number/i)).toBeInTheDocument();
  });
});
