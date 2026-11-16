import axiosInstance from './axiosInstance';

export const getAvailability = async (params) => {
  const res = await axiosInstance.get('/availability', { params });
  return res.data;
};
