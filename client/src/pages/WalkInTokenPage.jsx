import { useState, useEffect, useCallback, useRef } from 'react';
import PageWrapper from '../components/layout/PageWrapper';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Badge from '../components/ui/Badge';
import Spinner from '../components/ui/Spinner';
import useToast from '../hooks/useToast';
import useAuth from '../hooks/useAuth';
import { getCurrentBusiness, getDefaultBusiness } from '../api/businessApi';
import { getServices } from '../api/serviceApi';
import { queueApi } from '../api/queueApi';

const WalkInTokenPage = () => {
  const { user } = useAuth();
  const toast = useToast();

  const [business, setBusiness] = useState(null);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form inputs
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [guestName, setGuestName] = useState(user?.name || '');
  const [guestPhone, setGuestPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Issued token state
  const [issuedToken, setIssuedToken] = useState(null);

  // M10: Live queue position & wait estimate for issued token (Rule R8)
  const [queuePosition, setQueuePosition] = useState(null);
  const [positionLoading, setPositionLoading] = useState(false);
  const positionIntervalRef = useRef(null);

  // Live queue list for today
  const [todayTokens, setTodayTokens] = useState([]);
  const [loadingQueue, setLoadingQueue] = useState(false);

  // Load business & services
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      let biz = null;

      // Try authenticated business first, then default public
      if (user) {
        try {
          const bizRes = await getCurrentBusiness();
          if (bizRes.success && bizRes.data) biz = bizRes.data;
        } catch {
          // fallback
        }
      }

      if (!biz) {
        const defaultBizRes = await getDefaultBusiness();
        if (defaultBizRes.success && defaultBizRes.data) {
          biz = defaultBizRes.data;
        }
      }

      if (biz) {
        setBusiness(biz);
        // Load active services
        const svcRes = await getServices(biz._id, false);
        if (svcRes.success && svcRes.data) {
          const activeOnly = svcRes.data.filter((s) => s.isActive);
          setServices(activeOnly);
          if (activeOnly.length > 0) {
            setSelectedServiceId(activeOnly[0]._id);
          }
        }

        // Load today's queue
        try {
          const qRes = await queueApi.getTodayQueue(biz._id);
          if (qRes.success && qRes.data) {
            setTodayTokens(qRes.data);
          }
        } catch {
          // Non-critical
        }
      }
    } catch (err) {
      toast.error('Failed to load business details for walk-in kiosk.');
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Update guestName if user logs in later
  useEffect(() => {
    if (user?.name && !guestName) {
      setGuestName(user.name);
    }
  }, [user, guestName]);

  const refreshTodayQueue = async (bizId) => {
    try {
      setLoadingQueue(true);
      const res = await queueApi.getTodayQueue(bizId || business?._id);
      if (res.success && res.data) {
        setTodayTokens(res.data);
      }
    } catch {
      // ignore
    } finally {
      setLoadingQueue(false);
    }
  };

  const handleGenerateToken = async (e) => {
    e.preventDefault();

    if (!selectedServiceId) {
      toast.error('Please select a service');
      return;
    }

    if (!user && (!guestName || guestName.trim().length < 2)) {
      toast.error('Please enter your name (at least 2 characters)');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        businessId: business._id,
        serviceId: selectedServiceId,
        guestName: guestName.trim(),
        guestPhone: guestPhone.trim(),
      };

      const res = await queueApi.generateToken(payload);
      if (res.success && res.data) {
        setIssuedToken(res.data);
        toast.success(`Token #${res.data.tokenNumber} issued successfully!`);
        refreshTodayQueue(business._id);
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to issue token';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setIssuedToken(null);
    setQueuePosition(null);
    // Stop position polling when resetting
    if (positionIntervalRef.current) {
      clearInterval(positionIntervalRef.current);
      positionIntervalRef.current = null;
    }
    if (!user) {
      setGuestName('');
      setGuestPhone('');
    }
  };

  // M10: Fetch live position for the issued token
  const fetchQueuePosition = useCallback(async (tokenId) => {
    if (!tokenId) return;
    try {
      setPositionLoading(true);
      const res = await queueApi.getQueuePosition(tokenId);
      if (res.success && res.data) {
        setQueuePosition(res.data);
      }
    } catch {
      // Non-critical — keep showing last known position
    } finally {
      setPositionLoading(false);
    }
  }, []);

  // Start/stop polling when a token is issued
  useEffect(() => {
    if (issuedToken?._id) {
      // Fetch immediately
      fetchQueuePosition(issuedToken._id);
      // Then poll every 15 seconds (R8: recalculate after each queue change)
      positionIntervalRef.current = setInterval(() => {
        fetchQueuePosition(issuedToken._id);
      }, 15000);
    }
    return () => {
      if (positionIntervalRef.current) {
        clearInterval(positionIntervalRef.current);
        positionIntervalRef.current = null;
      }
    };
  }, [issuedToken, fetchQueuePosition]);

  const selectedServiceObj = services.find((s) => s._id === selectedServiceId);

  if (loading) {
    return (
      <PageWrapper title="Walk-in Kiosk">
        <div className="flex flex-col items-center justify-center py-24 text-gray-500">
          <Spinner size="lg" />
          <p className="mt-4 text-sm font-medium">Initializing walk-in kiosk...</p>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper title="Walk-in Queue Kiosk">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Kiosk Header */}
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-2xl p-6 md:p-8 text-white shadow-lg">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 text-xs font-semibold uppercase tracking-wider backdrop-blur-sm mb-3">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                Self-Service Kiosk • Rule R4 Atomic Counter
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
                {business ? business.name : 'NextUp Walk-in Desk'}
              </h1>
              <p className="text-blue-100 text-sm mt-1">
                Select your service, get your sequential token, and relax while we prepare for you.
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20 text-center min-w-[140px]">
              <span className="text-xs text-blue-200 block uppercase font-medium">Date</span>
              <span className="text-lg font-bold">
                {new Intl.DateTimeFormat('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                }).format(new Date())}
              </span>
            </div>
          </div>
        </div>

        {/* Main Content: If token generated -> Show Digital Token Pass */}
        {issuedToken ? (
          <div className="max-w-xl mx-auto bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden animate-fadeIn">
            <div className="bg-gradient-to-br from-indigo-700 to-blue-600 text-white p-6 text-center relative">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-xs font-semibold tracking-wider uppercase mb-2">
                ✓ Token Confirmed
              </div>
              <p className="text-xs text-blue-200 uppercase tracking-widest font-semibold">Your Token Number</p>
              <div className="text-6xl md:text-7xl font-black my-2 tracking-tight text-white drop-shadow-sm">
                #{issuedToken.tokenNumber}
              </div>
              <p className="text-sm text-blue-100">
                Rule R4: Sequential Daily Token • {issuedToken.queueDate}
              </p>
            </div>

            <div className="p-6 md:p-8 space-y-6">
              <div className="grid grid-cols-2 gap-4 pb-6 border-b border-gray-100">
                <div>
                  <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold block">
                    Guest Name
                  </span>
                  <p className="text-base font-bold text-gray-900 mt-0.5">{issuedToken.guestName}</p>
                  {issuedToken.guestPhone && (
                    <p className="text-xs text-gray-500">{issuedToken.guestPhone}</p>
                  )}
                </div>
                <div>
                  <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold block">
                    Status
                  </span>
                  <div className="mt-1">
                    <Badge color="warning">Waiting</Badge>
                  </div>
                </div>
                <div>
                  <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold block">
                    Selected Service
                  </span>
                  <p className="text-base font-bold text-gray-900 mt-0.5">
                    {issuedToken.serviceId?.name || 'Standard Service'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {issuedToken.serviceId?.duration} mins • ${issuedToken.serviceId?.price}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold block">
                    Issued At
                  </span>
                  <p className="text-base font-bold text-gray-900 mt-0.5">
                    {new Intl.DateTimeFormat('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                    }).format(new Date(issuedToken.createdAt || Date.now()))}
                  </p>
                </div>
              </div>

              {/* M10: Live Queue Position & Wait Estimate (Rule R8 / Decision D6) */}
              <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-indigo-800 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse inline-block"></span>
                    Live Queue Tracker · Rule R8
                  </span>
                  {positionLoading && (
                    <span className="text-xs text-indigo-500 animate-pulse">Updating…</span>
                  )}
                </div>
                {queuePosition ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center bg-white rounded-lg p-3 shadow-sm border border-indigo-100">
                      <p className="text-3xl font-black text-indigo-700">
                        {queuePosition.status === 'in-service'
                          ? '🔄'
                          : queuePosition.position === 0
                          ? '✓'
                          : `#${queuePosition.position}`}
                      </p>
                      <p className="text-xs text-gray-500 mt-1 font-medium">Your Position</p>
                    </div>
                    <div className="text-center bg-white rounded-lg p-3 shadow-sm border border-indigo-100">
                      <p className="text-3xl font-black text-blue-700">
                        {queuePosition.estimatedWaitMinutes === 0
                          ? '~0'
                          : `~${queuePosition.estimatedWaitMinutes}`}
                      </p>
                      <p className="text-xs text-gray-500 mt-1 font-medium">Est. Wait (min)</p>
                    </div>
                    <div className="col-span-2 text-center text-xs text-indigo-700 mt-1">
                      {queuePosition.tokensAhead === 0
                        ? "🎉 You're next! Please approach the counter."
                        : `${queuePosition.tokensAhead} token${queuePosition.tokensAhead !== 1 ? 's' : ''} ahead · ${queuePosition.activeStaffCount} staff active`}
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-indigo-400 text-sm py-2 animate-pulse">
                    Loading your position…
                  </div>
                )}
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-900 leading-relaxed">
                <span className="font-semibold block mb-1">📢 Instructions:</span>
                Please take a seat in the lounge area. Keep this screen handy or note your token number{' '}
                <strong className="text-blue-950 font-bold">#{issuedToken.tokenNumber}</strong>. You will be
                called as soon as staff becomes available.
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button
                  variant="secondary"
                  className="flex-1 justify-center"
                  onClick={() => window.print()}
                >
                  🖨️ Print Slip
                </Button>
                <Button variant="primary" className="flex-1 justify-center" onClick={handleReset}>
                  + Issue Another Token
                </Button>
              </div>
            </div>
          </div>
        ) : (
          /* Token Generation Form + Live Queue Sidebar */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Form Column (2 spans) */}
            <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-200 p-6 md:p-8">
              <h2 className="text-xl font-bold text-gray-900 mb-1">Generate Walk-in Token</h2>
              <p className="text-sm text-gray-500 mb-6">
                Fill in your details below to receive your daily sequential queue ticket.
              </p>

              <form onSubmit={handleGenerateToken} className="space-y-6">
                {/* 1. Service Selection */}
                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-2">
                    1. Select Service <span className="text-red-500">*</span>
                  </label>
                  {services.length === 0 ? (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm">
                      No active services found for this business. Please contact the administrator.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {services.map((svc) => {
                        const isSelected = selectedServiceId === svc._id;
                        return (
                          <div
                            key={svc._id}
                            onClick={() => setSelectedServiceId(svc._id)}
                            className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                              isSelected
                                ? 'border-blue-600 bg-blue-50/60 shadow-sm'
                                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/50'
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <h3 className="font-semibold text-gray-900 text-sm">{svc.name}</h3>
                              <span
                                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                  isSelected ? 'border-blue-600 bg-blue-600' : 'border-gray-300'
                                }`}
                              >
                                {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white"></span>}
                              </span>
                            </div>
                            <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                              <span>⏱️ {svc.duration} mins</span>
                              <span className="font-bold text-gray-800">${svc.price}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 2. Guest Info */}
                <div className="pt-2 border-t border-gray-100">
                  <label className="block text-sm font-semibold text-gray-800 mb-3">
                    2. Customer Information
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Input
                        label="Full Name *"
                        name="guestName"
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                        placeholder="e.g. Sarah Connor"
                        required
                      />
                    </div>
                    <div>
                      <Input
                        label="Phone Number (Optional)"
                        name="guestPhone"
                        value={guestPhone}
                        onChange={(e) => setGuestPhone(e.target.value)}
                        placeholder="e.g. +91 98765 43210"
                      />
                    </div>
                  </div>
                  {user && (
                    <p className="mt-2 text-xs text-blue-600">
                      ℹ️ You are signed in as <strong>{user.name}</strong>. Token will be linked to your account.
                    </p>
                  )}
                </div>

                {/* Summary & Submit */}
                <div className="pt-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                  {selectedServiceObj && (
                    <div className="text-sm text-gray-600 text-left w-full sm:w-auto">
                      Selected: <strong className="text-gray-900">{selectedServiceObj.name}</strong> (
                      {selectedServiceObj.duration}m • ${selectedServiceObj.price})
                    </div>
                  )}
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    loading={submitting}
                    disabled={submitting || !business || services.length === 0}
                    className="w-full sm:w-auto px-8"
                  >
                    🎫 Issue My Token
                  </Button>
                </div>
              </form>
            </div>

            {/* Live Queue Sidebar (1 span) */}
            <div className="space-y-6">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
                  <div>
                    <h3 className="font-bold text-gray-900 text-base">Today's Queue</h3>
                    <p className="text-xs text-gray-500">Live tokens for today</p>
                  </div>
                  <button
                    onClick={() => refreshTodayQueue()}
                    disabled={loadingQueue}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
                  >
                    {loadingQueue ? 'Refreshing...' : '🔄 Refresh'}
                  </button>
                </div>

                {todayTokens.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 text-sm">
                    <p className="text-2xl mb-2">🏷️</p>
                    No tokens issued yet today.
                    <p className="text-xs text-gray-400 mt-1">Be the first in line!</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                    {todayTokens.map((t) => (
                      <div
                        key={t._id}
                        className="p-3 rounded-xl border border-gray-100 bg-gray-50/70 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-9 h-9 rounded-lg bg-blue-100 text-blue-700 font-black text-sm flex items-center justify-center">
                            #{t.tokenNumber}
                          </span>
                          <div>
                            <p className="text-sm font-semibold text-gray-900 leading-tight">
                              {t.guestName}
                            </p>
                            <p className="text-xs text-gray-500">
                              {t.serviceId?.name || 'Walk-in'}
                            </p>
                          </div>
                        </div>
                        <Badge
                          color={
                            t.status === 'in-service'
                              ? 'info'
                              : t.status === 'called'
                              ? 'warning'
                              : t.status === 'completed'
                              ? 'success'
                              : 'neutral'
                          }
                        >
                          {t.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Informational card */}
              <div className="bg-indigo-50/60 border border-indigo-100 rounded-2xl p-5 text-indigo-900 text-xs space-y-2">
                <p className="font-bold text-indigo-950 flex items-center gap-1.5">
                  <span>⚡</span> Rule R4: Daily Sequence Guarantee
                </p>
                <p className="leading-relaxed text-indigo-800">
                  Walk-in tokens start from #1 every morning for each business and advance sequentially.
                  Concurrency is guarded by atomic database counters.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageWrapper>
  );
};

export default WalkInTokenPage;
