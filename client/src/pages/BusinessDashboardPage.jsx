import { useState, useEffect, useCallback } from 'react';
import PageWrapper from '../components/layout/PageWrapper';
import Spinner from '../components/ui/Spinner';
import useToast from '../hooks/useToast';
import useAuth from '../hooks/useAuth';
import { getBusinessDashboard } from '../api/businessApi';

// ── Helper: Format currency ────────────────────────────────────────────────
const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

// ── Summary Card ──────────────────────────────────────────────────────────
const SummaryCard = ({ icon, label, value, subLabel, color = 'blue' }) => {
  const colorMap = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    green: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    red: 'bg-red-50 border-red-200 text-red-700',
    indigo: 'bg-indigo-50 border-indigo-200 text-indigo-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
  };
  const cls = colorMap[color] || colorMap.blue;
  return (
    <div className={`rounded-xl border p-5 flex flex-col gap-2 ${cls}`}>
      <div className="flex items-center justify-between">
        <span className="text-2xl">{icon}</span>
        <span className="text-3xl font-black">{value}</span>
      </div>
      <div>
        <p className="font-semibold text-sm">{label}</p>
        {subLabel && <p className="text-xs opacity-70 mt-0.5">{subLabel}</p>}
      </div>
    </div>
  );
};

// ── Stat Row (for breakdown table) ───────────────────────────────────────
const StatRow = ({ label, value, highlight = false }) => (
  <div className={`flex justify-between items-center py-2 border-b border-gray-100 last:border-0 ${highlight ? 'font-bold text-gray-900' : 'text-gray-600'}`}>
    <span className="text-sm">{label}</span>
    <span className={`text-sm font-semibold ${highlight ? 'text-gray-900' : 'text-gray-800'}`}>{value}</span>
  </div>
);

