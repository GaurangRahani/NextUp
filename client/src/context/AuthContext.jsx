import { createContext, useState, useEffect, useCallback } from 'react';
import axiosInstance from '../api/axiosInstance';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('nextup_token');
    localStorage.removeItem('nextup_user');
  }, []);

  // Check auth and rehydrate on mount
  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('nextup_token');
      const storedUser = localStorage.getItem('nextup_user');

      if (storedToken) {
        try {
          setToken(storedToken);
          if (storedUser) {
            setUser(JSON.parse(storedUser));
          }
          // Verify with backend
          const res = await axiosInstance.get('/auth/me');
          if (res.data?.success && res.data?.data) {
            setUser(res.data.data);
            localStorage.setItem('nextup_user', JSON.stringify(res.data.data));
          }
        } catch (err) {
          console.error('Session expired or invalid:', err);
          logout();
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, [logout]);

  const login = useCallback(async (email, password) => {
    const res = await axiosInstance.post('/auth/login', { email, password });
    if (res.data?.success && res.data?.data) {
      const { user: userData, token: jwtToken } = res.data.data;
      setUser(userData);
      setToken(jwtToken);
      localStorage.setItem('nextup_token', jwtToken);
      localStorage.setItem('nextup_user', JSON.stringify(userData));
      return { success: true, user: userData };
    }
    return { success: false, message: res.data?.message || 'Login failed' };
  }, []);

  const register = useCallback(async (userData) => {
    const res = await axiosInstance.post('/auth/register', userData);
    if (res.data?.success && res.data?.data) {
      const { user: newUser, token: jwtToken } = res.data.data;
      setUser(newUser);
      setToken(jwtToken);
      localStorage.setItem('nextup_token', jwtToken);
      localStorage.setItem('nextup_user', JSON.stringify(newUser));
      return { success: true, user: newUser };
    }
    return { success: false, message: res.data?.message || 'Registration failed' };
  }, []);

  const value = {
    user,
    token,
    isLoading,
    isAuthenticated: !!token,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
