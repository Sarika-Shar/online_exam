import api from './api';

export const studentService = {
  getStudents: async (params = {}) => {
    const response = await api.get('/students', { params });
    return response.data;
  },

  createStudent: async (studentData) => {
    const response = await api.post('/students', studentData);
    return response.data;
  },

  bulkImportStudents: async (payload, isFormData = false) => {
    const config = isFormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : {};
    const response = await api.post('/students/bulk-import', payload, config);
    return response.data;
  },

  downloadTemplate: async () => {
    const response = await api.get('/students/import-template', {
      responseType: 'blob'
    });
    return response.data;
  },

  toggleStudentStatus: async (studentId) => {
    const response = await api.put(`/students/${studentId}/toggle-status`);
    return response.data;
  },

  exportStudentsUrl: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return `/api/students/export${query ? `?${query}` : ''}`;
  }
};

export default studentService;
