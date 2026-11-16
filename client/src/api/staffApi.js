import axiosInstance from './axiosInstance';

export const getStaff = async (businessId, serviceId, includeInactive = false) => {
  const params = {};
  if (businessId) params.businessId = businessId;
  if (serviceId) params.serviceId = serviceId;
  if (includeInactive) params.includeInactive = 'true';

  const res = await axiosInstance.get('/staff', { params });
  return res.data;
};

export const getStaffById = async (id) => {
  const res = await axiosInstance.get(`/staff/${id}`);
  return res.data;
};

export const createStaff = async (data) => {
  const res = await axiosInstance.post('/staff', data);
  return res.data;
};

export const updateStaff = async (id, data) => {
  const res = await axiosInstance.put(`/staff/${id}`, data);
  return res.data;
};

export const assignStaffServices = async (id, serviceIds) => {
  const res = await axiosInstance.put(`/staff/${id}/services`, { serviceIds });
  return res.data;
};

export const deactivateStaff = async (id) => {
  const res = await axiosInstance.delete(`/staff/${id}`);
  return res.data;
};
