import api from './axiosInstance';

export const queueApi = {
  // Generate walk-in token (Rule R4)
  generateToken: async (data) => {
    const res = await api.post('/queue/tokens', data);
    return res.data;
  },

  // Get single token details
  getTokenById: async (id) => {
    const res = await api.get(`/queue/tokens/${id}`);
    return res.data;
  },

  // Get today's queue for a business
  getTodayQueue: async (businessId, status) => {
    const params = { businessId };
    if (status) params.status = status;
    const res = await api.get('/queue/today', { params });
    return res.data;
  },
};

export default queueApi;
