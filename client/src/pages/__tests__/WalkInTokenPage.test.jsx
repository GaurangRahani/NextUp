import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WalkInTokenPage from '../WalkInTokenPage';
import * as businessApi from '../../api/businessApi';
import * as serviceApi from '../../api/serviceApi';
import { queueApi } from '../../api/queueApi';
import { AuthContext } from '../../context/AuthContext';

vi.mock('../../api/businessApi');
vi.mock('../../api/serviceApi');
vi.mock('../../api/queueApi');

const renderWithAuth = (user = null) => {
  const mockAuth = {
    user,
    isAuthenticated: !!user,
  };

  return render(
    <AuthContext.Provider value={mockAuth}>
      <BrowserRouter>
        <WalkInTokenPage />
      </BrowserRouter>
    </AuthContext.Provider>
  );
};

describe('WalkInTokenPage (Module 8 — Rule R4 Walk-in Tokens)', () => {
  const mockBusiness = {
    _id: 'biz1',
    name: 'Metro Barber Kiosk',
    timezone: 'Asia/Kolkata',
  };

  const mockServices = [
    { _id: 'svc1', name: 'Standard Haircut', duration: 30, price: 25, isActive: true },
    { _id: 'svc2', name: 'Beard Trim', duration: 15, price: 15, isActive: true },
  ];

  const mockTodayQueue = [
    {
      _id: 'tok1',
      tokenNumber: 1,
      guestName: 'Alice',
      status: 'in-service',
      serviceId: { name: 'Standard Haircut' },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    businessApi.getCurrentBusiness.mockResolvedValue({
      success: true,
      data: mockBusiness,
    });
    businessApi.getDefaultBusiness.mockResolvedValue({
      success: true,
      data: mockBusiness,
    });
    serviceApi.getServices.mockResolvedValue({
      success: true,
      data: mockServices,
    });
    queueApi.getTodayQueue.mockResolvedValue({
      success: true,
      data: mockTodayQueue,
    });
    queueApi.generateToken.mockResolvedValue({
      success: true,
      data: {
        _id: 'tok2',
        tokenNumber: 2,
        guestName: 'Bob Builder',
        guestPhone: '9876543210',
        status: 'waiting',
        queueDate: '2026-11-16',
        serviceId: { name: 'Standard Haircut', duration: 30, price: 25 },
        businessId: { name: 'Metro Barber Kiosk' },
      },
    });
  });

  it('renders kiosk header, services, and live queue list', async () => {
    renderWithAuth({ _id: 'u1', name: 'Bob Builder', role: 'customer' });

    await waitFor(() => {
      expect(screen.getByText('Metro Barber Kiosk')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Standard Haircut' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Beard Trim' })).toBeInTheDocument();
      expect(screen.getByText(/Today's Queue/i)).toBeInTheDocument();
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });
  });

  it('R4: generates daily sequential token and renders digital token pass', async () => {
    renderWithAuth({ _id: 'u1', name: 'Bob Builder', role: 'customer' });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Standard Haircut' })).toBeInTheDocument();
    });

    const submitBtn = screen.getByRole('button', { name: /Issue My Token/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(queueApi.generateToken).toHaveBeenCalledWith({
        businessId: 'biz1',
        serviceId: 'svc1',
        guestName: 'Bob Builder',
        guestPhone: '',
      });
      expect(screen.getAllByText(/#2/)[0]).toBeInTheDocument();
      expect(screen.getByText(/Token Confirmed/i)).toBeInTheDocument();
      expect(screen.getByText(/Rule R4: Sequential Daily Token/i)).toBeInTheDocument();
    });
  });

  it('allows unauthenticated guest to enter name and phone for walk-in token', async () => {
    renderWithAuth(null); // Guest user

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Standard Haircut' })).toBeInTheDocument();
    });

    const nameInput = screen.getByPlaceholderText(/e.g. Sarah Connor/i);
    const phoneInput = screen.getByPlaceholderText(/e.g. \+91 98765 43210/i);

    fireEvent.change(nameInput, { target: { value: 'Guest Sarah' } });
    fireEvent.change(phoneInput, { target: { value: '9876500000' } });

    const submitBtn = screen.getByRole('button', { name: /Issue My Token/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(queueApi.generateToken).toHaveBeenCalledWith({
        businessId: 'biz1',
        serviceId: 'svc1',
        guestName: 'Guest Sarah',
        guestPhone: '9876500000',
      });
    });
  });

  it('allows resetting after token generation to issue another token', async () => {
    renderWithAuth({ _id: 'u1', name: 'Bob Builder', role: 'customer' });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Standard Haircut' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Issue My Token/i }));

    await waitFor(() => {
      expect(screen.getAllByText(/#2/)[0]).toBeInTheDocument();
    });

    const anotherBtn = screen.getByRole('button', { name: /\+ Issue Another Token/i });
    fireEvent.click(anotherBtn);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Issue My Token/i })).toBeInTheDocument();
    });
  });
});
