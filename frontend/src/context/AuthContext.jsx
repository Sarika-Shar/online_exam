import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/authService';

const AuthContext = createContext(null);

const normalizeUserData = (userData) => {
  if (!userData) return null;
  const normalized = { ...userData };
  if (normalized.institution && normalized.institution.name && normalized.institution.name.includes('Apex International University')) {
    normalized.institution = {
      ...normalized.institution,
      name: 'Our International University'
    };
  }
  return normalized;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? normalizeUserData(JSON.parse(savedUser)) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('token') || null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('token');
      if (storedToken) {
        try {
          const res = await authService.getMe();
          if (res.success && res.user) {
            const normalizedUser = normalizeUserData(res.user);
            setUser(normalizedUser);
            localStorage.setItem('user', JSON.stringify(normalizedUser));
          }
        } catch (err) {
          console.warn('Failed to verify token on app launch:', err.message);
          logout();
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (usernameOrEmail, password) => {
    const res = await authService.login(usernameOrEmail, password);
    if (res.success) {
      const normalizedUser = normalizeUserData(res.user);
      setToken(res.token);
      setUser(normalizedUser);
      localStorage.setItem('token', res.token);
      localStorage.setItem('user', JSON.stringify(normalizedUser));
    }
    return res;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  const hasRole = (roles) => {
    if (!user) return false;
    if (Array.isArray(roles)) {
      return roles.includes(user.role);
    }
    return user.role === roles;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        logout,
        hasRole,
        isAuthenticated: !!token && !!user
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
