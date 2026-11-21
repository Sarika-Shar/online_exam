import api from './api';

export const challengeService = {
  submitChallenge: async (payload) => {
    const response = await api.post('/challenges/submit', payload);
    return response.data;
  },

  getMyChallenges: async (params = {}) => {
    const response = await api.get('/challenges/my-challenges', { params });
    return response.data;
  },

  getExamChallenges: async (examId, params = {}) => {
    const response = await api.get(`/challenges/exam/${examId}`, { params });
    return response.data;
  },

  resolveQuestionChallenges: async (examId, questionId, payload) => {
    const response = await api.post(`/challenges/exam/${examId}/resolve-question/${questionId}`, payload);
    return response.data;
  }
};

export default challengeService;
