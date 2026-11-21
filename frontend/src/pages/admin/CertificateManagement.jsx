import React, { useState, useEffect } from 'react';
import { certificateService } from '../../services/certificateService';
import { examService } from '../../services/examService';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const CertificateManagement = () => {
  const [exams, setExams] = useState([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [certificates, setCertificates] = useState([]);
  const [totalCount, setTotalCount] = useState(0);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Generate Modal State
  const [showGenModal, setShowGenModal] = useState(false);
  const [sigName, setSigName] = useState('Controller of Examinations');
  const [onlyPassed, setOnlyPassed] = useState(true);

  // Verification Modal State
  const [verifyUuid, setVerifyUuid] = useState('');
  const [verifyResult, setVerifyResult] = useState(null);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);

  useEffect(() => {
    loadExams();
  }, []);

  useEffect(() => {
    if (selectedExamId) {
      loadCertificates(selectedExamId);
    }
  }, [selectedExamId]);

  const loadExams = async () => {
    try {
      setLoading(true);
      const res = await examService.getExams({ limit: 100 });
      if (res.success && res.exams.length > 0) {
        setExams(res.exams);
        setSelectedExamId(res.exams[0].id.toString());
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load examinations registry.');
    } finally {
      setLoading(false);
    }
  };

  const loadCertificates = async (examId) => {
    try {
      setLoading(true);
      setError(null);
      const res = await certificateService.getCertificates({ exam_id: examId, limit: 100 });
      if (res.success) {
        setCertificates(res.certificates);
        setTotalCount(res.total);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to retrieve issued certificates.');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!selectedExamId) return;

    try {
      setActionLoading(true);
      const res = await certificateService.generateCertificates(selectedExamId, {
        only_passed: onlyPassed,
        signature: sigName
      });
      if (res.success) {
        setSuccessMsg(res.message);
        setShowGenModal(false);
        setTimeout(() => setSuccessMsg(null), 5000);
        await loadCertificates(selectedExamId);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to generate certificates.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownload = async (uuid, studentName) => {
    try {
      await certificateService.downloadCertificate(uuid, studentName || 'Candidate');
    } catch (err) {
      alert('Unable to download certificate file. Please verify network.');
    }
  };

  const handleVerify = async (e) => {
    e?.preventDefault();
    if (!verifyUuid.trim()) return;

    try {
      setVerifyLoading(true);
      setVerifyResult(null);
      const res = await certificateService.verifyCertificate(verifyUuid.trim());
      setVerifyResult(res);
    } catch (err) {
      setVerifyResult({
        verified: false,
        message: err.response?.data?.message || 'Certificate verification failed.'
      });
    } finally {
      setVerifyLoading(false);
    }
  };

  return (
    <div className="container-fluid py-4 px-3 px-md-4">
      {/* HEADER */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
        <div>
          <h2 className="fw-bold text-dark mb-1">
            <i className="bi bi-patch-check-fill text-primary me-2"></i> Automated PDF Certificate Engine
          </h2>
          <p className="text-secondary small mb-0">
            Vector landscape PDF certificates generated with institutional seals, verified UUIDs, and authorized signatures.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="d-flex flex-wrap align-items-center gap-2">
          <button
            className="btn btn-outline-secondary btn-sm shadow-sm d-flex align-items-center gap-1"
            onClick={() => {
              setVerifyUuid('');
              setVerifyResult(null);
              setShowVerifyModal(true);
            }}
          >
            <i className="bi bi-shield-check text-success"></i>
            <span>Verify Certificate UUID</span>
          </button>

          <button
            className="btn btn-primary btn-sm shadow-sm fw-bold d-flex align-items-center gap-2"
            onClick={() => setShowGenModal(true)}
            disabled={!selectedExamId}
          >
            <i className="bi bi-magic"></i>
            <span>Generate Certificates in Bulk</span>
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="alert alert-success alert-dismissible fade show shadow-sm mb-4" role="alert">
          <i className="bi bi-check-circle-fill me-2"></i> {successMsg}
          <button type="button" className="btn-close" onClick={() => setSuccessMsg(null)}></button>
        </div>
      )}

      {error && (
        <div className="alert alert-danger shadow-sm mb-4" role="alert">
          <i className="bi bi-exclamation-triangle-fill me-2"></i> {error}
        </div>
      )}

      {/* EXAM SELECTOR BAR */}
      <div className="card-custom bg-white p-3 mb-4 shadow-sm border">
        <div className="row g-3 align-items-center">
          <div className="col-12 col-md-5">
            <label className="form-label small fw-bold text-muted mb-1">Select Examination</label>
            <select
              className="form-select form-select-sm fw-semibold text-dark"
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
            >
              {exams.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.title} ({ex.exam_date})
                </option>
              ))}
            </select>
          </div>

          <div className="col-12 col-md-7 d-flex flex-wrap align-items-center justify-content-md-end gap-3 pt-2 pt-md-0">
            <div className="text-muted small">
              Issued Certificates: <strong className="text-dark fs-6">{totalCount}</strong>
            </div>
            <div className="text-muted small">
              Standard: <span className="badge bg-light text-secondary border">A4 Landscape Vector PDF</span>
            </div>
          </div>
        </div>
      </div>

      {/* CERTIFICATES TABLE */}
      {loading ? (
        <div className="py-5">
          <LoadingSpinner message="Retrieving certificates directory..." />
        </div>
      ) : certificates.length === 0 ? (
        <div className="card-custom bg-white p-5 text-center text-muted shadow-sm border">
          <i className="bi bi-patch-question fs-1 text-secondary opacity-50 d-block mb-3"></i>
          <h5 className="fw-bold text-dark">No Certificates Issued Yet</h5>
          <p className="text-secondary small mb-3">
            Click "Generate Certificates in Bulk" to issue official PDF certificates for all passing candidates of this exam.
          </p>
          <button className="btn btn-primary btn-sm fw-semibold" onClick={() => setShowGenModal(true)}>
            <i className="bi bi-magic me-1"></i> Generate Now
          </button>
        </div>
      ) : (
        <div className="card-custom bg-white p-3 shadow-sm border">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light text-muted small text-uppercase">
                <tr>
                  <th>Certificate Identifier</th>
                  <th>Candidate</th>
                  <th>Academic Program</th>
                  <th className="text-center">Rank</th>
                  <th className="text-center">Score & %</th>
                  <th className="text-center">Issue Date</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {certificates.map((cert) => (
                  <tr key={cert.id}>
                    {/* UUID */}
                    <td>
                      <div className="d-flex align-items-center gap-1">
                        <code className="text-primary fw-bold small">{cert.certificate_uuid}</code>
                        <button
                          className="btn btn-link btn-sm p-0 text-muted ms-1"
                          onClick={() => {
                            navigator.clipboard.writeText(cert.certificate_uuid);
                            alert(`Copied UUID: ${cert.certificate_uuid}`);
                          }}
                          title="Copy UUID"
                        >
                          <i className="bi bi-clipboard"></i>
                        </button>
                      </div>
                    </td>

                    {/* Candidate */}
                    <td>
                      <div className="fw-bold text-dark">{cert.student?.user?.name}</div>
                      <div className="text-muted small" style={{ fontSize: '0.72rem' }}>
                        ID: {cert.student?.student_id}
                      </div>
                    </td>

                    {/* Class */}
                    <td>
                      <span className="small text-secondary">{cert.student?.class?.name || 'General Program'}</span>
                    </td>

                    {/* Rank */}
                    <td className="text-center">
                      <span className="badge bg-light text-dark border fw-bold">
                        {cert.rank ? `#${cert.rank}` : 'Top Tier'}
                      </span>
                    </td>

                    {/* Score */}
                    <td className="text-center">
                      <div className="fw-bold text-dark small">{cert.marks_obtained} / {cert.total_marks}</div>
                      <span className="text-muted small" style={{ fontSize: '0.72rem' }}>{cert.percentage}%</span>
                    </td>

                    {/* Issue Date */}
                    <td className="text-center text-muted small">{cert.issue_date}</td>

                    {/* Actions */}
                    <td className="text-end">
                      <button
                        className="btn btn-primary btn-sm px-3 fw-semibold shadow-sm d-inline-flex align-items-center gap-1"
                        onClick={() => handleDownload(cert.certificate_uuid, cert.student?.user?.name)}
                      >
                        <i className="bi bi-file-earmark-pdf-fill"></i>
                        <span>Download PDF</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: GENERATE CERTIFICATES */}
      {showGenModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(15, 23, 42, 0.65)' }} tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg rounded-4">
              <div className="modal-header border-bottom py-3">
                <h5 className="modal-title fw-bold text-dark">
                  <i className="bi bi-magic text-primary me-2"></i> Bulk Certificate Generation
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowGenModal(false)}></button>
              </div>

              <form onSubmit={handleGenerate}>
                <div className="modal-body p-4">
                  <p className="text-secondary small mb-3">
                    Generate official vector PDF certificates for all students who appeared in this examination.
                  </p>

                  <div className="mb-3">
                    <label className="form-label small fw-bold text-dark">Authorized Signature Title</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      value={sigName}
                      onChange={(e) => setSigName(e.target.value)}
                      placeholder="e.g. Controller of Examinations"
                      required
                    />
                    <div className="form-text small">Appears on the bottom signature seal of each PDF certificate.</div>
                  </div>

                  <div className="form-check form-switch mb-3">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="onlyPassedSwitch"
                      checked={onlyPassed}
                      onChange={(e) => setOnlyPassed(e.target.checked)}
                    />
                    <label className="form-check-label small fw-bold text-dark" htmlFor="onlyPassedSwitch">
                      Issue only to Candidates who Passed (Threshold: Passing %)
                    </label>
                  </div>
                </div>

                <div className="modal-footer border-top py-2 d-flex justify-content-between">
                  <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setShowGenModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary btn-sm px-4 fw-bold" disabled={actionLoading}>
                    {actionLoading ? 'Generating...' : 'Issue Certificates'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: VERIFY CERTIFICATE UUID */}
      {showVerifyModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(15, 23, 42, 0.65)' }} tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg rounded-4">
              <div className="modal-header border-bottom py-3">
                <h5 className="modal-title fw-bold text-dark">
                  <i className="bi bi-shield-check text-success me-2"></i> Certificate Authenticity Verification
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowVerifyModal(false)}></button>
              </div>

              <div className="modal-body p-4">
                <form onSubmit={handleVerify} className="mb-3">
                  <div className="input-group">
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Enter Certificate UUID (e.g. CERT-1-4-XYZ)"
                      value={verifyUuid}
                      onChange={(e) => setVerifyUuid(e.target.value)}
                      required
                    />
                    <button className="btn btn-primary fw-bold" type="submit" disabled={verifyLoading}>
                      {verifyLoading ? 'Verifying...' : 'Verify'}
                    </button>
                  </div>
                </form>

                {verifyResult && (
                  <div className={`p-3 rounded-3 border ${verifyResult.verified ? 'bg-success-subtle border-success' : 'bg-danger-subtle border-danger'}`}>
                    {verifyResult.verified ? (
                      <>
                        <div className="d-flex align-items-center gap-2 mb-2 text-success fw-bold">
                          <i className="bi bi-check-circle-fill fs-5"></i>
                          <span>AUTHENTIC INSTITUTIONAL CREDENTIAL</span>
                        </div>
                        <div className="small text-dark">
                          <div><strong>Student Name:</strong> {verifyResult.certificate.studentName}</div>
                          <div><strong>Student ID:</strong> {verifyResult.certificate.studentId}</div>
                          <div><strong>Assessment:</strong> {verifyResult.certificate.examTitle} ({verifyResult.certificate.examDate})</div>
                          <div><strong>Score:</strong> {verifyResult.certificate.marksObtained}/{verifyResult.certificate.totalMarks} ({verifyResult.certificate.percentage}%)</div>
                          <div><strong>Rank:</strong> #{verifyResult.certificate.rank}</div>
                          <div><strong>Issue Date:</strong> {verifyResult.certificate.issueDate}</div>
                          <div><strong>Authorized By:</strong> {verifyResult.certificate.authorizedSignature}</div>
                        </div>
                      </>
                    ) : (
                      <div className="d-flex align-items-center gap-2 text-danger fw-bold">
                        <i className="bi bi-x-circle-fill fs-5"></i>
                        <span>{verifyResult.message}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="modal-footer border-top py-2">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowVerifyModal(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CertificateManagement;
