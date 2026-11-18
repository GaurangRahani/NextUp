import { useState, useEffect, useCallback, useMemo } from 'react';
import PageWrapper from '../components/layout/PageWrapper';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Spinner from '../components/ui/Spinner';
import useToast from '../hooks/useToast';
import useAuth from '../hooks/useAuth';
import { queueApi } from '../api/queueApi';
import { getCurrentBusiness } from '../api/businessApi';

// Rule R5 — Allowed status transitions
const ALLOWED_TRANSITIONS = {
  waiting: ['called', 'cancelled'],
  called: ['in-service', 'no-show'],
  'in-service': ['completed'],
  completed: [],
  cancelled: [],
  'no-show': [],
};

// Label + colour for each action button
const ACTION_CONFIG = {
  called: { label: '📢 Call', color: 'bg-blue-500 hover:bg-blue-600 text-white' },
  'in-service': { label: '▶ Start Service', color: 'bg-indigo-500 hover:bg-indigo-600 text-white' },
  completed: { label: '✅ Complete', color: 'bg-green-500 hover:bg-green-600 text-white' },
  'no-show': { label: '👻 No-Show', color: 'bg-gray-400 hover:bg-gray-500 text-white' },
  cancelled: { label: '✖ Cancel', color: 'bg-red-400 hover:bg-red-500 text-white' },
};

// Badge colour per status
const STATUS_BADGE = {
  waiting: 'neutral',
  called: 'warning',
  'in-service': 'info',
  completed: 'success',
  cancelled: 'error',
  'no-show': 'neutral',
};

