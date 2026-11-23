import React, { useState, useEffect, useRef } from 'react';
import { academicService } from '../../services/academicService';
import { pdfUploadService } from '../../services/pdfUploadService';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const PdfQuestionUpload = () => {
  // Step State: 1 = Upload, 2 = Preview & Edit, 3 = Completed
  const [currentStep, setCurrentStep] = useState(1);

  // Academic Dropdown Data
  const [subjects, setSubjects] = useState([]);
  const [questionBanks, setQuestionBanks] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedQuestionBank, setSelectedQuestionBank] = useState('');

  // Upload Config State
  const [file, setFile] = useState(null);
  const [forceOcr, setForceOcr] = useState(false);
  const [ocrLanguage, setOcrLanguage] = useState('eng');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Extracted Data & Editing State
  const [uploadMetadata, setUploadMetadata] = useState(null);
  const [extractedQuestions, setExtractedQuestions] = useState([]);
  const [editingIndex, setEditingIndex] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // History State
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Alert State
  const [alert, setAlert] = useState(null);

  const fileInputRef = useRef(null);

  // Load initial subjects and upload history
  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const [subjRes, histRes] = await Promise.all([
        academicService.getSubjects(),
        pdfUploadService.getUploadHistory()
      ]);
      if (subjRes.success) {
        setSubjects(subjRes.data);
        if (subjRes.data.length > 0) {
          setSelectedSubject(subjRes.data[0].id.toString());
          loadQuestionBanks(subjRes.data[0].id);
        }
      }
      if (histRes.success) {
        setHistory(histRes.data);
      }
    } catch (err) {
      setAlert({ type: 'danger', message: 'Failed to load initial academic data or upload history.' });
    }
  };

  const loadQuestionBanks = async (subjectId) => {
    try {
      const res = await academicService.getQuestionBanks(subjectId);
      if (res.success) {
        setQuestionBanks(res.data);
      }
    } catch {
      setQuestionBanks([]);
    }
  };

  const handleSubjectChange = (e) => {
    const val = e.target.value;
    setSelectedSubject(val);
    loadQuestionBanks(val);
  };

  const handleFileSelect = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      if (selected.type !== 'application/pdf' && !selected.name.endsWith('.pdf')) {
        setAlert({ type: 'danger', message: 'Invalid file type. Please upload a PDF file.' });
        return;
      }
      if (selected.size > 25 * 1024 * 1024) {
        setAlert({ type: 'danger', message: 'File is too large. Maximum size is 25MB.' });
        return;
      }
      setFile(selected);
      setAlert(null);
    }
  };

  // Upload and Extract Handler
  const handleUploadAndExtract = async (e) => {
    e.preventDefault();
    if (!file) {
      setAlert({ type: 'warning', message: 'Please select a PDF file to proceed.' });
      return;
    }
    if (!selectedSubject) {
      setAlert({ type: 'warning', message: 'Please select an academic Subject for the questions.' });
      return;
    }

    try {
      setIsUploading(true);
      setUploadProgress(15);
      setAlert(null);

      const formData = new FormData();
      formData.append('pdfFile', file);
      formData.append('subject_id', selectedSubject);
      if (selectedQuestionBank) formData.append('question_bank_id', selectedQuestionBank);
      formData.append('forceOcr', forceOcr);
      formData.append('ocrLanguage', ocrLanguage);

      const res = await pdfUploadService.uploadAndExtract(formData, (progressEvent) => {
        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        setUploadProgress(Math.min(percent, 85));
      });

      setUploadProgress(100);

      if (res.success) {
        setUploadMetadata(res.pdfUpload);
        setExtractedQuestions(res.questions);
        setCurrentStep(2);
        setAlert({
          type: 'success',
          message: `Successfully extracted ${res.questions.length} questions! Review each question, verify answers, and edit any fields below before saving.`
        });
      }
    } catch (err) {
      setAlert({
        type: 'danger',
        message: err.response?.data?.message || 'Extraction failed. If this is a scanned PDF, try checking "Force OCR".'
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // Question editing handlers
  const handleQuestionTextChange = (index, value) => {
    const updated = [...extractedQuestions];
    updated[index].question_text = value;
    setExtractedQuestions(updated);
  };

  const handleOptionChange = (qIndex, optKey, value) => {
    const updated = [...extractedQuestions];
    const targetOpt = updated[qIndex].options.find((o) => o.option_key === optKey);
    if (targetOpt) {
      targetOpt.option_text = value;
    }
    setExtractedQuestions(updated);
  };

  const handleCorrectAnswerChange = (qIndex, optKey) => {
    const updated = [...extractedQuestions];
    updated[qIndex].correct_answer = optKey;
    updated[qIndex].options.forEach((opt) => {
      opt.is_correct = opt.option_key === optKey;
    });
    setExtractedQuestions(updated);
  };

  const handleDifficultyChange = (index, value) => {
    const updated = [...extractedQuestions];
    updated[index].difficulty_level = value;
    setExtractedQuestions(updated);
  };

  const handleTopicChange = (index, value) => {
    const updated = [...extractedQuestions];
    updated[index].topic = value;
    setExtractedQuestions(updated);
  };

  const handleDeleteQuestion = (index) => {
    if (window.confirm('Are you sure you want to remove this extracted question from the batch?')) {
      const updated = extractedQuestions.filter((_, idx) => idx !== index);
      setExtractedQuestions(updated);
    }
  };

  // Final commit to MySQL
  const handleApproveAndSave = async () => {
    // Validate that all questions have non-empty text and a correct answer marked
    const invalidList = extractedQuestions.filter(
      (q) => !q.question_text.trim() || !q.correct_answer || q.options.some((o) => !o.option_text.trim())
    );

    if (invalidList.length > 0) {
      setAlert({
        type: 'warning',
        message: `Please complete all questions before saving. ${invalidList.length} question(s) are missing question text, option values, or a selected correct answer.`
      });
      return;
    }

    try {
      setIsSaving(true);
      setAlert(null);

      const payload = {
        pdf_upload_id: uploadMetadata?.id,
        subject_id: parseInt(selectedSubject, 10),
        question_bank_id: selectedQuestionBank ? parseInt(selectedQuestionBank, 10) : null,
        questions: extractedQuestions
      };

      const res = await pdfUploadService.approveAndSaveQuestions(payload);
      if (res.success) {
        setAlert({
          type: 'success',
          message: `Success! ${res.savedCount} verified questions have been securely published to MySQL.`
        });
        setCurrentStep(3);
        fetchInitialData(); // Refresh history
      }
    } catch (err) {
      setAlert({
        type: 'danger',
        message: err.response?.data?.message || 'Failed to save approved questions.'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetFlow = () => {
    setFile(null);
    setUploadMetadata(null);
    setExtractedQuestions([]);
    setCurrentStep(1);
    setAlert(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="container-fluid py-4 px-3 px-md-4">
      {/* Page Title & Breadcrumb */}
      <div className="pb-3 mb-4 border-bottom d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
        <div>
          <span className="badge bg-primary-subtle text-primary border border-primary-subtle mb-1">
            Phase 2: Question Intelligence
          </span>
          <h2 className="fw-bold text-dark mb-1">PDF Question Upload & Extraction System</h2>
          <p className="text-muted mb-0 small">
            Extract MCQs from text-based and scanned PDFs with English & Hindi support and mandatory verification.
          </p>
        </div>

        {currentStep > 1 && (
          <button className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-2" onClick={handleResetFlow}>
            <i className="bi bi-arrow-left"></i> Upload Another PDF
          </button>
        )}
      </div>

      {/* Stepper Indicator */}
      <div className="card-custom bg-white p-3 mb-4">
        {/* Mobile View: 3 Lines (Stacked Vertically) */}
        <div className="d-flex flex-column d-md-none gap-2">
          <div
            className={`d-flex align-items-center p-2 rounded-3 ${
              currentStep === 1
                ? 'bg-primary-subtle text-primary fw-bold border border-primary-subtle'
                : currentStep > 1
                ? 'bg-light text-success fw-semibold'
                : 'text-muted bg-light'
            }`}
          >
            <span
              className={`badge rounded-circle d-flex align-items-center justify-content-center me-2.5 flex-shrink-0 ${
                currentStep === 1
                  ? 'bg-primary text-white'
                  : currentStep > 1
                  ? 'bg-success text-white'
                  : 'bg-secondary bg-opacity-25 text-secondary'
              }`}
              style={{ width: '28px', height: '28px', fontSize: '0.82rem' }}
            >
              {currentStep > 1 ? <i className="bi bi-check-lg"></i> : '1'}
            </span>
            <div className="flex-grow-1" style={{ fontSize: '0.88rem' }}>
              Upload PDF & OCR Settings
            </div>
            {currentStep === 1 && (
              <span className="badge bg-primary text-white px-2 py-0.5" style={{ fontSize: '0.68rem' }}>
                Active
              </span>
            )}
          </div>

          <div
            className={`d-flex align-items-center p-2 rounded-3 ${
              currentStep === 2
                ? 'bg-primary-subtle text-primary fw-bold border border-primary-subtle'
                : currentStep > 2
                ? 'bg-light text-success fw-semibold'
                : 'text-muted bg-light'
            }`}
          >
            <span
              className={`badge rounded-circle d-flex align-items-center justify-content-center me-2.5 flex-shrink-0 ${
                currentStep === 2
                  ? 'bg-primary text-white'
                  : currentStep > 2
                  ? 'bg-success text-white'
                  : 'bg-secondary bg-opacity-25 text-secondary'
              }`}
              style={{ width: '28px', height: '28px', fontSize: '0.82rem' }}
            >
              {currentStep > 2 ? <i className="bi bi-check-lg"></i> : '2'}
            </span>
            <div className="flex-grow-1" style={{ fontSize: '0.88rem' }}>
              Verify & Edit Extracted MCQs
            </div>
            {currentStep === 2 && (
              <span className="badge bg-primary text-white px-2 py-0.5" style={{ fontSize: '0.68rem' }}>
                Active
              </span>
            )}
          </div>

          <div
            className={`d-flex align-items-center p-2 rounded-3 ${
              currentStep === 3
                ? 'bg-success-subtle text-success fw-bold border border-success-subtle'
                : 'text-muted bg-light'
            }`}
          >
            <span
              className={`badge rounded-circle d-flex align-items-center justify-content-center me-2.5 flex-shrink-0 ${
                currentStep === 3 ? 'bg-success text-white' : 'bg-secondary bg-opacity-25 text-secondary'
              }`}
              style={{ width: '28px', height: '28px', fontSize: '0.82rem' }}
            >
              {currentStep === 3 ? <i className="bi bi-check-lg"></i> : '3'}
            </span>
            <div className="flex-grow-1" style={{ fontSize: '0.88rem' }}>
              Approved & Saved in MySQL
            </div>
            {currentStep === 3 && (
              <span className="badge bg-success text-white px-2 py-0.5" style={{ fontSize: '0.68rem' }}>
                Completed
              </span>
            )}
          </div>
        </div>

        {/* Desktop View: Horizontal Row with Chevrons */}
        <div className="d-none d-md-flex align-items-center justify-content-around text-center">
          <div className={`step-item ${currentStep >= 1 ? 'text-primary fw-bold' : 'text-muted'}`}>
            <span className={`badge rounded-circle p-2 me-2 ${currentStep >= 1 ? 'bg-primary text-white' : 'bg-light text-secondary border'}`}>
              1
            </span>
            <span>Upload PDF & OCR Settings</span>
          </div>
          <i className="bi bi-chevron-right text-muted"></i>
          <div className={`step-item ${currentStep >= 2 ? 'text-primary fw-bold' : 'text-muted'}`}>
            <span className={`badge rounded-circle p-2 me-2 ${currentStep >= 2 ? 'bg-primary text-white' : 'bg-light text-secondary border'}`}>
              2
            </span>
            <span>Verify & Edit Extracted MCQs</span>
          </div>
          <i className="bi bi-chevron-right text-muted"></i>
          <div className={`step-item ${currentStep === 3 ? 'text-success fw-bold' : 'text-muted'}`}>
            <span className={`badge rounded-circle p-2 me-2 ${currentStep === 3 ? 'bg-success text-white' : 'bg-light text-secondary border'}`}>
              3
            </span>
            <span>Approved & Saved in MySQL</span>
          </div>
        </div>
      </div>

      {/* Alert Notification */}
      {alert && (
        <div className={`alert alert-${alert.type} alert-dismissible fade show shadow-sm mb-4`} role="alert">
          <div className="d-flex align-items-center gap-2">
            <i className={`bi ${alert.type === 'success' ? 'bi-check-circle-fill' : alert.type === 'warning' ? 'bi-exclamation-triangle-fill' : 'bi-x-circle-fill'} fs-5`}></i>
            <div>{alert.message}</div>
          </div>
          <button type="button" className="btn-close" onClick={() => setAlert(null)} aria-label="Close"></button>
        </div>
      )}

      {/* STEP 1: Upload Form */}
      {currentStep === 1 && (
        <div className="row g-4">
          <div className="col-12 col-lg-8">
            <div className="card-custom bg-white p-4 h-100">
              <h5 className="fw-bold text-dark mb-3">
                <i className="bi bi-cloud-arrow-up-fill text-primary me-2"></i> Upload Question PDF
              </h5>

              <form onSubmit={handleUploadAndExtract}>
                {/* Academic Subject & Question Bank */}
                <div className="row g-3 mb-3">
                  <div className="col-md-6">
                    <label className="form-label fw-semibold small text-secondary">
                      Target Subject <span className="text-danger">*</span>
                    </label>
                    <select
                      className="form-select bg-light"
                      value={selectedSubject}
                      onChange={handleSubjectChange}
                      required
                    >
                      {subjects.map((sub) => (
                        <option key={sub.id} value={sub.id}>
                          {sub.name} ({sub.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-md-6">
                    <label className="form-label fw-semibold small text-secondary">
                      Question Bank / Pool (Optional)
                    </label>
                    <select
                      className="form-select bg-light"
                      value={selectedQuestionBank}
                      onChange={(e) => setSelectedQuestionBank(e.target.value)}
                    >
                      <option value="">Default Question Bank</option>
                      {questionBanks.map((qb) => (
                        <option key={qb.id} value={qb.id}>
                          {qb.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* PDF File Picker */}
                <div className="mb-4">
                  <label className="form-label fw-semibold small text-secondary">
                    Select PDF Document (Max 25MB) <span className="text-danger">*</span>
                  </label>
                  <div className="border border-2 border-dashed rounded-3 p-4 text-center bg-light">
                    <i className="bi bi-file-earmark-pdf-fill text-danger display-4 d-block mb-2"></i>
                    {file ? (
                      <div className="mb-2">
                        <span className="fw-bold text-dark">{file.name}</span>
                        <span className="text-muted small ms-2">({(file.size / (1024 * 1024)).toFixed(2)} MB)</span>
                      </div>
                    ) : (
                      <p className="text-muted small mb-2">
                        Choose a PDF file with MCQ questions, four options, and marked correct answers.
                      </p>
                    )}
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="form-control d-none"
                      id="pdfUploadInput"
                      accept=".pdf,application/pdf"
                      onChange={handleFileSelect}
                    />
                    <label htmlFor="pdfUploadInput" className="btn btn-outline-primary btn-sm px-4">
                      <i className="bi bi-folder2-open me-1"></i> Browse Computer
                    </label>
                  </div>
                </div>

                {/* OCR & Language Options */}
                <div className="p-3 bg-light rounded-3 mb-4 border">
                  <h6 className="fw-semibold text-dark small mb-2">
                    <i className="bi bi-cpu-fill text-secondary me-1"></i> OCR & Scanned Document Configuration
                  </h6>
                  <div className="form-check form-switch mb-2">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="forceOcrSwitch"
                      checked={forceOcr}
                      onChange={(e) => setForceOcr(e.target.checked)}
                    />
                    <label className="form-check-label small" htmlFor="forceOcrSwitch">
                      Force Tesseract OCR (Enable for scanned documents or image-based PDFs)
                    </label>
                  </div>

                  {forceOcr && (
                    <div className="mt-2 row g-2 align-items-center">
                      <div className="col-auto">
                        <label className="small text-secondary fw-semibold">Language Engine:</label>
                      </div>
                      <div className="col-auto">
                        <select
                          className="form-select form-select-sm"
                          value={ocrLanguage}
                          onChange={(e) => setOcrLanguage(e.target.value)}
                        >
                          <option value="eng">English (eng)</option>
                          <option value="hin">Hindi (hin)</option>
                          <option value="eng+hin">Bilingual English + Hindi</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                {/* Progress Bar */}
                {isUploading && (
                  <div className="mb-3">
                    <div className="d-flex justify-content-between small text-muted mb-1">
                      <span>Extracting and parsing MCQ questions...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="progress" style={{ height: '8px' }}>
                      <div
                        className="progress-bar progress-bar-striped progress-bar-animated bg-primary"
                        role="progressbar"
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  className="btn btn-primary w-100 py-2 fw-semibold shadow-sm rounded-3 d-flex align-items-center justify-content-center gap-2"
                  disabled={isUploading || !file}
                >
                  {isUploading ? (
                    <>
                      <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                      <span>Analyzing PDF & Extracting Questions...</span>
                    </>
                  ) : (
                    <>
                      <i className="bi bi-magic"></i>
                      <span>Upload & Extract Questions</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Right Help Card: Formatting Guidelines */}
          <div className="col-12 col-lg-4">
            <div className="card-custom bg-white p-4 h-100">
              <h6 className="fw-bold text-dark mb-3">
                <i className="bi bi-info-circle-fill text-primary me-2"></i> Supported PDF Format
              </h6>
              <div className="p-3 bg-light rounded-3 mb-3" style={{ fontSize: '0.84rem' }}>
                <div className="fw-semibold text-dark">Example Question Structure:</div>
                <code className="d-block text-dark mt-2 lh-base">
                  1. Which protocol is connection-oriented?<br />
                  *(A) TCP<br />
                  (B) UDP<br />
                  (C) IP<br />
                  (D) ICMP<br />
                  Answer: A<br />
                  Explanation: TCP ensures reliable transmission.
                </code>
              </div>

              <h6 className="fw-bold text-dark small mb-2">Key Extraction Features:</h6>
              <ul className="text-secondary small mb-0 lh-lg ps-3">
                <li>Detects marked answers via asterisk (*), (A)*, or Answer: X line.</li>
                <li>Supports bilingual documents (Hindi & English).</li>
                <li>Scanned document detection triggers OCR automatically.</li>
                <li><strong>Duplicate Protection:</strong> Automatically flags questions that already exist in your question bank.</li>
                <li><strong>Admin Guard:</strong> Questions are held in staging until verified.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: Preview, Edit & Verify Extracted Questions */}
      {currentStep === 2 && (
        <div>
          {/* Top Banner with Stats & Commit Button */}
          <div className="card-custom bg-white p-3 mb-4 d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
            <div>
              <h5 className="fw-bold text-dark mb-1">
                Extracted Questions Preview ({extractedQuestions.length} Questions Found)
              </h5>
              <div className="d-flex align-items-center gap-2 small text-muted">
                <span>File: <strong>{uploadMetadata?.file_name}</strong></span>
                <span>•</span>
                <span>OCR Applied: <strong>{uploadMetadata?.ocr_applied ? 'Yes' : 'No'}</strong></span>
                <span>•</span>
                <span className="text-warning fw-semibold">
                  <i className="bi bi-shield-exclamation"></i> Mandatory Admin Verification Active
                </span>
              </div>
            </div>

            <div className="d-flex flex-wrap align-items-center gap-2">
              <button
                className="btn btn-outline-danger btn-sm flex-grow-1 flex-sm-grow-0"
                onClick={handleResetFlow}
                disabled={isSaving}
              >
                <i className="bi bi-trash me-1"></i> Discard Batch
              </button>
              <button
                className="btn btn-success fw-semibold shadow-sm px-4 d-flex align-items-center gap-2"
                onClick={handleApproveAndSave}
                disabled={isSaving || extractedQuestions.length === 0}
              >
                {isSaving ? (
                  <>
                    <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                    <span>Saving to MySQL...</span>
                  </>
                ) : (
                  <>
                    <i className="bi bi-check-all fs-5"></i>
                    <span>Approve & Save Questions ({extractedQuestions.length})</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Questions Cards List */}
          <div className="vstack gap-3">
            {extractedQuestions.map((q, idx) => (
              <div
                key={q.temp_id || idx}
                className={`card-custom bg-white p-4 border ${q.is_duplicate ? 'border-warning-subtle' : ''}`}
              >
                {/* Header: Question Number, Duplicate Warning, Language, Actions */}
                <div className="d-flex align-items-center justify-content-between pb-2 mb-3 border-bottom">
                  <div className="d-flex align-items-center gap-2">
                    <span className="badge bg-primary rounded-pill px-3 py-1">
                      Question #{idx + 1}
                    </span>
                    {q.is_duplicate && (
                      <span className="badge bg-warning-subtle text-warning border border-warning-subtle">
                        <i className="bi bi-exclamation-triangle-fill me-1"></i> Duplicate in Question Bank
                      </span>
                    )}
                    <span className="badge bg-light text-secondary border">
                      Language: {q.language?.toUpperCase() || 'EN'}
                    </span>
                    {!q.correct_answer && (
                      <span className="badge bg-danger">Missing Correct Answer!</span>
                    )}
                  </div>

                  <div className="d-flex align-items-center gap-2">
                    <button
                      className="btn btn-outline-danger btn-sm p-1 px-2"
                      title="Remove Question"
                      onClick={() => handleDeleteQuestion(idx)}
                    >
                      <i className="bi bi-trash"></i>
                    </button>
                  </div>
                </div>

                {/* Question Textarea */}
                <div className="mb-3">
                  <label className="form-label fw-semibold small text-secondary">Question Text:</label>
                  <textarea
                    className="form-control"
                    rows="2"
                    value={q.question_text}
                    onChange={(e) => handleQuestionTextChange(idx, e.target.value)}
                    placeholder="Enter question text..."
                  ></textarea>
                </div>

                {/* 4 Options Grid */}
                <div className="row g-3 mb-3">
                  {q.options.map((opt) => (
                    <div key={opt.option_key} className="col-md-6">
                      <div className={`p-2 rounded-3 border ${q.correct_answer === opt.option_key ? 'border-success bg-success-subtle bg-opacity-25' : 'bg-light'}`}>
                        <div className="d-flex align-items-center justify-content-between mb-1">
                          <label className="form-label fw-bold mb-0 small text-dark">
                            Option {opt.option_key}
                          </label>
                          <div className="form-check">
                            <input
                              className="form-check-input"
                              type="radio"
                              name={`correct_ans_${idx}`}
                              id={`radio_${idx}_${opt.option_key}`}
                              checked={q.correct_answer === opt.option_key}
                              onChange={() => handleCorrectAnswerChange(idx, opt.option_key)}
                            />
                            <label
                              className={`form-check-label small fw-semibold ${q.correct_answer === opt.option_key ? 'text-success' : 'text-muted'}`}
                              htmlFor={`radio_${idx}_${opt.option_key}`}
                            >
                              {q.correct_answer === opt.option_key ? '✓ Correct Answer' : 'Mark Correct'}
                            </label>
                          </div>
                        </div>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          value={opt.option_text}
                          onChange={(e) => handleOptionChange(idx, opt.option_key, e.target.value)}
                          placeholder={`Enter option ${opt.option_key} text...`}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Additional Settings: Topic, Difficulty, Explanation */}
                <div className="row g-3 pt-2 border-top">
                  <div className="col-md-4">
                    <label className="form-label fw-semibold small text-secondary">Topic:</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      value={q.topic || ''}
                      onChange={(e) => handleTopicChange(idx, e.target.value)}
                      placeholder="e.g. Graph Algorithms"
                    />
                  </div>

                  <div className="col-md-4">
                    <label className="form-label fw-semibold small text-secondary">Difficulty Level:</label>
                    <select
                      className="form-select form-select-sm"
                      value={q.difficulty_level || 'medium'}
                      onChange={(e) => handleDifficultyChange(idx, e.target.value)}
                    >
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </select>
                  </div>

                  <div className="col-md-4">
                    <label className="form-label fw-semibold small text-secondary">Explanation (Optional):</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      value={q.explanation || ''}
                      onChange={(e) => {
                        const updated = [...extractedQuestions];
                        updated[idx].explanation = e.target.value;
                        setExtractedQuestions(updated);
                      }}
                      placeholder="Explanation for students..."
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Bottom Save Action */}
          <div className="mt-4 p-3 bg-white rounded-3 shadow-sm border text-end">
            <button
              className="btn btn-success fw-semibold px-4 py-2"
              onClick={handleApproveAndSave}
              disabled={isSaving}
            >
              <i className="bi bi-check2-circle me-1"></i> Approve & Save All Questions
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Success Confirmation */}
      {currentStep === 3 && (
        <div className="card-custom bg-white p-5 text-center my-4">
          <div
            className="bg-success text-white rounded-circle d-inline-flex align-items-center justify-content-center mb-3 shadow"
            style={{ width: '70px', height: '70px', fontSize: '2.5rem' }}
          >
            <i className="bi bi-check-lg"></i>
          </div>
          <h3 className="fw-bold text-dark">Questions Successfully Saved!</h3>
          <p className="text-muted mb-4">
            All approved questions have been verified, indexed, and stored in MySQL under the selected Subject.
          </p>
          <div className="d-flex flex-column flex-sm-row justify-content-center gap-2 gap-sm-3">
            <button className="btn btn-outline-primary" onClick={handleResetFlow}>
              <i className="bi bi-cloud-arrow-up me-1"></i> Upload Another PDF
            </button>
            <a href="/admin/dashboard" className="btn btn-primary">
              <i className="bi bi-grid-1x2-fill me-1"></i> Return to Dashboard
            </a>
          </div>
        </div>
      )}

      {/* Upload History Table (Always shown at bottom) */}
      <div className="card-custom bg-white p-4 mt-5">
        <h5 className="fw-bold text-dark mb-3">
          <i className="bi bi-clock-history text-secondary me-2"></i> PDF Upload & Extraction History
        </h5>
        {history.length === 0 ? (
          <p className="text-muted small mb-0">No historical PDF uploads recorded yet.</p>
        ) : (
          <div className="table-responsive">
            <table className="table table-custom mb-0">
              <thead>
                <tr>
                  <th>File Name</th>
                  <th>Questions Detected</th>
                  <th>Approved Count</th>
                  <th>OCR Applied</th>
                  <th>Status</th>
                  <th>Uploaded Date</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id}>
                    <td className="fw-semibold text-dark">
                      <i className="bi bi-file-earmark-pdf text-danger me-1"></i> {h.file_name}
                    </td>
                    <td>{h.total_detected}</td>
                    <td>
                      <span className="badge bg-success-subtle text-success">
                        {h.approved_count} Approved
                      </span>
                    </td>
                    <td>{h.ocr_applied ? 'Yes' : 'No'}</td>
                    <td>
                      <span className={`badge ${h.status === 'approved' ? 'bg-success' : h.status === 'extracted' ? 'bg-info' : 'bg-secondary'}`}>
                        {h.status}
                      </span>
                    </td>
                    <td className="text-muted small">
                      {new Date(h.created_at).toLocaleDateString()} {new Date(h.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default PdfQuestionUpload;
