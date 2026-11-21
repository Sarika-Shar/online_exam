import React, { useState, useEffect } from 'react';
import { questionService } from '../../services/questionService';
import { academicService } from '../../services/academicService';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const QuestionBank = () => {
  // Academic Context
  const [subjects, setSubjects] = useState([]);
  const [questionBanks, setQuestionBanks] = useState([]);
  const [topics, setTopics] = useState([]);

  // Filter States
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedQuestionBank, setSelectedQuestionBank] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState('all');
  const [selectedLanguage, setSelectedLanguage] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Data States
  const [questions, setQuestions] = useState([]);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState({ total: 0, easy: 0, medium: 0, hard: 0 });
  const [loading, setLoading] = useState(true);

  // Selection & Bulk Actions
  const [selectedIds, setSelectedIds] = useState([]);

  // Modal State for Add / Edit
  const [showModal, setShowModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [modalForm, setModalForm] = useState({
    subject_id: '',
    question_bank_id: '',
    topic: '',
    difficulty_level: 'medium',
    question_text: '',
    marks: 1.0,
    negative_marks: 0.0,
    explanation: '',
    language: 'en',
    options: [
      { option_key: 'A', option_text: '', is_correct: true },
      { option_key: 'B', option_text: '', is_correct: false },
      { option_key: 'C', option_text: '', is_correct: false },
      { option_key: 'D', option_text: '', is_correct: false }
    ]
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Alerts
  const [alert, setAlert] = useState(null);

  // Initial Load: Subjects and Question Banks
  useEffect(() => {
    loadAcademicData();
  }, []);

  // Fetch Questions and Stats when filters or page change
  useEffect(() => {
    fetchQuestions();
    fetchStats();
    fetchTopics();
  }, [selectedSubject, selectedQuestionBank, selectedTopic, selectedDifficulty, selectedLanguage, currentPage, pageSize]);

  const loadAcademicData = async () => {
    try {
      const subjRes = await academicService.getSubjects();
      if (subjRes.success && subjRes.data.length > 0) {
        setSubjects(subjRes.data);
      }
    } catch (err) {
      console.error('Failed to load subjects:', err);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await questionService.getQuestionStats(selectedSubject || null);
      if (res.success) {
        setStats(res.data);
      }
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  const fetchTopics = async () => {
    try {
      const res = await questionService.getTopics(selectedSubject || null);
      if (res.success) {
        setTopics(res.data);
      }
    } catch {
      setTopics([]);
    }
  };

  const fetchQuestions = async () => {
    try {
      setLoading(true);
      const params = {
        page: currentPage,
        limit: pageSize,
        ...(selectedSubject && { subject_id: selectedSubject }),
        ...(selectedQuestionBank && { question_bank_id: selectedQuestionBank }),
        ...(selectedTopic !== 'all' && { topic: selectedTopic }),
        ...(selectedDifficulty !== 'all' && { difficulty_level: selectedDifficulty }),
        ...(selectedLanguage !== 'all' && { language: selectedLanguage }),
        ...(searchTerm.trim() && { search: searchTerm.trim() })
      };

      const res = await questionService.getQuestions(params);
      if (res.success) {
        setQuestions(res.data.questions);
        setTotalQuestions(res.data.total);
        setTotalPages(res.data.totalPages);
      }
    } catch (err) {
      setAlert({ type: 'danger', message: 'Failed to fetch questions from database.' });
    } finally {
      setLoading(false);
    }
  };

  // Handle Search submit
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchQuestions();
  };

  // Selection Checkbox Handlers
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(questions.map((q) => q.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  // Bulk Delete
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (
      !window.confirm(
        `Are you sure you want to permanently delete the ${selectedIds.length} selected question(s)?`
      )
    ) {
      return;
    }

    try {
      const res = await questionService.bulkDeleteQuestions(selectedIds);
      if (res.success) {
        setAlert({ type: 'success', message: res.message });
        setSelectedIds([]);
        fetchQuestions();
        fetchStats();
      }
    } catch (err) {
      setAlert({
        type: 'danger',
        message: err.response?.data?.message || 'Bulk delete operation failed.'
      });
    }
  };

  // Delete Single Question
  const handleDeleteSingle = async (id, title) => {
    if (!window.confirm(`Are you sure you want to delete question: "${title.slice(0, 40)}..."?`)) {
      return;
    }

    try {
      const res = await questionService.deleteQuestion(id);
      if (res.success) {
        setAlert({ type: 'success', message: 'Question deleted successfully.' });
        fetchQuestions();
        fetchStats();
      }
    } catch (err) {
      setAlert({
        type: 'danger',
        message: err.response?.data?.message || 'Failed to delete question.'
      });
    }
  };

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setEditingQuestion(null);
    const defaultSubjectId = selectedSubject || (subjects.length > 0 ? subjects[0].id : '');
    const selectedSubj = subjects.find((s) => String(s.id) === String(defaultSubjectId));
    setModalForm({
      institution_id: selectedSubj ? selectedSubj.institution_id : '',
      subject_id: defaultSubjectId,
      question_bank_id: selectedQuestionBank || '',
      topic: '',
      difficulty_level: 'medium',
      question_text: '',
      marks: 1.0,
      negative_marks: 0.0,
      explanation: '',
      language: 'en',
      options: [
        { option_key: 'A', option_text: '', is_correct: true },
        { option_key: 'B', option_text: '', is_correct: false },
        { option_key: 'C', option_text: '', is_correct: false },
        { option_key: 'D', option_text: '', is_correct: false }
      ]
    });
    setShowModal(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (q) => {
    setEditingQuestion(q);
    const sortedOptions = ['A', 'B', 'C', 'D'].map((key) => {
      const found = q.options ? q.options.find((o) => o.option_key === key) : null;
      return {
        id: found?.id,
        option_key: key,
        option_text: found ? found.option_text : '',
        is_correct: found ? found.is_correct : false
      };
    });

    setModalForm({
      subject_id: q.subject_id,
      question_bank_id: q.question_bank_id || '',
      topic: q.topic || '',
      difficulty_level: q.difficulty_level || 'medium',
      question_text: q.question_text || '',
      marks: q.marks || 1.0,
      negative_marks: q.negative_marks || 0.0,
      explanation: q.explanation || '',
      language: q.language || 'en',
      options: sortedOptions
    });
    setShowModal(true);
  };

  // Modal Form Option Handlers
  const handleModalOptionTextChange = (key, text) => {
    const updated = modalForm.options.map((opt) =>
      opt.option_key === key ? { ...opt, option_text: text } : opt
    );
    setModalForm({ ...modalForm, options: updated });
  };

  const handleModalCorrectAnswerChange = (key) => {
    const updated = modalForm.options.map((opt) => ({
      ...opt,
      is_correct: opt.option_key === key
    }));
    setModalForm({ ...modalForm, options: updated });
  };

  // Save Modal Form
  const handleSaveModal = async (e) => {
    e.preventDefault();
    if (!modalForm.question_text.trim()) {
      setAlert({ type: 'warning', message: 'Question text cannot be blank.' });
      return;
    }

    const hasEmptyOption = modalForm.options.some((o) => !o.option_text.trim());
    if (hasEmptyOption) {
      setAlert({ type: 'warning', message: 'All four options (A, B, C, D) must have text.' });
      return;
    }

    const hasCorrect = modalForm.options.some((o) => o.is_correct === true);
    if (!hasCorrect) {
      setAlert({ type: 'warning', message: 'Please designate one option as the correct answer.' });
      return;
    }

    try {
      setIsSubmitting(true);
      if (editingQuestion) {
        const res = await questionService.updateQuestion(editingQuestion.id, modalForm);
        if (res.success) {
          setAlert({ type: 'success', message: 'Question updated successfully.' });
          setShowModal(false);
          fetchQuestions();
          fetchStats();
        }
      } else {
        const res = await questionService.createQuestion(modalForm);
        if (res.success) {
          setAlert({ type: 'success', message: 'Question created successfully in Question Bank.' });
          setShowModal(false);
          fetchQuestions();
          fetchStats();
        }
      }
    } catch (err) {
      const errorMsg =
        err.response?.data?.errors?.length
          ? err.response.data.errors.join(', ')
          : err.response?.data?.message || 'Failed to save question.';
      setAlert({
        type: 'danger',
        message: errorMsg
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container-fluid py-4 px-3 px-md-4">
      {/* Header with Title and Create Button */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center pb-3 mb-4 border-bottom gap-3">
        <div>
          <span className="badge bg-primary-subtle text-primary border border-primary-subtle mb-1">
            Phase 3: Academic Repositories
          </span>
          <h2 className="fw-bold text-dark mb-1">Question Bank Management</h2>
          <p className="text-muted mb-0 small">
            Subject-wise categorization, difficulty levels (Easy, Medium, Hard), search & filtering, and secure correct answers.
          </p>
        </div>

        <div className="d-flex align-items-center gap-2">
          <button className="btn btn-primary fw-semibold shadow-sm d-flex align-items-center gap-2" onClick={handleOpenCreateModal}>
            <i className="bi bi-plus-circle-fill"></i>
            <span>Add New Question</span>
          </button>
        </div>
      </div>

      {/* Metrics Banner */}
      <div className="row g-3 mb-4">
        <div className="col-6 col-md-3">
          <div className="card-custom bg-white p-3 border-start border-primary border-4">
            <div className="text-muted small text-uppercase fw-semibold">Total Questions</div>
            <h3 className="fw-bold text-dark mb-0">{stats.total}</h3>
          </div>
        </div>

        <div className="col-6 col-md-3">
          <div className="card-custom bg-white p-3 border-start border-success border-4">
            <div className="text-muted small text-uppercase fw-semibold">Easy Questions</div>
            <h3 className="fw-bold text-success mb-0">{stats.easy}</h3>
          </div>
        </div>

        <div className="col-6 col-md-3">
          <div className="card-custom bg-white p-3 border-start border-warning border-4">
            <div className="text-muted small text-uppercase fw-semibold">Medium Questions</div>
            <h3 className="fw-bold text-warning mb-0">{stats.medium}</h3>
          </div>
        </div>

        <div className="col-6 col-md-3">
          <div className="card-custom bg-white p-3 border-start border-danger border-4">
            <div className="text-muted small text-uppercase fw-semibold">Hard Questions</div>
            <h3 className="fw-bold text-danger mb-0">{stats.hard}</h3>
          </div>
        </div>
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

      {/* Filter and Search Bar */}
      <div className="card-custom bg-white p-3 mb-4">
        <form onSubmit={handleSearchSubmit} className="row g-2 align-items-center">
          {/* Search Term */}
          <div className="col-12 col-md-3">
            <div className="input-group input-group-sm">
              <span className="input-group-text bg-light text-muted">
                <i className="bi bi-search"></i>
              </span>
              <input
                type="text"
                className="form-control"
                placeholder="Search question text or topic..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Subject Filter */}
          <div className="col-6 col-md-2">
            <select
              className="form-select form-select-sm bg-light"
              value={selectedSubject}
              onChange={(e) => {
                setSelectedSubject(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="">All Subjects</option>
              {subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.name}
                </option>
              ))}
            </select>
          </div>

          {/* Topic Filter */}
          <div className="col-6 col-md-2">
            <select
              className="form-select form-select-sm bg-light"
              value={selectedTopic}
              onChange={(e) => {
                setSelectedTopic(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="all">All Topics</option>
              {topics.map((t, idx) => (
                <option key={idx} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* Difficulty Filter */}
          <div className="col-6 col-md-2">
            <select
              className="form-select form-select-sm bg-light"
              value={selectedDifficulty}
              onChange={(e) => {
                setSelectedDifficulty(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="all">All Difficulties</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>

          {/* Language Filter */}
          <div className="col-6 col-md-2">
            <select
              className="form-select form-select-sm bg-light"
              value={selectedLanguage}
              onChange={(e) => {
                setSelectedLanguage(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="all">All Languages</option>
              <option value="en">English (EN)</option>
              <option value="hi">Hindi (HI)</option>
            </select>
          </div>

          {/* Search Button */}
          <div className="col-12 col-md-1 text-end">
            <button type="submit" className="btn btn-outline-primary btn-sm w-100">
              Filter
            </button>
          </div>
        </form>
      </div>

      {/* Bulk Selection Actions Bar */}
      {selectedIds.length > 0 && (
        <div className="alert alert-primary d-flex align-items-center justify-content-between p-2 px-3 mb-3 shadow-sm rounded-3">
          <div className="d-flex align-items-center gap-2">
            <span className="badge bg-primary fs-6">{selectedIds.length}</span>
            <span className="fw-semibold small">Question(s) selected for bulk operations</span>
          </div>

          <div className="d-flex align-items-center gap-2">
            <button className="btn btn-danger btn-sm py-1 d-flex align-items-center gap-1" onClick={handleBulkDelete}>
              <i className="bi bi-trash"></i> Delete Selected ({selectedIds.length})
            </button>
            <button className="btn btn-outline-secondary btn-sm py-1" onClick={() => setSelectedIds([])}>
              Deselect All
            </button>
          </div>
        </div>
      )}

      {/* Questions List */}
      <div className="card-custom bg-white p-0 overflow-hidden mb-4">
        {loading ? (
          <div className="py-5">
            <LoadingSpinner message="Loading Question Bank repository..." />
          </div>
        ) : questions.length === 0 ? (
          <div className="text-center py-5">
            <i className="bi bi-journal-x fs-1 text-muted opacity-50 d-block mb-2"></i>
            <h5 className="text-dark fw-bold mb-1">No Questions Found</h5>
            <p className="text-muted small mb-3">
              No questions matched your search criteria or none have been added to this subject yet.
            </p>
            <button className="btn btn-primary btn-sm" onClick={handleOpenCreateModal}>
              <i className="bi bi-plus-circle me-1"></i> Add First Question
            </button>
          </div>
        ) : (
          <div>
            {/* Table Header with Select All */}
            <div className="p-3 bg-light border-bottom d-flex align-items-center justify-content-between">
              <div className="form-check mb-0">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="selectAllCheckbox"
                  checked={selectedIds.length === questions.length && questions.length > 0}
                  onChange={handleSelectAll}
                />
                <label className="form-check-label fw-semibold text-secondary small" htmlFor="selectAllCheckbox">
                  Select All on Page ({questions.length})
                </label>
              </div>

              <span className="text-muted small">
                Showing {questions.length} of {totalQuestions} questions
              </span>
            </div>

            {/* Questions Table / List */}
            <div className="vstack gap-0">
              {questions.map((q, idx) => {
                const isSelected = selectedIds.includes(q.id);
                const correctOpt = q.options ? q.options.find((o) => o.is_correct) : null;

                const difficultyClass =
                  q.difficulty_level === 'easy'
                    ? 'bg-success-subtle text-success border border-success-subtle'
                    : q.difficulty_level === 'hard'
                    ? 'bg-danger-subtle text-danger border border-danger-subtle'
                    : 'bg-warning-subtle text-warning border border-warning-subtle';

                return (
                  <div
                    key={q.id}
                    className={`p-3 border-bottom ${isSelected ? 'bg-primary-subtle bg-opacity-25' : 'bg-white'}`}
                  >
                    <div className="d-flex align-items-start gap-3">
                      {/* Checkbox */}
                      <div className="form-check pt-1">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectOne(q.id)}
                        />
                      </div>

                      {/* Question Details */}
                      <div className="flex-grow-1">
                        {/* Meta Tags */}
                        <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
                          <span className="badge bg-light text-dark border fw-medium small">
                            #{q.id}
                          </span>
                          <span className="badge bg-primary-subtle text-primary border border-primary-subtle small">
                            {q.subject?.name || 'Subject'}
                          </span>
                          <span className="badge bg-secondary-subtle text-secondary border border-secondary-subtle small">
                            Topic: {q.topic || 'General'}
                          </span>
                          <span className={`badge text-uppercase small ${difficultyClass}`}>
                            {q.difficulty_level}
                          </span>
                          <span className="badge bg-light text-secondary border small">
                            Lang: {q.language?.toUpperCase() || 'EN'}
                          </span>
                          <span className="text-muted small">
                            Marks: +{q.marks} | Neg: -{q.negative_marks}
                          </span>
                        </div>

                        {/* Question Text */}
                        <h6 className="fw-semibold text-dark mb-2 lh-base">
                          {q.question_text}
                        </h6>

                        {/* Options Grid (4 columns) */}
                        <div className="row g-2 mb-2">
                          {['A', 'B', 'C', 'D'].map((key) => {
                            const opt = q.options ? q.options.find((o) => o.option_key === key) : null;
                            const isCorrect = opt ? opt.is_correct : false;

                            return (
                              <div key={key} className="col-12 col-md-6 col-lg-3">
                                <div
                                  className={`p-2 rounded-2 small ${
                                    isCorrect
                                      ? 'border border-success bg-success-subtle bg-opacity-50 text-dark fw-bold'
                                      : 'bg-light text-secondary border'
                                  }`}
                                  style={{ fontSize: '0.82rem' }}
                                >
                                  <span className={`badge ${isCorrect ? 'bg-success' : 'bg-secondary'} me-1`}>
                                    {key}
                                  </span>
                                  {opt ? opt.option_text : '-'}
                                  {isCorrect && (
                                    <span className="text-success ms-1">✓ Correct</span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Explanation if present */}
                        {q.explanation && (
                          <div className="text-muted small fst-italic">
                            <i className="bi bi-lightbulb-fill text-warning me-1"></i>
                            <strong>Explanation:</strong> {q.explanation}
                          </div>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="d-flex align-items-center gap-1 flex-shrink-0">
                        <button
                          className="btn btn-outline-secondary btn-sm p-1 px-2"
                          title="Edit Question"
                          onClick={() => handleOpenEditModal(q)}
                        >
                          <i className="bi bi-pencil-square"></i>
                        </button>
                        <button
                          className="btn btn-outline-danger btn-sm p-1 px-2"
                          title="Delete Question"
                          onClick={() => handleDeleteSingle(q.id, q.question_text)}
                        >
                          <i className="bi bi-trash"></i>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination Controls */}
            <div className="p-3 bg-light d-flex flex-column flex-sm-row justify-content-between align-items-center gap-3">
              <div className="d-flex align-items-center gap-2 small text-muted">
                <span>Rows per page:</span>
                <select
                  className="form-select form-select-sm"
                  style={{ width: '75px' }}
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(parseInt(e.target.value, 10));
                    setCurrentPage(1);
                  }}
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
                <span>Total: {totalQuestions} items</span>
              </div>

              <div className="d-flex align-items-center gap-2">
                <button
                  className="btn btn-outline-secondary btn-sm"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage(currentPage - 1)}
                >
                  <i className="bi bi-chevron-left me-1"></i> Prev
                </button>
                <span className="small fw-semibold px-2">
                  Page {currentPage} of {totalPages || 1}
                </span>
                <button
                  className="btn btn-outline-secondary btn-sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(currentPage + 1)}
                >
                  Next <i className="bi bi-chevron-right ms-1"></i>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ADD / EDIT QUESTION MODAL */}
      {showModal && (
        <div
          className="modal fade show d-block"
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)' }}
          tabIndex="-1"
          role="dialog"
        >
          <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable" role="document">
            <div className="modal-content shadow-lg border-0 rounded-4">
              <div className="modal-header border-bottom py-3">
                <h5 className="modal-title fw-bold text-dark">
                  <i className={`bi ${editingQuestion ? 'bi-pencil-square text-warning' : 'bi-plus-circle text-primary'} me-2`}></i>
                  {editingQuestion ? 'Edit Question' : 'Create New MCQ Question'}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowModal(false)}
                  aria-label="Close"
                ></button>
              </div>

              <form onSubmit={handleSaveModal}>
                <div className="modal-body p-4">
                  {/* Subject, Question Bank, Topic Row */}
                  <div className="row g-3 mb-3">
                    <div className="col-md-6">
                      <label className="form-label fw-semibold small text-secondary">
                        Subject <span className="text-danger">*</span>
                      </label>
                      <select
                        className="form-select"
                        value={modalForm.subject_id}
                        onChange={(e) => {
                          const sId = e.target.value;
                          const selectedSubj = subjects.find((s) => String(s.id) === String(sId));
                          setModalForm({
                            ...modalForm,
                            subject_id: sId,
                            institution_id: selectedSubj ? selectedSubj.institution_id : modalForm.institution_id
                          });
                        }}
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
                      <label className="form-label fw-semibold small text-secondary">Topic Category</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. Binary Search Trees"
                        value={modalForm.topic}
                        onChange={(e) => setModalForm({ ...modalForm, topic: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Difficulty, Language, Marks, Negative Marks */}
                  <div className="row g-3 mb-3">
                    <div className="col-md-3">
                      <label className="form-label fw-semibold small text-secondary">Difficulty Level</label>
                      <select
                        className="form-select"
                        value={modalForm.difficulty_level}
                        onChange={(e) => setModalForm({ ...modalForm, difficulty_level: e.target.value })}
                      >
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard</option>
                      </select>
                    </div>

                    <div className="col-md-3">
                      <label className="form-label fw-semibold small text-secondary">Language</label>
                      <select
                        className="form-select"
                        value={modalForm.language}
                        onChange={(e) => setModalForm({ ...modalForm, language: e.target.value })}
                      >
                        <option value="en">English (EN)</option>
                        <option value="hi">Hindi (HI)</option>
                      </select>
                    </div>

                    <div className="col-md-3">
                      <label className="form-label fw-semibold small text-secondary">Marks Awarded</label>
                      <input
                        type="number"
                        step="0.5"
                        min="0.5"
                        className="form-control"
                        value={modalForm.marks}
                        onChange={(e) => setModalForm({ ...modalForm, marks: e.target.value })}
                        required
                      />
                    </div>

                    <div className="col-md-3">
                      <label className="form-label fw-semibold small text-secondary">Negative Mark Penalty</label>
                      <input
                        type="number"
                        step="0.25"
                        min="0"
                        className="form-control"
                        value={modalForm.negative_marks}
                        onChange={(e) => setModalForm({ ...modalForm, negative_marks: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  {/* Question Text */}
                  <div className="mb-4">
                    <label className="form-label fw-semibold small text-secondary">
                      Question Statement / Text <span className="text-danger">*</span>
                    </label>
                    <textarea
                      className="form-control"
                      rows="3"
                      placeholder="Type the MCQ question text here..."
                      value={modalForm.question_text}
                      onChange={(e) => setModalForm({ ...modalForm, question_text: e.target.value })}
                      required
                    ></textarea>
                  </div>

                  {/* 4 Options Grid with Correct Option Radio */}
                  <div className="mb-4">
                    <label className="form-label fw-semibold small text-secondary d-flex justify-content-between align-items-center">
                      <span>Four Options & Designated Correct Answer <span className="text-danger">*</span></span>
                      <small className="text-muted">Select the radio button of the correct answer</small>
                    </label>

                    <div className="row g-3">
                      {['A', 'B', 'C', 'D'].map((key) => {
                        const opt = modalForm.options.find((o) => o.option_key === key);
                        const isCorrect = opt ? opt.is_correct : false;

                        return (
                          <div key={key} className="col-md-6">
                            <div className={`p-3 rounded-3 border ${isCorrect ? 'border-success bg-success-subtle bg-opacity-25' : 'bg-light'}`}>
                              <div className="d-flex align-items-center justify-content-between mb-2">
                                <span className={`badge ${isCorrect ? 'bg-success' : 'bg-secondary'} px-2 py-1`}>
                                  Option {key}
                                </span>
                                <div className="form-check">
                                  <input
                                    className="form-check-input"
                                    type="radio"
                                    name="modalCorrectOption"
                                    id={`modal_radio_${key}`}
                                    checked={isCorrect}
                                    onChange={() => handleModalCorrectAnswerChange(key)}
                                  />
                                  <label
                                    className={`form-check-label small fw-semibold ${isCorrect ? 'text-success' : 'text-muted'}`}
                                    htmlFor={`modal_radio_${key}`}
                                  >
                                    {isCorrect ? '✓ Correct Answer' : 'Set as Correct'}
                                  </label>
                                </div>
                              </div>
                              <input
                                type="text"
                                className="form-control form-control-sm"
                                placeholder={`Enter Option ${key} text...`}
                                value={opt ? opt.option_text : ''}
                                onChange={(e) => handleModalOptionTextChange(key, e.target.value)}
                                required
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Explanation */}
                  <div className="mb-2">
                    <label className="form-label fw-semibold small text-secondary">
                      Explanation / Solution Notes (Optional)
                    </label>
                    <textarea
                      className="form-control form-control-sm"
                      rows="2"
                      placeholder="Explain why this answer is correct..."
                      value={modalForm.explanation}
                      onChange={(e) => setModalForm({ ...modalForm, explanation: e.target.value })}
                    ></textarea>
                  </div>
                </div>

                <div className="modal-footer border-top py-2">
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() => setShowModal(false)}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm px-4 fw-semibold"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                        Saving...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-save me-1"></i> {editingQuestion ? 'Update Question' : 'Save to Bank'}
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuestionBank;
