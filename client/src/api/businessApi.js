import axiosInstance from './axiosInstance';

export const getCurrentBusiness = async () => {
  const res = await axiosInstance.get('/business');
  return res.data;
};

export const getDefaultBusiness = async () => {
  const res = await axiosInstance.get('/business/default');
  return res.data;
};

export const getBusinessById = async (id) => {
  const res = await axiosInstance.get(`/business/${id}`);
  return res.data;
};

export const createBusiness = async (data) => {
  const res = await axiosInstance.post('/business', data);
  return res.data;
};

export const updateBusiness = async (id, data) => {
  const res = await axiosInstance.put(`/business/${id}`, data);
  return res.data;
};
