import api from './api';

export const authService = {
  async login(usernameOrEmail, password) {
    const response = await api.post('/auth/login', { usernameOrEmail, password });
    return response.data;
  },

  async getMe() {
    const response = await api.get('/auth/me');
    return response.data;
  },

  async changePassword(currentPassword, newPassword) {
    const response = await api.post('/auth/change-password', {
      currentPassword,
      newPassword
    });
    return response.data;
  }
};
