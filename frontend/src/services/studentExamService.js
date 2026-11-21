import api from './api';

export const studentExamService = {
  async getStudentExams() {
    const res = await api.get('/student/exams');
    return res.data;
  },

  async getExamInstructions(examId) {
    const res = await api.get(`/student/exams/${examId}/instructions`);
    return res.data;
  },

  async startOrResumeExam(examId) {
    const res = await api.post(`/student/exams/${examId}/start`);
    return res.data;
  },

  async saveAnswer(examId, payload) {
    const res = await api.post(`/student/exams/${examId}/save-answer`, payload);
    return res.data;
  },

  async timerSync(examId) {
    const res = await api.get(`/student/exams/${examId}/timer-sync`);
    return res.data;
  },

  async syncOfflineAnswers(examId, answers) {
    const res = await api.post(`/student/exams/${examId}/sync-offline-answers`, { answers });
    return res.data;
  },

  async submitExam(examId, payload = { submission_type: 'manual' }) {
    const res = await api.post(`/student/exams/${examId}/submit`, payload);
    return res.data;
  }
};
