import api from './api';

export const proctorService = {
  uploadSnapshot: async (data) => {
    const response = await api.post('/proctor/snapshot', data);
    return response.data;
  },

  getAttemptEvidence: async (attemptId) => {
    const response = await api.get(`/proctor/attempt/${attemptId}/evidence`);
    return response.data;
  },

  submitProctorVerdict: async (attemptId, payload) => {
    const response = await api.post(`/proctor/attempt/${attemptId}/verdict`, payload);
    return response.data;
  },

  getExamIntegrityOverview: async (examId) => {
    const response = await api.get(`/proctor/exam/${examId}/integrity-overview`);
    return response.data;
  }
};

export default proctorService;
