import React, { useState, useEffect } from 'react';
import { examService } from '../../services/examService';
import { academicService } from '../../services/academicService';
import { questionService } from '../../services/questionService';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const ExamManagement = () => {
  // Data States
  const [exams, setExams] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [statusFilter, setStatusFilter] = useState('all');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Create Exam Modal & Wizard State
  const [showModal, setShowModal] = useState(false);
  const [modalStep, setModalStep] = useState(1); // 1 = Details, 2 = Timing & Marks, 3 = Question Mode
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Available Questions for Manual Selection (Option A)
  const [poolQuestions, setPoolQuestions] = useState([]);
  const [selectedManualQIds, setSelectedManualQIds] = useState([]);

  // Form State
  const [form, setForm] = useState({
    title: '',
    description: '',
    instructions: '1. Ensure uninterrupted internet connectivity.\n2. Server-side countdown is strictly enforced.\n3. Automatic submission upon timer expiration.\n4. Questions cannot be revisited after final submission.',
    subject_id: '',
    class_id: '',
    batch_id: '',
    exam_date: new Date(Date.now() + 86400000).toISOString().split('T')[0], // Tomorrow
    start_time: '10:00',
    end_time: '11:30',
    duration_minutes: 60,
    total_questions: 50,
    total_marks: 100,
    marks_per_question: 2.0,
    negative_marking: 0.5,
    passing_percentage: 40.0,
    selection_mode: 'random_fixed_pool' // 'manual_fixed', 'random_fixed_pool', 'random_per_student'
  });

  // Details Modal
  const [selectedExamDetails, setSelectedExamDetails] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // Alert State
  const [alert, setAlert] = useState(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    fetchExams();
  }, [statusFilter, subjectFilter]);

  const fetchInitialData = async () => {
    try {
      const [subjRes, classRes] = await Promise.all([
        academicService.getSubjects(),
        academicService.getClasses()
      ]);
      if (subjRes.success) setSubjects(subjRes.data);
      if (classRes.success) {
        setClasses(classRes.data);
        if (classRes.data.length > 0) {
          setForm((prev) => ({
            ...prev,
            class_id: classRes.data[0].id.toString(),
            subject_id: subjRes.data[0]?.id?.toString() || ''
          }));
        }
      }
    } catch (err) {
      console.error('Failed to load academic entities:', err);
    }
  };

  const fetchExams = async () => {
    try {
      setLoading(true);
      const params = {
        ...(statusFilter !== 'all' && { status: statusFilter }),
        ...(subjectFilter && { subject_id: subjectFilter }),
        ...(searchTerm.trim() && { search: searchTerm.trim() })
      };
      const res = await examService.getExams(params);
      if (res.success) {
        setExams(res.data);
      }
    } catch (err) {
      setAlert({ type: 'danger', message: 'Failed to retrieve examinations.' });
    } finally {
      setLoading(false);
    }
  };

  // When subject changes in form, reload question pool for Option A
  const handleSubjectChange = async (subjectId) => {
    setForm({ ...form, subject_id: subjectId });
    try {
      const qRes = await questionService.getQuestions({ subject_id: subjectId, limit: 100 });
      if (qRes.success) {
        setPoolQuestions(qRes.data.questions);
      }
    } catch {
      setPoolQuestions([]);
    }
  };

  // Open Create Exam Wizard
  const handleOpenCreateModal = async () => {
    const defaultSubj = subjects[0]?.id?.toString() || '';
    setForm({
      title: '',
      description: '',
      instructions: '1. Ensure uninterrupted internet connectivity.\n2. Server-side countdown is strictly enforced.\n3. Automatic submission upon timer expiration.\n4. Questions cannot be revisited after final submission.',
      subject_id: defaultSubj,
      class_id: classes[0]?.id?.toString() || '',
      batch_id: '',
      exam_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      start_time: '10:00',
      end_time: '11:30',
      duration_minutes: 60,
      total_questions: 50,
      total_marks: 100,
      marks_per_question: 2.0,
      negative_marking: 0.5,
      passing_percentage: 40.0,
      selection_mode: 'random_fixed_pool'
    });
    setModalStep(1);
    setSelectedManualQIds([]);
    setShowModal(true);

    if (defaultSubj) {
      handleSubjectChange(defaultSubj);
    }
  };

  // Submit Exam Creation
  const handleCreateExamSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setAlert({ type: 'warning', message: 'Please provide an examination title.' });
      return;
    }
    if (!form.subject_id || !form.class_id) {
      setAlert({ type: 'warning', message: 'Please select both Subject and Class.' });
      return;
    }

    if (form.selection_mode === 'manual_fixed' && selectedManualQIds.length === 0) {
      setAlert({
        type: 'warning',
        message: 'Option A (Manual Fixed) requires you to select questions from the table.'
      });
      return;
    }

    try {
      setIsSubmitting(true);
      setAlert(null);

      // Combine exam_date and time strings into ISO strings
      const startDateTime = new Date(`${form.exam_date}T${form.start_time}:00`).toISOString();
      const endDateTime = new Date(`${form.exam_date}T${form.end_time}:00`).toISOString();

      const payload = {
        ...form,
        start_time: startDateTime,
        end_time: endDateTime,
        total_questions: form.selection_mode === 'manual_fixed' ? selectedManualQIds.length : parseInt(form.total_questions, 10),
        manual_question_ids: selectedManualQIds
      };

      const res = await examService.createExam(payload);
      if (res.success) {
        setAlert({
          type: 'success',
          message: res.message
        });
        setShowModal(false);
        fetchExams();
      }
    } catch (err) {
      setAlert({
        type: 'danger',
        message: err.response?.data?.message || 'Failed to create examination.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Status Change Handler
  const handleStatusChange = async (examId, newStatus) => {
    try {
      const res = await examService.updateExamStatus(examId, newStatus);
      if (res.success) {
        setAlert({ type: 'success', message: res.message });
        fetchExams();
      }
    } catch (err) {
      setAlert({
        type: 'danger',
        message: err.response?.data?.message || 'Failed to change exam status.'
      });
    }
  };

  // Delete Exam
  const handleDeleteExam = async (examId, title) => {
    if (!window.confirm(`Are you sure you want to remove examination "${title}"?`)) return;

    try {
      const res = await examService.deleteExam(examId);
      if (res.success) {
        setAlert({ type: 'success', message: res.message });
        fetchExams();
      }
    } catch (err) {
      setAlert({
        type: 'danger',
        message: err.response?.data?.message || 'Failed to delete examination.'
      });
    }
  };

  // View Details Modal
  const handleViewDetails = async (examId) => {
    try {
      const res = await examService.getExamById(examId);
      if (res.success) {
        setSelectedExamDetails(res.data);
        setShowDetailsModal(true);
      }
    } catch (err) {
      setAlert({ type: 'danger', message: 'Failed to retrieve detailed exam records.' });
    }
  };

  // Manual Question Toggle
  const toggleManualQuestion = (qId) => {
    if (selectedManualQIds.includes(qId)) {
      setSelectedManualQIds(selectedManualQIds.filter((id) => id !== qId));
    } else {
      setSelectedManualQIds([...selectedManualQIds, qId]);
    }
  };

  // Get selected class batches
  const currentClassBatches =
    classes.find((c) => c.id.toString() === form.class_id)?.batches || [];

  return (
    <div className="container-fluid py-4 px-3 px-md-4">
      {/* Page Title & Schedule Button */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center pb-3 mb-4 border-bottom gap-3">
        <div>
          <span className="badge bg-primary-subtle text-primary border border-primary-subtle mb-1">
            Phase 4: Examination Architecture
          </span>
          <h2 className="fw-bold text-dark mb-1">Exam Creation & Assessment Module</h2>
          <p className="text-muted mb-0 small">
            Configure assessments with negative marking, server timers, and Section 7 3-mode question selection.
          </p>
        </div>

        <button
          className="btn btn-primary fw-semibold shadow-sm d-flex align-items-center justify-content-center gap-2 align-self-stretch align-self-md-auto"
          onClick={handleOpenCreateModal}
        >
          <i className="bi bi-calendar-plus-fill"></i>
          <span>Schedule New Exam</span>
        </button>
      </div>

      {/* Alerts */}
      {alert && (
        <div className={`alert alert-${alert.type} alert-dismissible fade show shadow-sm mb-4`} role="alert">
          <div className="d-flex align-items-center gap-2">
            <i className={`bi ${alert.type === 'success' ? 'bi-check-circle-fill' : alert.type === 'warning' ? 'bi-exclamation-triangle-fill' : 'bi-x-circle-fill'} fs-5`}></i>
            <div>{alert.message}</div>
          </div>
          <button type="button" className="btn-close" onClick={() => setAlert(null)} aria-label="Close"></button>
        </div>
      )}

      {/* Filter Tabs & Search Bar */}
      <div className="card-custom bg-white p-3 mb-4">
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-stretch align-items-md-center gap-3">
          {/* Status Pills */}
          <div className="d-flex flex-wrap gap-1" role="group">
            {['all', 'scheduled', 'active', 'completed', 'draft'].map((st) => (
              <button
                key={st}
                type="button"
                className={`btn btn-sm text-capitalize ${statusFilter === st ? 'btn-primary fw-bold' : 'btn-outline-secondary'}`}
                onClick={() => setStatusFilter(st)}
              >
                {st === 'active' ? '● Live Now' : st}
              </button>
            ))}
          </div>

          {/* Search & Subject Dropdown */}
          <div className="d-flex flex-column flex-sm-row align-items-stretch align-items-sm-center gap-2 w-100 w-md-auto">
            <select
              className="form-select form-select-sm bg-light flex-grow-1"
              style={{ minWidth: '130px' }}
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
            >
              <option value="">All Subjects</option>
              {subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.name}
                </option>
              ))}
            </select>

            <div className="input-group input-group-sm flex-grow-1" style={{ minWidth: '160px' }}>
              <input
                type="text"
                className="form-control"
                placeholder="Search exams..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <button className="btn btn-outline-secondary" onClick={fetchExams}>
                <i className="bi bi-search"></i>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Exams Grid / Table */}
      <div className="card-custom bg-white p-0 overflow-hidden mb-4">
        {loading ? (
          <div className="py-5">
            <LoadingSpinner message="Loading examinations..." />
          </div>
        ) : exams.length === 0 ? (
          <div className="text-center py-5">
            <i className="bi bi-file-earmark-x fs-1 text-muted opacity-50 d-block mb-2"></i>
            <h5 className="text-dark fw-bold mb-1">No Examinations Found</h5>
            <p className="text-muted small mb-3">
              No exams matched the selected filter or none have been scheduled yet.
            </p>
            <button className="btn btn-primary btn-sm" onClick={handleOpenCreateModal}>
              <i className="bi bi-calendar-plus me-1"></i> Schedule First Exam
            </button>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-custom mb-0">
              <thead>
                <tr>
                  <th>Exam Title & Subject</th>
                  <th>Class & Cohort</th>
                  <th>Schedule & Duration</th>
                  <th>Marks & Penalties</th>
                  <th>Question Selection Mode</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {exams.map((exam) => {
                  const modeBadge =
                    exam.selection_mode === 'manual_fixed'
                      ? { text: 'Option A: Fixed Manual', class: 'bg-primary-subtle text-primary border border-primary-subtle' }
                      : exam.selection_mode === 'random_fixed_pool'
                      ? { text: 'Option B: Random Fixed Pool', class: 'bg-info-subtle text-info border border-info-subtle' }
                      : { text: 'Option C: Random Per Student', class: 'bg-purple-subtle text-purple border border-purple-subtle' };

                  return (
                    <tr key={exam.id}>
                      {/* Title & Subject */}
                      <td>
                        <div className="fw-bold text-dark">{exam.title}</div>
                        <div className="text-muted small">
                          <span className="text-primary fw-medium">{exam.subject?.name}</span> ({exam.subject?.code})
                        </div>
                      </td>

                      {/* Class & Batch */}
                      <td>
                        <div className="text-dark small fw-semibold">{exam.class?.name}</div>
                        <div className="text-muted small">
                          {exam.batch ? exam.batch.name : 'All Class Batches'}
                        </div>
                        <span className="badge bg-light text-secondary border mt-1" style={{ fontSize: '0.72rem' }}>
                          <i className="bi bi-people-fill me-1 text-primary"></i>
                          {exam.assigned_students_count} Candidates Assigned
                        </span>
                      </td>

                      {/* Schedule & Duration */}
                      <td>
                        <div className="small fw-semibold text-dark">
                          <i className="bi bi-calendar3 me-1 text-primary"></i>
                          {new Date(exam.exam_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                        <div className="text-muted small">
                          <i className="bi bi-clock me-1"></i>
                          {new Date(exam.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(exam.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <span className="badge bg-light text-dark border mt-1">
                          {exam.duration_minutes} Mins
                        </span>
                      </td>

                      {/* Marks */}
                      <td>
                        <div className="small fw-bold text-dark">
                          {exam.total_marks} Marks ({exam.total_questions} MCQs)
                        </div>
                        <div className="text-muted small" style={{ fontSize: '0.78rem' }}>
                          +{exam.marks_per_question} / -{exam.negative_marking}
                        </div>
                        <div className="text-success small fw-medium" style={{ fontSize: '0.75rem' }}>
                          Pass: {exam.passing_percentage}%
                        </div>
                      </td>

                      {/* Selection Mode */}
                      <td>
                        <span className={`badge ${modeBadge.class}`} style={{ fontSize: '0.76rem' }}>
                          {modeBadge.text}
                        </span>
                        <div className="text-muted mt-1" style={{ fontSize: '0.72rem' }}>
                          {exam.selection_mode === 'random_per_student'
                            ? 'Independent draw per candidate'
                            : `${exam.linked_questions_count} questions mapped`}
                        </div>
                      </td>

                      {/* Status */}
                      <td>
                        <span
                          className={`badge ${
                            exam.status === 'active'
                              ? 'bg-success'
                              : exam.status === 'scheduled'
                              ? 'bg-primary'
                              : exam.status === 'completed'
                              ? 'bg-secondary'
                              : 'bg-light text-dark border'
                          }`}
                        >
                          {exam.status === 'active' ? '● Live Now' : exam.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td>
                        <div className="dropdown">
                          <button
                            className="btn btn-sm btn-light border dropdown-toggle"
                            type="button"
                            data-bs-toggle="dropdown"
                          >
                            Manage
                          </button>
                          <ul className="dropdown-menu dropdown-menu-end shadow-sm border-0">
                            <li>
                              <button className="dropdown-item small" onClick={() => handleViewDetails(exam.id)}>
                                <i className="bi bi-eye me-2 text-primary"></i> View Questions & Roster
                              </button>
                            </li>
                            <li>
                              <button
                                className="dropdown-item small text-primary"
                                onClick={() => {
                                  const link = `${window.location.origin}/student/exams/${exam.id}/instructions`;
                                  navigator.clipboard.writeText(link);
                                  setAlert({ type: 'success', message: `Direct Exam Link copied to clipboard: ${link}` });
                                }}
                              >
                                <i className="bi bi-link-45deg me-2"></i> Copy Student Exam Link
                              </button>
                            </li>
                            {exam.status === 'scheduled' && (
                              <li>
                                <button className="dropdown-item small text-success" onClick={() => handleStatusChange(exam.id, 'active')}>
                                  <i className="bi bi-play-circle me-2"></i> Launch Exam (Activate)
                                </button>
                              </li>
                            )}
                            {exam.status === 'active' && (
                              <li>
                                <button className="dropdown-item small text-warning" onClick={() => handleStatusChange(exam.id, 'completed')}>
                                  <i className="bi bi-stop-circle me-2"></i> Conclude Exam (Completed)
                                </button>
                              </li>
                            )}
                            <li><hr className="dropdown-divider" /></li>
                            <li>
                              <button className="dropdown-item small text-danger" onClick={() => handleDeleteExam(exam.id, exam.title)}>
                                <i className="bi bi-trash me-2"></i> Delete Exam
                              </button>
                            </li>
                          </ul>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE EXAM WIZARD MODAL */}
      {showModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)' }} tabIndex="-1">
          <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
            <div className="modal-content shadow-lg border-0 rounded-4">
              <div className="modal-header border-bottom py-3">
                <div>
                  <h5 className="modal-title fw-bold text-dark">Schedule New Examination</h5>
                  <small className="text-muted">Step {modalStep} of 3: {modalStep === 1 ? 'Academic Target & Details' : modalStep === 2 ? 'Timing & Assessment Rules' : 'Question Selection Mode'}</small>
                </div>
                <button type="button" className="btn-close" onClick={() => setShowModal(false)}></button>
              </div>

              <form onSubmit={handleCreateExamSubmit}>
                <div className="modal-body p-4">
                  {/* STEP 1: Basic & Academic Target */}
                  {modalStep === 1 && (
                    <div className="vstack gap-3">
                      <div>
                        <label className="form-label fw-semibold small text-secondary">
                          Exam Title / Name <span className="text-danger">*</span>
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="e.g. Midterm Examination 2026 - CS301"
                          value={form.title}
                          onChange={(e) => setForm({ ...form, title: e.target.value })}
                          required
                        />
                      </div>

                      <div className="row g-3">
                        <div className="col-md-6">
                          <label className="form-label fw-semibold small text-secondary">
                            Subject <span className="text-danger">*</span>
                          </label>
                          <select
                            className="form-select"
                            value={form.subject_id}
                            onChange={(e) => handleSubjectChange(e.target.value)}
                            required
                          >
                            {subjects.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name} ({s.code})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="col-md-6">
                          <label className="form-label fw-semibold small text-secondary">
                            Target Class / Program <span className="text-danger">*</span>
                          </label>
                          <select
                            className="form-select"
                            value={form.class_id}
                            onChange={(e) => setForm({ ...form, class_id: e.target.value, batch_id: '' })}
                            required
                          >
                            {classes.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name} ({c.code})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="row g-3">
                        <div className="col-md-6">
                          <label className="form-label fw-semibold small text-secondary">
                            Cohort / Batch (Optional)
                          </label>
                          <select
                            className="form-select"
                            value={form.batch_id}
                            onChange={(e) => setForm({ ...form, batch_id: e.target.value })}
                          >
                            <option value="">All Batches in Class</option>
                            {currentClassBatches.map((b) => (
                              <option key={b.id} value={b.id}>
                                {b.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="col-md-6">
                          <label className="form-label fw-semibold small text-secondary">Short Description</label>
                          <input
                            type="text"
                            className="form-control"
                            placeholder="e.g. Units 1 to 4 Comprehensive Evaluation"
                            value={form.description}
                            onChange={(e) => setForm({ ...form, description: e.target.value })}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="form-label fw-semibold small text-secondary">Candidate Instructions</label>
                        <textarea
                          className="form-control font-monospace"
                          rows="3"
                          style={{ fontSize: '0.85rem' }}
                          value={form.instructions}
                          onChange={(e) => setForm({ ...form, instructions: e.target.value })}
                        ></textarea>
                      </div>
                    </div>
                  )}

                  {/* STEP 2: Timing & Scoring Rules */}
                  {modalStep === 2 && (
                    <div className="vstack gap-3">
                      <div className="row g-3">
                        <div className="col-md-4">
                          <label className="form-label fw-semibold small text-secondary">
                            Exam Date <span className="text-danger">*</span>
                          </label>
                          <input
                            type="date"
                            className="form-control"
                            value={form.exam_date}
                            onChange={(e) => setForm({ ...form, exam_date: e.target.value })}
                            required
                          />
                        </div>

                        <div className="col-md-4">
                          <label className="form-label fw-semibold small text-secondary">
                            Start Time <span className="text-danger">*</span>
                          </label>
                          <input
                            type="time"
                            className="form-control"
                            value={form.start_time}
                            onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                            required
                          />
                        </div>

                        <div className="col-md-4">
                          <label className="form-label fw-semibold small text-secondary">
                            End Time <span className="text-danger">*</span>
                          </label>
                          <input
                            type="time"
                            className="form-control"
                            value={form.end_time}
                            onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                            required
                          />
                        </div>
                      </div>

                      <div className="row g-3">
                        <div className="col-md-4">
                          <label className="form-label fw-semibold small text-secondary">
                            Duration (Minutes) <span className="text-danger">*</span>
                          </label>
                          <input
                            type="number"
                            min="10"
                            max="360"
                            className="form-control"
                            value={form.duration_minutes}
                            onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })}
                            required
                          />
                        </div>

                        <div className="col-md-4">
                          <label className="form-label fw-semibold small text-secondary">
                            Total Questions <span className="text-danger">*</span>
                          </label>
                          <input
                            type="number"
                            min="1"
                            className="form-control"
                            value={form.total_questions}
                            onChange={(e) => {
                              const val = e.target.value;
                              const tMarks = parseFloat(val || 0) * parseFloat(form.marks_per_question || 1);
                              setForm({ ...form, total_questions: val, total_marks: tMarks });
                            }}
                            required
                          />
                        </div>

                        <div className="col-md-4">
                          <label className="form-label fw-semibold small text-secondary">
                            Marks per Question
                          </label>
                          <input
                            type="number"
                            step="0.5"
                            className="form-control"
                            value={form.marks_per_question}
                            onChange={(e) => {
                              const val = e.target.value;
                              const tMarks = parseFloat(form.total_questions || 0) * parseFloat(val || 1);
                              setForm({ ...form, marks_per_question: val, total_marks: tMarks });
                            }}
                            required
                          />
                        </div>
                      </div>

                      <div className="row g-3">
                        <div className="col-md-4">
                          <label className="form-label fw-semibold small text-secondary">
                            Calculated Total Marks
                          </label>
                          <input
                            type="number"
                            className="form-control bg-light fw-bold text-primary"
                            value={form.total_marks}
                            readOnly
                          />
                        </div>

                        <div className="col-md-4">
                          <label className="form-label fw-semibold small text-secondary">
                            Negative Marking Penalty
                          </label>
                          <input
                            type="number"
                            step="0.25"
                            min="0"
                            className="form-control"
                            value={form.negative_marking}
                            onChange={(e) => setForm({ ...form, negative_marking: e.target.value })}
                            required
                          />
                        </div>

                        <div className="col-md-4">
                          <label className="form-label fw-semibold small text-secondary">
                            Passing Percentage (%)
                          </label>
                          <input
                            type="number"
                            min="10"
                            max="100"
                            className="form-control"
                            value={form.passing_percentage}
                            onChange={(e) => setForm({ ...form, passing_percentage: e.target.value })}
                            required
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* STEP 3: Question Selection Mode (Section 7 Options A, B, C) */}
                  {modalStep === 3 && (
                    <div className="vstack gap-3">
                      <label className="form-label fw-bold text-dark mb-0">
                        Select Question Assignment Mechanism (Section 7 Compliant):
                      </label>

                      <div className="row g-3">
                        {/* Option A */}
                        <div className="col-md-4">
                          <div
                            className={`p-3 rounded-3 border h-100 cursor-pointer ${
                              form.selection_mode === 'manual_fixed'
                                ? 'border-primary bg-primary-subtle bg-opacity-25'
                                : 'bg-light'
                            }`}
                            onClick={() => setForm({ ...form, selection_mode: 'manual_fixed' })}
                            style={{ cursor: 'pointer' }}
                          >
                            <div className="form-check">
                              <input
                                className="form-check-input"
                                type="radio"
                                name="selectionModeRadio"
                                id="modeA"
                                checked={form.selection_mode === 'manual_fixed'}
                                onChange={() => setForm({ ...form, selection_mode: 'manual_fixed' })}
                              />
                              <label className="form-check-label fw-bold small text-dark" htmlFor="modeA">
                                Option A: Manual Fixed
                              </label>
                            </div>
                            <p className="text-muted small mt-2 mb-0" style={{ fontSize: '0.78rem' }}>
                              Manually choose specific questions from the pool. Every candidate receives identical questions in this exact order.
                            </p>
                          </div>
                        </div>

                        {/* Option B */}
                        <div className="col-md-4">
                          <div
                            className={`p-3 rounded-3 border h-100 cursor-pointer ${
                              form.selection_mode === 'random_fixed_pool'
                                ? 'border-primary bg-primary-subtle bg-opacity-25'
                                : 'bg-light'
                            }`}
                            onClick={() => setForm({ ...form, selection_mode: 'random_fixed_pool' })}
                            style={{ cursor: 'pointer' }}
                          >
                            <div className="form-check">
                              <input
                                className="form-check-input"
                                type="radio"
                                name="selectionModeRadio"
                                id="modeB"
                                checked={form.selection_mode === 'random_fixed_pool'}
                                onChange={() => setForm({ ...form, selection_mode: 'random_fixed_pool' })}
                              />
                              <label className="form-check-label fw-bold small text-dark" htmlFor="modeB">
                                Option B: Random Fixed Pool
                              </label>
                            </div>
                            <p className="text-muted small mt-2 mb-0" style={{ fontSize: '0.78rem' }}>
                              Securely draws {form.total_questions} questions randomly on the server. All candidates receive this identical randomized set.
                            </p>
                          </div>
                        </div>

                        {/* Option C */}
                        <div className="col-md-4">
                          <div
                            className={`p-3 rounded-3 border h-100 cursor-pointer ${
                              form.selection_mode === 'random_per_student'
                                ? 'border-primary bg-primary-subtle bg-opacity-25'
                                : 'bg-light'
                            }`}
                            onClick={() => setForm({ ...form, selection_mode: 'random_per_student' })}
                            style={{ cursor: 'pointer' }}
                          >
                            <div className="form-check">
                              <input
                                className="form-check-input"
                                type="radio"
                                name="selectionModeRadio"
                                id="modeC"
                                checked={form.selection_mode === 'random_per_student'}
                                onChange={() => setForm({ ...form, selection_mode: 'random_per_student' })}
                              />
                              <label className="form-check-label fw-bold small text-dark" htmlFor="modeC">
                                Option C: Random Per Student
                              </label>
                            </div>
                            <p className="text-muted small mt-2 mb-0" style={{ fontSize: '0.78rem' }}>
                              Every student receives an independently randomized subset of questions from the question bank. Maximum anti-cheating protection.
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Manual Selector if Option A chosen */}
                      {form.selection_mode === 'manual_fixed' && (
                        <div className="mt-3 p-3 border rounded-3 bg-white">
                          <div className="d-flex justify-content-between align-items-center mb-2">
                            <span className="fw-semibold small text-dark">
                              Select Questions from Repository ({selectedManualQIds.length} Selected):
                            </span>
                            <span className="text-muted small">
                              Pool Available: {poolQuestions.length} Questions
                            </span>
                          </div>

                          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                            {poolQuestions.map((q) => (
                              <div
                                key={q.id}
                                className={`d-flex align-items-center gap-2 p-2 border-bottom small ${
                                  selectedManualQIds.includes(q.id) ? 'bg-primary-subtle' : ''
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  className="form-check-input"
                                  checked={selectedManualQIds.includes(q.id)}
                                  onChange={() => toggleManualQuestion(q.id)}
                                />
                                <span className="fw-semibold">#{q.id}</span>
                                <span className="text-truncate flex-grow-1">{q.question_text}</span>
                                <span className="badge bg-light text-secondary border">
                                  {q.difficulty_level}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Modal Navigation Buttons */}
                <div className="modal-footer border-top py-2 d-flex justify-content-between">
                  {modalStep > 1 ? (
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm"
                      onClick={() => setModalStep(modalStep - 1)}
                    >
                      <i className="bi bi-chevron-left me-1"></i> Back
                    </button>
                  ) : (
                    <div></div>
                  )}

                  <div className="d-flex gap-2">
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm"
                      onClick={() => setShowModal(false)}
                    >
                      Cancel
                    </button>

                    {modalStep < 3 ? (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm px-4 fw-semibold"
                        onClick={() => setModalStep(modalStep + 1)}
                      >
                        Next Step <i className="bi bi-chevron-right ms-1"></i>
                      </button>
                    ) : (
                      <button
                        type="submit"
                        className="btn btn-success btn-sm px-4 fw-semibold"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          <>
                            <span className="spinner-border spinner-border-sm me-1"></span>
                            Creating...
                          </>
                        ) : (
                          <>
                            <i className="bi bi-check-circle me-1"></i> Confirm & Schedule Exam
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* VIEW DETAILS MODAL */}
      {showDetailsModal && selectedExamDetails && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)' }} tabIndex="-1">
          <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
            <div className="modal-content shadow-lg border-0 rounded-4">
              <div className="modal-header border-bottom py-3">
                <div>
                  <h5 className="modal-title fw-bold text-dark">{selectedExamDetails.title}</h5>
                  <small className="text-muted">
                    {selectedExamDetails.subject?.name} • {selectedExamDetails.class?.name}
                  </small>
                </div>
                <button type="button" className="btn-close" onClick={() => setShowDetailsModal(false)}></button>
              </div>

              <div className="modal-body p-4">
                <div className="row g-3 mb-4">
                  <div className="col-md-3">
                    <div className="p-2 border rounded bg-light text-center">
                      <small className="text-muted d-block">Duration</small>
                      <span className="fw-bold">{selectedExamDetails.duration_minutes} Mins</span>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="p-2 border rounded bg-light text-center">
                      <small className="text-muted d-block">Total Marks</small>
                      <span className="fw-bold text-primary">{selectedExamDetails.total_marks}</span>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="p-2 border rounded bg-light text-center">
                      <small className="text-muted d-block">Selection Mode</small>
                      <span className="fw-bold text-capitalize">{selectedExamDetails.selection_mode.replace(/_/g, ' ')}</span>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="p-2 border rounded bg-light text-center">
                      <small className="text-muted d-block">Assigned Students</small>
                      <span className="fw-bold text-success">{selectedExamDetails.assignments?.length || 0}</span>
                    </div>
                  </div>
                </div>

                <h6 className="fw-bold text-dark mb-2">Instructions</h6>
                <div className="p-3 bg-light rounded-3 font-monospace small mb-4">
                  {selectedExamDetails.instructions}
                </div>

                <h6 className="fw-bold text-dark mb-2">Candidate Roster ({selectedExamDetails.assignments?.length || 0})</h6>
                <div style={{ maxHeight: '180px', overflowY: 'auto' }} className="border rounded table-responsive">
                  <table className="table table-sm mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Candidate Name</th>
                        <th>Email / Username</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedExamDetails.assignments?.map((a) => (
                        <tr key={a.id}>
                          <td className="fw-semibold">{a.student?.user?.name || 'Student'}</td>
                          <td className="text-muted">{a.student?.user?.email}</td>
                          <td>
                            <span className="badge bg-secondary-subtle text-secondary">{a.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="modal-footer border-top py-2">
                <button className="btn btn-outline-secondary btn-sm" onClick={() => setShowDetailsModal(false)}>
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

export default ExamManagement;
