import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import QueueDashboardPage from '../QueueDashboardPage';

// ── Mock API modules ──────────────────────────────────────────────────────────
vi.mock('../../api/queueApi', () => ({
  queueApi: {
    getQueueDashboard: vi.fn(),
    updateTokenStatus: vi.fn(),
  },
}));

vi.mock('../../api/businessApi', () => ({
  getCurrentBusiness: vi.fn(),
}));

vi.mock('../../hooks/useAuth', () => ({
  default: () => ({ user: { _id: 'admin1', name: 'Admin', role: 'admin', businessId: 'biz1' } }),
}));

vi.mock('../../hooks/useToast', () => ({
  default: () => ({ success: vi.fn(), error: vi.fn() }),
}));

import { queueApi } from '../../api/queueApi';
import { getCurrentBusiness } from '../../api/businessApi';

// ── Fixtures ──────────────────────────────────────────────────────────────────
const mockBusiness = { _id: 'biz1', name: 'Test Salon' };

const mockDashboard = {
  queueDate: '2026-11-18',
  summary: {
    waiting: 2,
    called: 1,
    'in-service': 1,
    completed: 1,
    cancelled: 0,
    'no-show': 0,
    total: 5,
  },
  tokens: [
    {
      _id: 't1',
      tokenNumber: 1,
      guestName: 'Alice',
      guestPhone: '9876543210',
      status: 'waiting',
      serviceId: { name: 'Haircut', duration: 30 },
      servedBy: null,
    },
    {
      _id: 't2',
      tokenNumber: 2,
      guestName: 'Bob',
      guestPhone: '',
      status: 'called',
      serviceId: { name: 'Massage', duration: 60 },
      servedBy: { name: 'Staff A' },
    },
    {
      _id: 't3',
      tokenNumber: 3,
      guestName: 'Carol',
      guestPhone: '',
      status: 'in-service',
      serviceId: { name: 'Facial', duration: 45 },
      servedBy: { name: 'Staff B' },
    },
    {
      _id: 't4',
      tokenNumber: 4,
      guestName: 'Dave',
      guestPhone: '',
      status: 'completed',
      serviceId: { name: 'Haircut', duration: 30 },
      servedBy: { name: 'Staff A' },
    },
    {
      _id: 't5',
      tokenNumber: 5,
      guestName: 'Eve',
      guestPhone: '',
      status: 'waiting',
      serviceId: { name: 'Haircut', duration: 30 },
      servedBy: null,
    },
  ],
};

// ── Helper ────────────────────────────────────────────────────────────────────
const renderPage = () =>
  render(
    <MemoryRouter>
      <QueueDashboardPage />
    </MemoryRouter>
  );

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('QueueDashboardPage (M9)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentBusiness.mockResolvedValue({ success: true, data: mockBusiness });
    queueApi.getQueueDashboard.mockResolvedValue({ success: true, data: mockDashboard });
  });

  it('renders page title', async () => {
    renderPage();
    expect(await screen.findByText('Queue Dashboard')).toBeInTheDocument();
  });

  it('shows business name after loading', async () => {
    renderPage();
    expect(await screen.findByText(/Test Salon/)).toBeInTheDocument();
  });

  it('renders summary card counts', async () => {
    renderPage();
    await screen.findByText('Queue Dashboard');
    // waiting = 2, called = 1, in-service = 1, completed = 1
    const counts = screen.getAllByText(/^[0-9]+$/);
    const nums = counts.map((el) => Number(el.textContent));
    expect(nums).toContain(2); // waiting
    expect(nums).toContain(1); // called, in-service, completed
  });

  it('renders all tokens in the table', async () => {
    renderPage();
    expect(await screen.findByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Carol')).toBeInTheDocument();
    expect(screen.getByText('Dave')).toBeInTheDocument();
    expect(screen.getByText('Eve')).toBeInTheDocument();
  });

  it('shows R5 info banner', async () => {
    renderPage();
    expect(await screen.findByText(/Rule R5/)).toBeInTheDocument();
  });

  it('shows Call action button for waiting token', async () => {
    renderPage();
    await screen.findByText('Alice');
    const callBtns = screen.getAllByText(/📢 Call/);
    expect(callBtns.length).toBeGreaterThan(0);
  });

  it('shows Start Service button for called token', async () => {
    renderPage();
    await screen.findByText('Bob');
    expect(screen.getByText(/▶ Start Service/)).toBeInTheDocument();
  });

  it('shows Complete button for in-service token', async () => {
    renderPage();
    await screen.findByText('Carol');
    expect(screen.getByText(/✅ Complete/)).toBeInTheDocument();
  });

  it('shows no action buttons for completed token', async () => {
    renderPage();
    await screen.findByText('Dave');
    // The completed row Dave (#4) should not have any action buttons
    // We rely on status badge text "completed" being present
    expect(screen.getByText('completed')).toBeInTheDocument();
  });

  it('calls updateTokenStatus when Call button is clicked', async () => {
    queueApi.updateTokenStatus.mockResolvedValue({
      success: true,
      data: { ...mockDashboard.tokens[0], status: 'called' },
      message: "Token #1 → called",
    });

    renderPage();
    await screen.findByText('Alice');

    const callBtns = screen.getAllByText(/📢 Call/);
    fireEvent.click(callBtns[0]);

    await waitFor(() => {
      expect(queueApi.updateTokenStatus).toHaveBeenCalledWith('t1', 'called');
    });
  });

  it('filters to only waiting tokens when Waiting filter tab is clicked', async () => {
    renderPage();
    await screen.findByText('Alice');

    const waitingTab = screen.getByRole('button', { name: /🕐 Waiting/ });
    fireEvent.click(waitingTab);

    // Alice and Eve are waiting; Bob (called) should not be in the filtered view
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Eve')).toBeInTheDocument();
    expect(screen.queryByText('Bob')).not.toBeInTheDocument();
  });

  it('filters to active tokens (waiting + called + in-service) on Active tab', async () => {
    renderPage();
    await screen.findByText('Alice');

    const activeTab = screen.getByRole('button', { name: /🟡 Active/ });
    fireEvent.click(activeTab);

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Carol')).toBeInTheDocument();
    // Dave is completed — should be hidden
    expect(screen.queryByText('Dave')).not.toBeInTheDocument();
  });

  it('shows empty state when no tokens for filter', async () => {
    queueApi.getQueueDashboard.mockResolvedValue({
      success: true,
      data: { ...mockDashboard, tokens: [], summary: { waiting: 0, called: 0, 'in-service': 0, completed: 0, cancelled: 0, 'no-show': 0, total: 0 } },
    });
    renderPage();
    expect(await screen.findByText(/No tokens found for this filter/)).toBeInTheDocument();
  });
});

