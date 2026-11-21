import api from './api';

export const pdfUploadService = {
  async uploadAndExtract(formData, onUploadProgress) {
    const res = await api.post('/pdf-upload/extract', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      onUploadProgress
    });
    return res.data;
  },

  async approveAndSaveQuestions(payload) {
    const res = await api.post('/pdf-upload/approve', payload);
    return res.data;
  },

  async getUploadHistory() {
    const res = await api.get('/pdf-upload/history');
    return res.data;
  }
};
