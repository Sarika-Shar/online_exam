import api from './api';

export const liveMonitorService = {
  getLiveExamStatus: async (examId) => {
    const response = await api.get(`/live-monitor/exam/${examId}`);
    return response.data;
  },

  extendCandidateTime: async (attemptId, payload) => {
    const response = await api.post(`/live-monitor/attempt/${attemptId}/extend-time`, payload);
    return response.data;
  },

  pauseCandidateAttempt: async (attemptId, payload = {}) => {
    const response = await api.post(`/live-monitor/attempt/${attemptId}/pause`, payload);
    return response.data;
  },

  resumeCandidateAttempt: async (attemptId, payload = {}) => {
    const response = await api.post(`/live-monitor/attempt/${attemptId}/resume`, payload);
    return response.data;
  },

  sendCandidateWarning: async (attemptId, payload) => {
    const response = await api.post(`/live-monitor/attempt/${attemptId}/warning`, payload);
    return response.data;
  },

  forceSubmitAttempt: async (attemptId, payload = {}) => {
    const response = await api.post(`/live-monitor/attempt/${attemptId}/force-submit`, payload);
    return response.data;
  },

  broadcastExamAnnouncement: async (examId, payload) => {
    const response = await api.post(`/live-monitor/exam/${examId}/broadcast`, payload);
    return response.data;
  }
};

export default liveMonitorService;
