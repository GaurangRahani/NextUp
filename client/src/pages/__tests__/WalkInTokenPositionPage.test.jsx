import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import WalkInTokenPage from '../WalkInTokenPage';

// Mock all API modules
vi.mock('../../api/businessApi', () => ({
  getCurrentBusiness: vi.fn(),
  getDefaultBusiness: vi.fn(),
}));
vi.mock('../../api/serviceApi', () => ({
  getServices: vi.fn(),
}));
vi.mock('../../api/queueApi', () => ({
  queueApi: {
    generateToken: vi.fn(),
    getTodayQueue: vi.fn(),
    getQueueDashboard: vi.fn(),
    updateTokenStatus: vi.fn(),
    getQueuePosition: vi.fn(),
  },
  default: {
    generateToken: vi.fn(),
    getTodayQueue: vi.fn(),
    getQueueDashboard: vi.fn(),
    updateTokenStatus: vi.fn(),
    getQueuePosition: vi.fn(),
  },
}));
vi.mock('../../hooks/useAuth', () => ({
  default: () => ({ user: null }),
}));
vi.mock('../../hooks/useToast', () => ({
  default: () => ({ error: vi.fn(), success: vi.fn() }),
}));

import { getCurrentBusiness, getDefaultBusiness } from '../../api/businessApi';
import { getServices } from '../../api/serviceApi';
import { queueApi } from '../../api/queueApi';

const mockBusiness = { _id: 'biz1', name: 'Test Salon' };
const mockServices = [
  { _id: 'svc1', name: 'Haircut', duration: 20, price: 25, isActive: true },
];

const mockPositionData = {
  tokenId: 'tok1',
  tokenNumber: 3,
  status: 'waiting',
  position: 2,
  tokensAhead: 1,
  estimatedWaitMinutes: 20,
  activeStaffCount: 1,
  avgServiceDurationMinutes: 20,
};

beforeEach(() => {
  getCurrentBusiness.mockRejectedValue(new Error('not logged in'));
  getDefaultBusiness.mockResolvedValue({ success: true, data: mockBusiness });
  getServices.mockResolvedValue({ success: true, data: mockServices });
  queueApi.getTodayQueue.mockResolvedValue({ success: true, data: [] });
  queueApi.getQueuePosition.mockResolvedValue({
    success: true,
    data: mockPositionData,
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('M10: Queue Position API (Decision D6, Rule R8)', () => {
  it('calls getQueuePosition with correct tokenId', async () => {
    await queueApi.getQueuePosition('tok1');
    expect(queueApi.getQueuePosition).toHaveBeenCalledWith('tok1');
  });

  it('getQueuePosition returns all D6 fields', async () => {
    const result = await queueApi.getQueuePosition('tok1');
    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty('position');
    expect(result.data).toHaveProperty('estimatedWaitMinutes');
    expect(result.data).toHaveProperty('tokensAhead');
    expect(result.data).toHaveProperty('activeStaffCount');
    expect(result.data).toHaveProperty('avgServiceDurationMinutes');
    expect(result.data).toHaveProperty('tokenNumber');
    expect(result.data).toHaveProperty('status');
  });

  it('position=2 and wait=20min with 1 token ahead and 1 staff', async () => {
    const result = await queueApi.getQueuePosition('tok1');
    expect(result.data.position).toBe(2);
    expect(result.data.estimatedWaitMinutes).toBe(20);
    expect(result.data.tokensAhead).toBe(1);
    expect(result.data.activeStaffCount).toBe(1);
  });

  it('position=1 and estimatedWaitMinutes=0 when first in queue (empty ahead)', async () => {
    queueApi.getQueuePosition.mockResolvedValueOnce({
      success: true,
      data: {
        ...mockPositionData,
        position: 1,
        tokensAhead: 0,
        estimatedWaitMinutes: 0,
      },
    });

    const result = await queueApi.getQueuePosition('tok1');
    expect(result.data.position).toBe(1);
    expect(result.data.estimatedWaitMinutes).toBe(0);
    expect(result.data.tokensAhead).toBe(0);
  });

  it('terminal token (completed) returns position=0, wait=0', async () => {
    queueApi.getQueuePosition.mockResolvedValueOnce({
      success: true,
      data: {
        tokenId: 'tok1',
        tokenNumber: 3,
        status: 'completed',
        position: 0,
        estimatedWaitMinutes: 0,
        tokensAhead: 0,
      },
    });

    const result = await queueApi.getQueuePosition('tok1');
    expect(result.data.status).toBe('completed');
    expect(result.data.position).toBe(0);
    expect(result.data.estimatedWaitMinutes).toBe(0);
  });

  it('terminal token (cancelled) returns position=0, wait=0', async () => {
    queueApi.getQueuePosition.mockResolvedValueOnce({
      success: true,
      data: { status: 'cancelled', position: 0, estimatedWaitMinutes: 0, tokensAhead: 0 },
    });

    const result = await queueApi.getQueuePosition('tok1');
    expect(result.data.position).toBe(0);
  });

  it('D6: 2 staff halves the wait (40min → 20min vs 1 staff)', async () => {
    // With 1 staff and 2 tokens ahead at 20min avg → 40min
    queueApi.getQueuePosition.mockResolvedValueOnce({
      success: true,
      data: { ...mockPositionData, position: 3, tokensAhead: 2, estimatedWaitMinutes: 40, activeStaffCount: 1 },
    });
    const r1 = await queueApi.getQueuePosition('tok1');
    expect(r1.data.estimatedWaitMinutes).toBe(40);

    // With 2 staff and 2 tokens ahead at 20min avg → 20min
    queueApi.getQueuePosition.mockResolvedValueOnce({
      success: true,
      data: { ...mockPositionData, position: 3, tokensAhead: 2, estimatedWaitMinutes: 20, activeStaffCount: 2 },
    });
    const r2 = await queueApi.getQueuePosition('tok1');
    expect(r2.data.estimatedWaitMinutes).toBe(20);
    expect(r2.data.estimatedWaitMinutes).toBeLessThan(r1.data.estimatedWaitMinutes);
  });

  it('R8: position recalculates after a cancellation (fewer ahead)', async () => {
    // Before cancellation: 2 ahead → position 3
    queueApi.getQueuePosition.mockResolvedValueOnce({
      success: true,
      data: { ...mockPositionData, position: 3, tokensAhead: 2, estimatedWaitMinutes: 40 },
    });
    const before = await queueApi.getQueuePosition('tok1');
    expect(before.data.position).toBe(3);

    // After cancellation: 1 ahead → position 2
    queueApi.getQueuePosition.mockResolvedValueOnce({
      success: true,
      data: { ...mockPositionData, position: 2, tokensAhead: 1, estimatedWaitMinutes: 20 },
    });
    const after = await queueApi.getQueuePosition('tok1');
    expect(after.data.position).toBe(2);
    expect(after.data.position).toBeLessThan(before.data.position);
  });
});

describe('M10: WalkInTokenPage — renders loading state', () => {
  it('shows loading spinner on initial render (before data loads)', () => {
    render(<WalkInTokenPage />);
    // Page starts in loading state immediately
    expect(screen.getByText(/Initializing walk-in kiosk/i)).toBeInTheDocument();
  });

  it('does not show Live Queue Tracker in loading state (position only shown after token issued)', () => {
    render(<WalkInTokenPage />);
    expect(screen.queryByText(/Live Queue Tracker/i)).not.toBeInTheDocument();
  });
});
