import api from './api';

export const analyticsService = {
  getExamItemAnalysis: async (examId) => {
    const response = await api.get(`/analytics/exam/${examId}/item-analysis`);
    return response.data;
  },

  getExamCohortAnalytics: async (examId) => {
    const response = await api.get(`/analytics/exam/${examId}/cohort`);
    return response.data;
  }
};

export default analyticsService;
