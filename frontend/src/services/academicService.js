import api from './api';

export const academicService = {
  // --- Classes ---
  async getClasses() {
    const res = await api.get('/academic/classes');
    return res.data;
  },

  async createClass(classData) {
    const res = await api.post('/academic/classes', classData);
    return res.data;
  },

  async updateClass(id, classData) {
    const res = await api.put(`/academic/classes/${id}`, classData);
    return res.data;
  },

  async deleteClass(id) {
    const res = await api.delete(`/academic/classes/${id}`);
    return res.data;
  },

  async toggleClassStatus(id) {
    const res = await api.patch(`/academic/classes/${id}/toggle-status`);
    return res.data;
  },

  // --- Batches ---
  async getBatches(classId = null) {
    const params = classId ? { class_id: classId } : {};
    const res = await api.get('/academic/batches', { params });
    return res.data;
  },

  async createBatch(batchData) {
    const res = await api.post('/academic/batches', batchData);
    return res.data;
  },

  async updateBatch(id, batchData) {
    const res = await api.put(`/academic/batches/${id}`, batchData);
    return res.data;
  },

  async deleteBatch(id) {
    const res = await api.delete(`/academic/batches/${id}`);
    return res.data;
  },

  async toggleBatchStatus(id) {
    const res = await api.patch(`/academic/batches/${id}/toggle-status`);
    return res.data;
  },

  // --- Subjects ---
  async getSubjects(classId = null) {
    const params = classId ? { class_id: classId } : {};
    const res = await api.get('/academic/subjects', { params });
    return res.data;
  },

  async createSubject(subjectData) {
    const res = await api.post('/academic/subjects', subjectData);
    return res.data;
  },

  async updateSubject(id, subjectData) {
    const res = await api.put(`/academic/subjects/${id}`, subjectData);
    return res.data;
  },

  async deleteSubject(id) {
    const res = await api.delete(`/academic/subjects/${id}`);
    return res.data;
  },

  async toggleSubjectStatus(id) {
    const res = await api.patch(`/academic/subjects/${id}/toggle-status`);
    return res.data;
  },

  // --- Question Banks ---
  async getQuestionBanks(subjectId = null) {
    const params = subjectId ? { subject_id: subjectId } : {};
    const res = await api.get('/academic/question-banks', { params });
    return res.data;
  }
};

export default academicService;
