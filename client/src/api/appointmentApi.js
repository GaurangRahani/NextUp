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

export const cancelAppointment = async (id, reason = '') => {
  const res = await axiosInstance.patch(`/appointments/${id}/cancel`, { reason });
  return res.data;
};

export const rescheduleAppointment = async (id, { date, startTime }) => {
  const res = await axiosInstance.patch(`/appointments/${id}/reschedule`, {
    date,
    startTime,
  });
  return res.data;
};

export const updateAppointmentStatus = async (id, status) => {
  const res = await axiosInstance.patch(`/appointments/${id}/status`, { status });
  return res.data;
};
