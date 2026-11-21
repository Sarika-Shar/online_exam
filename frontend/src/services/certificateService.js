import api from './api';

export const certificateService = {
  // Generate certificates in bulk for an exam
  async generateCertificates(examId, payload = {}) {
    const res = await api.post(`/certificates/generate/${examId}`, payload);
    return res.data;
  },

  // List certificates with pagination and filters
  async getCertificates(params = {}) {
    const res = await api.get('/certificates', { params });
    return res.data;
  },

  // Download Certificate PDF
  async downloadCertificate(certificateUuid, studentName = 'Certificate') {
    const res = await api.get(`/certificates/download/${certificateUuid}`, {
      responseType: 'blob'
    });
    const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${studentName}_Certificate_${certificateUuid}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.parentNode.removeChild(link);
    window.URL.revokeObjectURL(url);
  },

  // Verify certificate by UUID
  async verifyCertificate(certificateUuid) {
    const res = await api.get(`/certificates/verify/${certificateUuid}`);
    return res.data;
  },

  // Candidate's own certificates
  async getMyCertificates() {
    const res = await api.get('/certificates/my-certificates');
    return res.data;
  }
};