const QueueDashboardPage = () => {
  const { user } = useAuth();
  const toast = useToast();

  const [business, setBusiness] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0]
  );

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Fetch business profile
  useEffect(() => {
    const fetchBusiness = async () => {
      try {
        const res = await getCurrentBusiness();
        if (res.success && res.data) setBusiness(res.data);
      } catch {
        toast.error('Could not load business profile');
      }
    };
    fetchBusiness();
  }, [toast]);

  // Fetch queue dashboard
  const loadDashboard = useCallback(async () => {
    if (!business?._id) return;
    try {
      setLoading(true);
      const res = await queueApi.getQueueDashboard(business._id, selectedDate);
      if (res.success) setDashboard(res.data);
    } catch {
      toast.error('Failed to load queue dashboard');
    } finally {
      setLoading(false);
    }
  }, [business, selectedDate, toast]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // Status transition handler
  const handleStatusUpdate = async (token, newStatus) => {
    setUpdatingId(token._id);
    try {
      const res = await queueApi.updateTokenStatus(token._id, newStatus);
      if (res.success) {
        toast.success(`Token #${token.tokenNumber} → ${newStatus}`);
        loadDashboard();
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to update status';
      toast.error(msg);
    } finally {
      setUpdatingId(null);
    }
  };

  // Filter tokens by selected status tab
  const filteredTokens = useMemo(() => {
    if (!dashboard?.tokens) return [];
    if (statusFilter === 'all') return dashboard.tokens;
    if (statusFilter === 'active')
      return dashboard.tokens.filter((t) =>
        ['waiting', 'called', 'in-service'].includes(t.status)
      );
    return dashboard.tokens.filter((t) => t.status === statusFilter);
  }, [dashboard, statusFilter]);

  const summary = dashboard?.summary || {};

  return (
    <PageWrapper title="Queue Dashboard">
      <div className="space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Queue Dashboard</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {business?.name || 'Loading…'} · Rule R5 status transitions
            </p>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="date"
              value={selectedDate}
              max={todayStr}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <Button variant="secondary" onClick={loadDashboard} disabled={loading}>
              {loading ? '⏳ Refreshing…' : '🔄 Refresh'}
            </Button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {[
            { label: 'Waiting', key: 'waiting', emoji: '🕐', color: 'bg-gray-50 border-gray-200 text-gray-700' },
            { label: 'Called', key: 'called', emoji: '📢', color: 'bg-yellow-50 border-yellow-200 text-yellow-800' },
            { label: 'In Service', key: 'in-service', emoji: '▶', color: 'bg-blue-50 border-blue-200 text-blue-800' },
            { label: 'Completed', key: 'completed', emoji: '✅', color: 'bg-green-50 border-green-200 text-green-800' },
            { label: 'Cancelled', key: 'cancelled', emoji: '✖', color: 'bg-red-50 border-red-200 text-red-700' },
            { label: 'No-Show', key: 'no-show', emoji: '👻', color: 'bg-gray-50 border-gray-300 text-gray-500' },
          ].map(({ label, key, emoji, color }) => (
            <div
              key={key}
              className={`border rounded-xl p-4 text-center ${color} cursor-pointer transition-all hover:shadow-sm`}
              onClick={() => setStatusFilter(statusFilter === key ? 'all' : key)}
            >
              <div className="text-xl">{emoji}</div>
              <div className="text-2xl font-black mt-1">{summary[key] ?? 0}</div>
              <div className="text-xs font-semibold mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        {/* R5 Info banner */}
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-5 py-3 text-xs text-indigo-800 leading-relaxed">
          <strong>Rule R5 — Allowed transitions:</strong>&nbsp;
          waiting → called / cancelled &nbsp;·&nbsp;
          called → in-service / no-show &nbsp;·&nbsp;
          in-service → completed &nbsp;·&nbsp;
          All other transitions are rejected (400).
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 flex-wrap">
          {[
            { label: 'All', value: 'all' },
            { label: '🟡 Active', value: 'active' },
            { label: '🕐 Waiting', value: 'waiting' },
            { label: '📢 Called', value: 'called' },
            { label: '▶ In Service', value: 'in-service' },
            { label: '✅ Completed', value: 'completed' },
            { label: '✖ Cancelled', value: 'cancelled' },
            { label: '👻 No-Show', value: 'no-show' },
          ].map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setStatusFilter(value)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                statusFilter === value
                  ? 'bg-primary-600 text-white shadow'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-primary-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Token table */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : filteredTokens.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">🏷️</p>
            <p className="text-sm font-medium">No tokens found for this filter.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">#</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Guest</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Service</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                  {(user?.role === 'admin' || user?.role === 'staff') && (
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Served By</th>
                  )}
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredTokens.map((token) => {
                  const nextStatuses = ALLOWED_TRANSITIONS[token.status] || [];
                  const isUpdating = updatingId === token._id;
                  const canAct = user?.role === 'admin' || user?.role === 'staff';

                  return (
                    <tr
                      key={token._id}
                      className={`transition-colors ${
                        token.status === 'in-service'
                          ? 'bg-blue-50/40'
                          : token.status === 'called'
                          ? 'bg-yellow-50/40'
                          : ''
                      }`}
                    >
                      {/* Token number */}
                      <td className="px-4 py-3">
                        <span className="w-9 h-9 rounded-lg bg-gray-100 text-gray-700 font-black text-sm flex items-center justify-center">
                          #{token.tokenNumber}
                        </span>
                      </td>

                      {/* Guest info */}
                      <td className="px-4 py-3">
                        <p className="font-semibold text-gray-900">{token.guestName}</p>
                        {token.guestPhone && (
                          <p className="text-xs text-gray-400">{token.guestPhone}</p>
                        )}
                      </td>

                      {/* Service */}
                      <td className="px-4 py-3 text-gray-600">
                        <p>{token.serviceId?.name || '—'}</p>
                        {token.serviceId?.duration && (
                          <p className="text-xs text-gray-400">{token.serviceId.duration} min</p>
                        )}
                      </td>

                      {/* Status badge */}
                      <td className="px-4 py-3">
                        <Badge color={STATUS_BADGE[token.status] || 'neutral'}>
                          {token.status}
                        </Badge>
                      </td>

                      {/* Served by (admin/staff only) */}
                      {canAct && (
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {token.servedBy?.name || '—'}
                        </td>
                      )}

                      {/* Action buttons */}
                      <td className="px-4 py-3 text-right">
                        {canAct && nextStatuses.length > 0 ? (
                          <div className="flex gap-1.5 justify-end flex-wrap">
                            {nextStatuses.map((ns) => {
                              const cfg = ACTION_CONFIG[ns];
                              if (!cfg) return null;
                              return (
                                <button
                                  key={ns}
                                  disabled={isUpdating}
                                  onClick={() => handleStatusUpdate(token, ns)}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${cfg.color} disabled:opacity-50 disabled:cursor-not-allowed`}
                                >
                                  {isUpdating ? '…' : cfg.label}
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-300 italic">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageWrapper>
  );
};

export default QueueDashboardPage;

