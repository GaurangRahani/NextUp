import axiosInstance from './axiosInstance';

export const getServices = async (businessId, includeInactive = false) => {
  const params = {};
  if (businessId) params.businessId = businessId;
  if (includeInactive) params.includeInactive = 'true';

  const res = await axiosInstance.get('/services', { params });
  return res.data;
};

export const getServiceById = async (id) => {
  const res = await axiosInstance.get(`/services/${id}`);
  return res.data;
};

export const createService = async (data) => {
  const res = await axiosInstance.post('/services', data);
  return res.data;
};

export const updateService = async (id, data) => {
  const res = await axiosInstance.put(`/services/${id}`, data);
  return res.data;
};

export const deleteService = async (id) => {
  const res = await axiosInstance.delete(`/services/${id}`);
  return res.data;
};
