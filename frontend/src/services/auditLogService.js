import api from './api';

export const auditLogService = {
  getAuditLogs: async (params = {}) => {
    const response = await api.get('/audit-logs', { params });
    return response.data;
  },

  getAuditActions: async () => {
    const response = await api.get('/audit-logs/actions');
    return response.data;
  }
};

export default auditLogService;
