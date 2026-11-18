import api from './axiosInstance';

export const queueApi = {
  // M8: Generate walk-in token (Rule R4)
  generateToken: async (data) => {
    const res = await api.post('/queue/tokens', data);
    return res.data;
  },

  // M8: Get single token details
  getTokenById: async (id) => {
    const res = await api.get(`/queue/tokens/${id}`);
    return res.data;
  },

  // M8: Get today's queue for a business
  getTodayQueue: async (businessId, status) => {
    const params = { businessId };
    if (status) params.status = status;
    const res = await api.get('/queue/today', { params });
    return res.data;
  },

  // M9: Update token status (Rule R5)
  updateTokenStatus: async (tokenId, status) => {
    const res = await api.patch(`/queue/tokens/${tokenId}/status`, { status });
    return res.data;
  },

  // M9: Get queue dashboard for a business (admin/staff)
  getQueueDashboard: async (businessId, date) => {
    const params = { businessId };
    if (date) params.date = date;
    const res = await api.get('/queue/dashboard', { params });
    return res.data;
  },
};

export default queueApi;
