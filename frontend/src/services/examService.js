import api from './api';

export const examService = {
  async getExams(params = {}) {
    const res = await api.get('/exams', { params });
    return res.data;
  },

  async getExamById(id) {
    const res = await api.get(`/exams/${id}`);
    return res.data;
  },

  async createExam(payload) {
    const res = await api.post('/exams', payload);
    return res.data;
  },

  async updateExam(id, payload) {
    const res = await api.put(`/exams/${id}`, payload);
    return res.data;
  },

  async updateExamStatus(id, status) {
    const res = await api.patch(`/exams/${id}/status`, { status });
    return res.data;
  },

  async deleteExam(id) {
    const res = await api.delete(`/exams/${id}`);
    return res.data;
  }
};
