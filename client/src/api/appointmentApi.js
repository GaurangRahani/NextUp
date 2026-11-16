import axiosInstance from './axiosInstance';

export const bookAppointment = async (data) => {
  const res = await axiosInstance.post('/appointments', data);
  return res.data;
};

export const getAppointments = async (params = {}) => {
  const res = await axiosInstance.get('/appointments', { params });
  return res.data;
};

export const getAppointmentById = async (id) => {
  const res = await axiosInstance.get(`/appointments/${id}`);
  return res.data;
};
