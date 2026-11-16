import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '../context/AuthContext';

import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';
import ProtectedRoute from './ProtectedRoute';

import Home from '../pages/Home';
import LoginPage from '../pages/LoginPage';
import RegisterPage from '../pages/RegisterPage';
import Dashboard from '../pages/Dashboard';
import BusinessProfilePage from '../pages/BusinessProfilePage';
import ServicesPage from '../pages/ServicesPage';
import StaffPage from '../pages/StaffPage';
import BookAppointmentPage from '../pages/BookAppointmentPage';
import AppointmentsPage from '../pages/AppointmentsPage';
import WalkInTokenPage from '../pages/WalkInTokenPage';
import NotFound from '../pages/NotFound';
import Forbidden from '../pages/Forbidden';

const AppRouter = () => (
  <BrowserRouter>
    <AuthProvider>
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/403" element={<Forbidden />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/book"
              element={
                <ProtectedRoute>
                  <BookAppointmentPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/appointments"
              element={
                <ProtectedRoute>
                  <AppointmentsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/business/profile"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <BusinessProfilePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/services"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <ServicesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/staff"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <StaffPage />
                </ProtectedRoute>
              }
            />
            <Route path="/walk-in" element={<WalkInTokenPage />} />
            <Route path="/kiosk" element={<WalkInTokenPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
        <Footer />
      </div>
      <Toaster position="top-right" />
    </AuthProvider>
  </BrowserRouter>
);

export default AppRouter;
