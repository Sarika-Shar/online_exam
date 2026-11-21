import api from './api';

export const questionService = {
  async getQuestions(params = {}) {
    const res = await api.get('/questions', { params });
    return res.data;
  },

  async getQuestionStats(subjectId = null) {
    const params = subjectId ? { subject_id: subjectId } : {};
    const res = await api.get('/questions/stats', { params });
    return res.data;
  },

  async getTopics(subjectId = null) {
    const params = subjectId ? { subject_id: subjectId } : {};
    const res = await api.get('/questions/topics', { params });
    return res.data;
  },

  async getQuestionById(id) {
    const res = await api.get(`/questions/${id}`);
    return res.data;
  },

  async createQuestion(payload) {
    const res = await api.post('/questions', payload);
    return res.data;
  },

  async updateQuestion(id, payload) {
    const res = await api.put(`/questions/${id}`, payload);
    return res.data;
  },

  async deleteQuestion(id) {
    const res = await api.delete(`/questions/${id}`);
    return res.data;
  },

  async bulkDeleteQuestions(questionIds) {
    const res = await api.post('/questions/bulk-delete', { question_ids: questionIds });
    return res.data;
  }
};
