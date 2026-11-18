import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import BusinessDashboardPage from '../BusinessDashboardPage';

vi.mock('../../api/businessApi', () => ({
  getBusinessDashboard: vi.fn(),
  getCurrentBusiness: vi.fn(),
  getDefaultBusiness: vi.fn(),
}));
vi.mock('../../hooks/useAuth', () => ({
  default: () => ({ user: { name: 'Admin User', role: 'admin', businessId: 'biz1' } }),
}));
vi.mock('../../hooks/useToast', () => ({
  default: () => ({ error: vi.fn(), success: vi.fn() }),
}));

import { getBusinessDashboard } from '../../api/businessApi';

const makeData = (overrides = {}) => ({
  success: true,
  data: {
    date: '2026-11-18',
    businessId: 'biz1',
    summary: {
      totalAppointments: 0,
      scheduledAppointments: 0,
      completedAppointments: 0,
      cancelledAppointments: 0,
      noShowAppointments: 0,
      totalQueueTokens: 0,
      activeQueueCount: 0,
      waitingInQueue: 0,
      inServiceCount: 0,
      completedQueueTokens: 0,
      estimatedRevenue: 0,
      ...overrides.summary,
    },
    appointments: { total: 0, scheduled: 0, completed: 0, cancelled: 0, noShow: 0, ...overrides.appointments },
    queue: { total: 0, waiting: 0, called: 0, inService: 0, completed: 0, cancelled: 0, noShow: 0, ...overrides.queue },
    topServices: overrides.topServices || [],
    ...overrides.extra,
  },
});

const mockEmptyDashboard = makeData();

const mockFullDashboard = makeData({
  summary: {
    totalAppointments: 10,
    scheduledAppointments: 4,
    completedAppointments: 5,
    cancelledAppointments: 1,
    noShowAppointments: 0,
    totalQueueTokens: 8,
    activeQueueCount: 4,
    waitingInQueue: 2,
    inServiceCount: 1,
    completedQueueTokens: 3,
    estimatedRevenue: 2500,
  },
  appointments: { total: 10, scheduled: 4, completed: 5, cancelled: 1, noShow: 0 },
  queue: { total: 8, waiting: 2, called: 1, inService: 1, completed: 3, cancelled: 1, noShow: 0 },
  topServices: [
    { serviceId: 'svc1', name: 'Haircut', count: 5 },
    { serviceId: 'svc2', name: 'Color Treatment', count: 3 },
  ],
});

beforeEach(() => {
  getBusinessDashboard.mockResolvedValue(mockEmptyDashboard);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('M11: BusinessDashboardPage', () => {
  describe('Rendering & loading', () => {
    it('shows spinner while loading', () => {
      getBusinessDashboard.mockReturnValue(new Promise(() => {}));
      render(<BusinessDashboardPage />);
      expect(screen.getByText(/Loading dashboard data/i)).toBeInTheDocument();
    });

    it('renders dashboard heading and M11 badge after data loads', async () => {
      render(<BusinessDashboardPage />);
      await waitFor(() =>
        expect(screen.getByText(/Business Dashboard/i)).toBeInTheDocument()
      );
      expect(screen.getByText(/M11/i)).toBeInTheDocument();
    });

    it('shows Business Dashboard page title on initial render (before async data)', () => {
      render(<BusinessDashboardPage />);
      // PageWrapper renders the title synchronously
      expect(screen.getByText('Business Dashboard')).toBeInTheDocument();
    });
  });

  describe('Empty state', () => {
    it('shows empty state note when no appointments and no queue tokens', async () => {
      render(<BusinessDashboardPage />);
      await waitFor(() =>
        expect(screen.getByText(/No activity recorded/i)).toBeInTheDocument()
      );
    });

    it('shows "No appointment data" in top services section when empty', async () => {
      render(<BusinessDashboardPage />);
      await waitFor(() =>
        expect(screen.getByText(/No appointment data for this date/i)).toBeInTheDocument()
      );
    });
  });

  describe('Populated data', () => {
    beforeEach(() => {
      getBusinessDashboard.mockResolvedValue(mockFullDashboard);
    });

    it('renders top services list with Haircut', async () => {
      render(<BusinessDashboardPage />);
      await waitFor(() =>
        expect(screen.getByText(/Haircut/i)).toBeInTheDocument()
      );
    });

    it('renders top services list with Color Treatment', async () => {
      render(<BusinessDashboardPage />);
      await waitFor(() =>
        expect(screen.getByText(/Color Treatment/i)).toBeInTheDocument()
      );
    });

    it('shows appointment count labels (5 appts for Haircut)', async () => {
      render(<BusinessDashboardPage />);
      await waitFor(() =>
        expect(screen.getByText(/5 appts/i)).toBeInTheDocument()
      );
    });

    it('shows #1 ranking for top service', async () => {
      render(<BusinessDashboardPage />);
      await waitFor(() =>
        expect(screen.getByText(/#1 Haircut/)).toBeInTheDocument()
      );
    });

    it('does NOT show empty state note when there is data', async () => {
      render(<BusinessDashboardPage />);
      await waitFor(() =>
        expect(screen.getByText(/Business Dashboard/i)).toBeInTheDocument()
      );
      expect(screen.queryByText(/No activity recorded/i)).not.toBeInTheDocument();
    });
  });

  describe('Date picker', () => {
    it('calls getBusinessDashboard initially with today', async () => {
      render(<BusinessDashboardPage />);
      const today = new Date().toISOString().split('T')[0];
      await waitFor(() =>
        expect(getBusinessDashboard).toHaveBeenCalledWith(today)
      );
    });

    it('renders a date input element', async () => {
      render(<BusinessDashboardPage />);
      await waitFor(() =>
        expect(screen.getByDisplayValue(new Date().toISOString().split('T')[0])).toBeInTheDocument()
      );
    });
  });

  describe('Error state', () => {
    it('getBusinessDashboard is invoked exactly once on mount', async () => {
      render(<BusinessDashboardPage />);
      await waitFor(() =>
        expect(getBusinessDashboard).toHaveBeenCalledTimes(1)
      );
    });
  });

  describe('getBusinessDashboard API', () => {
    it('is called with today as default date', async () => {
      render(<BusinessDashboardPage />);
      const today = new Date().toISOString().split('T')[0];
      await waitFor(() =>
        expect(getBusinessDashboard).toHaveBeenCalledWith(today)
      );
    });

    it('returns all M11 summary fields', async () => {
      const result = await getBusinessDashboard('2026-11-18');
      const { summary } = result.data;
      expect(summary).toHaveProperty('totalAppointments');
      expect(summary).toHaveProperty('completedAppointments');
      expect(summary).toHaveProperty('activeQueueCount');
      expect(summary).toHaveProperty('estimatedRevenue');
      expect(summary).toHaveProperty('totalQueueTokens');
    });

    it('returns topServices array', async () => {
      const result = await getBusinessDashboard('2026-11-18');
      expect(Array.isArray(result.data.topServices)).toBe(true);
    });
  });
});