// ── Main Page ────────────────────────────────────────────────────────────
const BusinessDashboardPage = () => {
  const { user } = useAuth();
  const toast = useToast();

  const today = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(today);
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadDashboard = useCallback(async (date) => {
    try {
      setLoading(true);
      setError(null);
      const res = await getBusinessDashboard(date);
      if (res.success && res.data) {
        setDashboardData(res.data);
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to load dashboard data';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadDashboard(selectedDate);
  }, [selectedDate, loadDashboard]);

  const handleDateChange = (e) => {
    setSelectedDate(e.target.value);
  };

  if (loading) {
    return (
      <PageWrapper title="Business Dashboard">
        <div className="flex flex-col items-center justify-center py-24 text-gray-500">
          <Spinner size="lg" />
          <p className="mt-4 text-sm font-medium">Loading dashboard data…</p>
        </div>
      </PageWrapper>
    );
  }

  if (error && !dashboardData) {
    return (
      <PageWrapper title="Business Dashboard">
        <div className="text-center py-24 text-red-500">
          <p className="text-4xl mb-4">⚠️</p>
          <p className="font-semibold">{error}</p>
        </div>
      </PageWrapper>
    );
  }

  const { summary, appointments, queue, topServices, date } = dashboardData || {};
  const isToday = date === today;

  return (
    <PageWrapper title="Business Dashboard">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* ── Header ── */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-6 md:p-8 text-white shadow-lg">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 text-xs font-semibold uppercase tracking-wider backdrop-blur-sm mb-3">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                M11 — Business Intelligence Dashboard
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
                {user?.businessId ? 'Business Dashboard' : 'Business Overview'}
              </h1>
              <p className="text-indigo-100 text-sm mt-1">
                {isToday ? "Today's live metrics" : `Metrics for ${date}`} · aggregated across appointments &amp; queue
              </p>
            </div>
            {/* Date Picker */}
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/20">
              <label className="text-xs text-indigo-200 block font-medium mb-1">Select Date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={handleDateChange}
                max={today}
                className="bg-white/20 text-white rounded-lg px-3 py-1.5 text-sm border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50"
              />
            </div>
          </div>
        </div>

        {/* ── Top Summary Cards ── */}
        <div>
          <h2 className="text-base font-bold text-gray-700 uppercase tracking-wider mb-4">At a Glance</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <SummaryCard
              icon="📅"
              label="Total Appointments"
              value={summary?.totalAppointments ?? 0}
              color="blue"
            />
            <SummaryCard
              icon="✅"
              label="Completed Appts"
              value={summary?.completedAppointments ?? 0}
              color="green"
            />
            <SummaryCard
              icon="⏳"
              label="Scheduled"
              value={summary?.scheduledAppointments ?? 0}
              color="amber"
            />
            <SummaryCard
              icon="🎫"
              label="Queue Tokens"
              value={summary?.totalQueueTokens ?? 0}
              color="indigo"
            />
            <SummaryCard
              icon="🔄"
              label="Active in Queue"
              value={summary?.activeQueueCount ?? 0}
              subLabel={`${summary?.waitingInQueue ?? 0} waiting`}
              color="purple"
            />
            <SummaryCard
              icon="💰"
              label="Est. Revenue"
              value={formatCurrency(summary?.estimatedRevenue ?? 0)}
              subLabel="from completed"
              color="green"
            />
          </div>
        </div>

        {/* ── Breakdown: Appointments + Queue ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Appointments Breakdown */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <h3 className="font-bold text-gray-900 text-base mb-4 flex items-center gap-2">
              <span>📅</span> Appointments Breakdown
            </h3>
            <StatRow label="Total" value={appointments?.total ?? 0} highlight />
            <StatRow label="✅ Completed" value={appointments?.completed ?? 0} />
            <StatRow label="📌 Scheduled (upcoming)" value={appointments?.scheduled ?? 0} />
            <StatRow label="❌ Cancelled" value={appointments?.cancelled ?? 0} />
            <StatRow label="🚫 No-show" value={appointments?.noShow ?? 0} />
          </div>

          {/* Queue Breakdown */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <h3 className="font-bold text-gray-900 text-base mb-4 flex items-center gap-2">
              <span>🎫</span> Walk-in Queue Breakdown
            </h3>
            <StatRow label="Total tokens issued" value={queue?.total ?? 0} highlight />
            <StatRow label="⏳ Waiting" value={queue?.waiting ?? 0} />
            <StatRow label="📢 Called" value={queue?.called ?? 0} />
            <StatRow label="🔄 In-service" value={queue?.inService ?? 0} />
            <StatRow label="✅ Completed" value={queue?.completed ?? 0} />
            <StatRow label="❌ Cancelled" value={queue?.cancelled ?? 0} />
            <StatRow label="🚫 No-show" value={queue?.noShow ?? 0} />
          </div>
        </div>

        {/* ── Top Services ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h3 className="font-bold text-gray-900 text-base mb-4 flex items-center gap-2">
            <span>⭐</span> Top Services Today (by appointment count)
          </h3>
          {!topServices || topServices.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <p className="text-3xl mb-2">📊</p>
              <p className="text-sm">No appointment data for this date.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {topServices.map((svc, idx) => {
                const maxCount = topServices[0]?.count || 1;
                const pct = Math.round((svc.count / maxCount) * 100);
                return (
                  <div key={svc.serviceId || idx}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-gray-800">
                        #{idx + 1} {svc.name}
                      </span>
                      <span className="text-gray-500 font-semibold">{svc.count} appts</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-indigo-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Empty State Note ── */}
        {summary?.totalAppointments === 0 && summary?.totalQueueTokens === 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 text-blue-800 text-sm text-center">
            <p className="font-semibold mb-1">📭 No activity recorded for {isToday ? 'today' : date}</p>
            <p className="text-blue-600">Summary cards will populate as appointments are booked and tokens are issued.</p>
          </div>
        )}

      </div>
    </PageWrapper>
  );
};

export default BusinessDashboardPage;

