import api from './api';

export const winnerService = {
  // Get Top 3 winners and podium data for an exam
  async getWinners(examId) {
    const res = await api.get(`/winners/exam/${examId}`);
    return res.data;
  },

  // Recalculate Top 3 winners
  async calculateWinners(examId) {
    const res = await api.post(`/winners/exam/${examId}/calculate`);
    return res.data;
  },

  // Update cash prizes and titles
  async updatePrizes(examId, prizes) {
    const res = await api.put(`/winners/exam/${examId}/prizes`, { prizes });
    return res.data;
  },

  // Officially trigger live announcement
  async announceWinners(examId) {
    const res = await api.post(`/winners/exam/${examId}/announce`);
    return res.data;
  },

  // Get historical winners across all exams
  async getWinnerHistory() {
    const res = await api.get('/winners/history');
    return res.data;
  }
};
