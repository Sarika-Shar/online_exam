import api from './api';

export const resultService = {
  // Admin & Teachers: List results with filters and pagination
  async getResults(params = {}) {
    const res = await api.get('/results', { params });
    return res.data;
  },

  // Exam Leaderboard & Podium
  async getExamLeaderboard(examId) {
    const res = await api.get(`/results/exam/${examId}`);
    return res.data;
  },

  // Toggle Publish / Hide Results
  async togglePublishResults(examId, results_published) {
    const res = await api.patch(`/results/exam/${examId}/publish`, { results_published });
    return res.data;
  },

  // Manually Recalculate Ranks
  async recalculateRanks(examId) {
    const res = await api.post(`/results/exam/${examId}/recalculate-ranks`);
    return res.data;
  },

  // Detailed Individual Scorecard (Question Breakdown)
  async getIndividualScorecard(resultId) {
    const res = await api.get(`/results/${resultId}/scorecard`);
    return res.data;
  },

  // Download Results CSV
  async downloadResultsCsv(examId, filename = 'Exam_Results.csv') {
    const res = await api.get(`/results/exam/${examId}/export`, {
      responseType: 'blob'
    });
    const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.parentNode.removeChild(link);
    window.URL.revokeObjectURL(url);
  },

  // Student Portal: My Results History
  async getMyResults() {
    const res = await api.get('/results/my-results');
    return res.data;
  }
};
