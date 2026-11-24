import React, { useState, useEffect, useMemo } from 'react';
import { academicService } from '../../services/academicService';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const AcademicManagement = () => {
  const [activeTab, setActiveTab] = useState('classes'); // 'classes' | 'batches' | 'subjects'

  // Data states
  const [classes, setClasses] = useState([]);
  const [batches, setBatches] = useState([]);
  const [subjects, setSubjects] = useState([]);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClassId, setFilterClassId] = useState('');

  // Modals
  const [showClassModal, setShowClassModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showSubjectModal, setShowSubjectModal] = useState(false);

  const [editingItem, setEditingItem] = useState(null);

  // Forms
  const [classForm, setClassForm] = useState({ name: '', code: '', description: '' });
  const [batchForm, setBatchForm] = useState({ class_id: '', name: '', code: '', start_year: '', end_year: '' });
  const [subjectForm, setSubjectForm] = useState({ name: '', code: '', class_id: '', description: '' });

  // Mobile Accordion state
  const [expandedClassId, setExpandedClassId] = useState(null);
  const [expandedBatchId, setExpandedBatchId] = useState(null);
  const [expandedSubjectId, setExpandedSubjectId] = useState(null);

  const toggleClassAccordion = (id) => {
    setExpandedClassId((prev) => (prev === id ? null : id));
  };
  const toggleBatchAccordion = (id) => {
    setExpandedBatchId((prev) => (prev === id ? null : id));
  };
  const toggleSubjectAccordion = (id) => {
    setExpandedSubjectId((prev) => (prev === id ? null : id));
  };

  useEffect(() => {
    loadAllAcademicData();
  }, []);

  const loadAllAcademicData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [clsRes, bRes, sRes] = await Promise.all([
        academicService.getClasses(),
        academicService.getBatches(),
        academicService.getSubjects()
      ]);

      if (clsRes.success) setClasses(clsRes.data || []);
      if (bRes.success) setBatches(bRes.data || []);
      if (sRes.success) setSubjects(sRes.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load academic records.');
    } finally {
      setLoading(false);
    }
  };

  const showSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  // ----------------------------------------------------
  // CLASS HANDLERS
  // ----------------------------------------------------
  const openAddClassModal = () => {
    setEditingItem(null);
    setClassForm({ name: '', code: '', description: '' });
    setShowClassModal(true);
  };

  const openEditClassModal = (cls) => {
    setEditingItem(cls);
    setClassForm({
      name: cls.name || '',
      code: cls.code || '',
      description: cls.description || ''
    });
    setShowClassModal(true);
  };

  const handleClassSubmit = async (e) => {
    e.preventDefault();
    if (!classForm.name.trim()) {
      setError('Class / Program Name is required.');
      return;
    }

    try {
      setActionLoading(true);
      setError(null);

      if (editingItem) {
        const res = await academicService.updateClass(editingItem.id, classForm);
        if (res.success) {
          showSuccess(`Class "${classForm.name}" updated successfully.`);
          setShowClassModal(false);
          loadAllAcademicData();
        }
      } else {
        const res = await academicService.createClass(classForm);
        if (res.success) {
          showSuccess(`Class "${classForm.name}" created successfully.`);
          setShowClassModal(false);
          loadAllAcademicData();
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save class.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleClass = async (cls) => {
    try {
      setActionLoading(true);
      const res = await academicService.toggleClassStatus(cls.id);
      if (res.success) {
        showSuccess(`Class status changed successfully.`);
        loadAllAcademicData();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to toggle status.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteClass = async (cls) => {
    if (!window.confirm(`Are you sure you want to delete class "${cls.name}"?`)) return;

    try {
      setActionLoading(true);
      const res = await academicService.deleteClass(cls.id);
      if (res.success) {
        showSuccess(`Class "${cls.name}" deleted successfully.`);
        loadAllAcademicData();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete class.');
    } finally {
      setActionLoading(false);
    }
  };

  // ----------------------------------------------------
  // BATCH HANDLERS
  // ----------------------------------------------------
  const openAddBatchModal = () => {
    setEditingItem(null);
    setBatchForm({
      class_id: filterClassId || (classes[0]?.id ? String(classes[0].id) : ''),
      name: '',
      code: '',
      start_year: new Date().getFullYear(),
      end_year: new Date().getFullYear() + 4
    });
    setShowBatchModal(true);
  };

  const openEditBatchModal = (batch) => {
    setEditingItem(batch);
    setBatchForm({
      class_id: String(batch.class_id),
      name: batch.name || '',
      code: batch.code || '',
      start_year: batch.start_year || '',
      end_year: batch.end_year || ''
    });
    setShowBatchModal(true);
  };

  const handleBatchSubmit = async (e) => {
    e.preventDefault();
    if (!batchForm.class_id || !batchForm.name.trim()) {
      setError('Class and Batch Name are required.');
      return;
    }

    try {
      setActionLoading(true);
      setError(null);

      if (editingItem) {
        const res = await academicService.updateBatch(editingItem.id, batchForm);
        if (res.success) {
          showSuccess(`Batch "${batchForm.name}" updated successfully.`);
          setShowBatchModal(false);
          loadAllAcademicData();
        }
      } else {
        const res = await academicService.createBatch(batchForm);
        if (res.success) {
          showSuccess(`Batch "${batchForm.name}" created successfully.`);
          setShowBatchModal(false);
          loadAllAcademicData();
        }
      }
    } catch (err) {
      const errorMsg =
        err.response?.data?.message ||
        (Array.isArray(err.response?.data?.errors) ? err.response.data.errors.join(', ') : null) ||
        err.message ||
        'Failed to save batch.';
      setError(errorMsg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleBatch = async (batch) => {
    try {
      setActionLoading(true);
      const res = await academicService.toggleBatchStatus(batch.id);
      if (res.success) {
        showSuccess(`Batch status changed successfully.`);
        loadAllAcademicData();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to toggle status.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteBatch = async (batch) => {
    if (!window.confirm(`Are you sure you want to delete batch "${batch.name}"?`)) return;

    try {
      setActionLoading(true);
      const res = await academicService.deleteBatch(batch.id);
      if (res.success) {
        showSuccess(`Batch "${batch.name}" deleted successfully.`);
        loadAllAcademicData();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete batch.');
    } finally {
      setActionLoading(false);
    }
  };

  // ----------------------------------------------------
  // SUBJECT HANDLERS
  // ----------------------------------------------------
  const openAddSubjectModal = () => {
    setEditingItem(null);
    setSubjectForm({
      name: '',
      code: '',
      class_id: filterClassId || '',
      description: ''
    });
    setShowSubjectModal(true);
  };

  const openEditSubjectModal = (sub) => {
    setEditingItem(sub);
    setSubjectForm({
      name: sub.name || '',
      code: sub.code || '',
      class_id: sub.class_id ? String(sub.class_id) : '',
      description: sub.description || ''
    });
    setShowSubjectModal(true);
  };

  const handleSubjectSubmit = async (e) => {
    e.preventDefault();
    if (!subjectForm.name.trim()) {
      setError('Subject Name is required.');
      return;
    }

    try {
      setActionLoading(true);
      setError(null);

      const payload = {
        name: subjectForm.name.trim(),
        code: subjectForm.code ? subjectForm.code.trim() : null,
        class_id: subjectForm.class_id ? parseInt(subjectForm.class_id, 10) : null,
        description: subjectForm.description ? subjectForm.description.trim() : null
      };

      if (editingItem) {
        const res = await academicService.updateSubject(editingItem.id, payload);
        if (res.success) {
          showSuccess(`Subject "${payload.name}" updated successfully.`);
          setShowSubjectModal(false);
          loadAllAcademicData();
        }
      } else {
        const res = await academicService.createSubject(payload);
        if (res.success) {
          showSuccess(`Subject "${payload.name}" created successfully.`);
          setShowSubjectModal(false);
          loadAllAcademicData();
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save subject.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleSubject = async (sub) => {
    try {
      setActionLoading(true);
      const res = await academicService.toggleSubjectStatus(sub.id);
      if (res.success) {
        showSuccess(`Subject status updated.`);
        loadAllAcademicData();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to toggle status.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteSubject = async (sub) => {
    if (!window.confirm(`Are you sure you want to delete subject "${sub.name}"?`)) return;

    try {
      setActionLoading(true);
      const res = await academicService.deleteSubject(sub.id);
      if (res.success) {
        showSuccess(`Subject "${sub.name}" deleted successfully.`);
        loadAllAcademicData();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete subject.');
    } finally {
      setActionLoading(false);
    }
  };

  // ----------------------------------------------------
  // FILTERED DATA
  // ----------------------------------------------------
  const filteredClasses = useMemo(() => {
    return classes.filter((c) => {
      return (
        !searchTerm.trim() ||
        c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    });
  }, [classes, searchTerm]);

  const filteredBatches = useMemo(() => {
    return batches.filter((b) => {
      const matchClass = !filterClassId || String(b.class_id) === String(filterClassId);
      const matchSearch =
        !searchTerm.trim() ||
        b.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.class?.name?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchClass && matchSearch;
    });
  }, [batches, filterClassId, searchTerm]);

  const filteredSubjects = useMemo(() => {
    return subjects.filter((s) => {
      const matchClass = !filterClassId || String(s.class_id) === String(filterClassId);
      const matchSearch =
        !searchTerm.trim() ||
        s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.description?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchClass && matchSearch;
    });
  }, [subjects, filterClassId, searchTerm]);

  return (
    <div className="container-fluid py-3 py-md-4 px-2 px-sm-3 px-md-4" style={{ minWidth: 0, maxWidth: '100%', overflowX: 'hidden' }}>
      {/* Header */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center mb-3 mb-md-4 gap-2">
        <div className="flex-grow-1">
          <h3 className="fw-bold mb-1 d-flex align-items-center gap-2 fs-5 fs-md-3">
            <i className="bi bi-mortarboard-fill text-primary flex-shrink-0"></i>
            <span className="text-truncate">Academic Structure (Classes & Batches)</span>
          </h3>
          <p className="text-muted small mb-0 d-none d-sm-block">
            Define degrees, classes/programs, section batches, and curriculum subjects for your institution.
          </p>
        </div>

        <div className="d-flex flex-wrap align-items-center justify-content-start justify-content-md-end gap-2 mt-2 mt-md-0 w-100 w-md-auto flex-shrink-0">
          <button
            className="btn btn-sm btn-outline-secondary flex-grow-1 flex-md-grow-0"
            onClick={loadAllAcademicData}
            disabled={loading || actionLoading}
            title="Refresh Data"
          >
            <i className={`bi bi-arrow-clockwise me-1 ${loading ? 'spin' : ''}`}></i> Refresh
          </button>

          {activeTab === 'classes' && (
            <button className="btn btn-sm btn-primary flex-grow-1 flex-md-grow-0" onClick={openAddClassModal}>
              <i className="bi bi-plus-circle me-1"></i> Add Class / Degree
            </button>
          )}

          {activeTab === 'batches' && (
            <button className="btn btn-sm btn-primary flex-grow-1 flex-md-grow-0" onClick={openAddBatchModal}>
              <i className="bi bi-plus-circle me-1"></i> Add Batch / Section
            </button>
          )}

          {activeTab === 'subjects' && (
            <button className="btn btn-sm btn-primary flex-grow-1 flex-md-grow-0" onClick={openAddSubjectModal}>
              <i className="bi bi-plus-circle me-1"></i> Add Subject
            </button>
          )}
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="alert alert-success alert-dismissible fade show shadow-sm" role="alert">
          <i className="bi bi-check-circle-fill me-2"></i> {successMsg}
          <button type="button" className="btn-close" onClick={() => setSuccessMsg(null)}></button>
        </div>
      )}
      {error && (
        <div className="alert alert-danger alert-dismissible fade show shadow-sm" role="alert">
          <i className="bi bi-exclamation-triangle-fill me-2"></i> {error}
          <button type="button" className="btn-close" onClick={() => setError(null)}></button>
        </div>
      )}

      {/* KPI Cards - Compact 3-Column on Mobile, Rich Cards on Desktop */}
      <div className="row g-2 g-md-3 mb-3 mb-md-4">
        <div className="col-4 col-md-4">
          <div
            className={`card shadow-sm border-0 border-start border-4 rounded-3 p-2 p-md-3 h-100 ${
              activeTab === 'classes' ? 'border-primary bg-primary-subtle bg-opacity-25' : 'border-primary bg-white'
            }`}
            style={{ cursor: 'pointer' }}
            onClick={() => setActiveTab('classes')}
          >
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <span className="text-muted small fw-bold text-uppercase d-block" style={{ fontSize: '0.68rem', letterSpacing: '0.03em' }}>
                  <span className="d-none d-sm-inline">Classes / </span>Programs
                </span>
                <h3 className="fw-bold mt-1 mb-0 text-primary fs-5 fs-md-3">{classes.length}</h3>
                <small className="text-muted d-none d-md-block">Degree / Course Programs</small>
              </div>
              <div className="rounded-circle bg-primary bg-opacity-10 p-2 p-md-3 text-primary d-none d-sm-flex align-items-center justify-content-center">
                <i className="bi bi-mortarboard fs-5 fs-md-3"></i>
              </div>
            </div>
          </div>
        </div>

        <div className="col-4 col-md-4">
          <div
            className={`card shadow-sm border-0 border-start border-4 rounded-3 p-2 p-md-3 h-100 ${
              activeTab === 'batches' ? 'border-success bg-success-subtle bg-opacity-25' : 'border-success bg-white'
            }`}
            style={{ cursor: 'pointer' }}
            onClick={() => setActiveTab('batches')}
          >
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <span className="text-success small fw-bold text-uppercase d-block" style={{ fontSize: '0.68rem', letterSpacing: '0.03em' }}>
                  <span className="d-none d-sm-inline">Academic </span>Batches
                </span>
                <h3 className="fw-bold mt-1 mb-0 text-success fs-5 fs-md-3">{batches.length}</h3>
                <small className="text-muted d-none d-md-block">Sections & Year Batches</small>
              </div>
              <div className="rounded-circle bg-success bg-opacity-10 p-2 p-md-3 text-success d-none d-sm-flex align-items-center justify-content-center">
                <i className="bi bi-collection fs-5 fs-md-3"></i>
              </div>
            </div>
          </div>
        </div>

        <div className="col-4 col-md-4">
          <div
            className={`card shadow-sm border-0 border-start border-4 rounded-3 p-2 p-md-3 h-100 ${
              activeTab === 'subjects' ? 'border-info bg-info-subtle bg-opacity-25' : 'border-info bg-white'
            }`}
            style={{ cursor: 'pointer' }}
            onClick={() => setActiveTab('subjects')}
          >
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <span className="text-info-emphasis small fw-bold text-uppercase d-block" style={{ fontSize: '0.68rem', letterSpacing: '0.03em' }}>
                  Subjects
                </span>
                <h3 className="fw-bold mt-1 mb-0 text-info fs-5 fs-md-3">{subjects.length}</h3>
                <small className="text-muted d-none d-md-block">Curriculum Modules</small>
              </div>
              <div className="rounded-circle bg-info bg-opacity-10 p-2 p-md-3 text-info d-none d-sm-flex align-items-center justify-content-center">
                <i className="bi bi-book fs-5 fs-md-3"></i>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs & Search Bar */}
      <div className="card border-0 shadow-sm rounded-3 mb-4">
        {/* Mobile View: 3 Lines (Stacked Full-Width Tab Buttons) */}
        <div className="d-flex flex-column d-md-none p-2.5 gap-2 border-bottom bg-white">
          <button
            type="button"
            className={`btn w-100 text-start d-flex align-items-center justify-content-between p-2.5 rounded-3 fw-semibold transition-all ${
              activeTab === 'classes'
                ? 'btn-primary text-white shadow-sm'
                : 'btn-light text-dark border border-light-subtle'
            }`}
            onClick={() => {
              setActiveTab('classes');
              setSearchTerm('');
            }}
          >
            <div className="d-flex align-items-center gap-2">
              <i className={`bi bi-mortarboard-fill fs-5 ${activeTab === 'classes' ? 'text-white' : 'text-primary'}`}></i>
              <span>Classes & Degrees</span>
            </div>
            <span className={`badge ${activeTab === 'classes' ? 'bg-white text-primary' : 'bg-primary-subtle text-primary border border-primary-subtle'} px-2 py-1`}>
              {classes.length}
            </span>
          </button>

          <button
            type="button"
            className={`btn w-100 text-start d-flex align-items-center justify-content-between p-2.5 rounded-3 fw-semibold transition-all ${
              activeTab === 'batches'
                ? 'btn-success text-white shadow-sm'
                : 'btn-light text-dark border border-light-subtle'
            }`}
            onClick={() => {
              setActiveTab('batches');
              setSearchTerm('');
            }}
          >
            <div className="d-flex align-items-center gap-2">
              <i className={`bi bi-collection-fill fs-5 ${activeTab === 'batches' ? 'text-white' : 'text-success'}`}></i>
              <span>Batches & Sections</span>
            </div>
            <span className={`badge ${activeTab === 'batches' ? 'bg-white text-success' : 'bg-success-subtle text-success border border-success-subtle'} px-2 py-1`}>
              {batches.length}
            </span>
          </button>

          <button
            type="button"
            className={`btn w-100 text-start d-flex align-items-center justify-content-between p-2.5 rounded-3 fw-semibold transition-all ${
              activeTab === 'subjects'
                ? 'btn-info text-white shadow-sm'
                : 'btn-light text-dark border border-light-subtle'
            }`}
            onClick={() => {
              setActiveTab('subjects');
              setSearchTerm('');
            }}
          >
            <div className="d-flex align-items-center gap-2">
              <i className={`bi bi-book-fill fs-5 ${activeTab === 'subjects' ? 'text-white' : 'text-info'}`}></i>
              <span>Curriculum Subjects</span>
            </div>
            <span className={`badge ${activeTab === 'subjects' ? 'bg-white text-info' : 'bg-info-subtle text-info-emphasis border border-info-subtle'} px-2 py-1`}>
              {subjects.length}
            </span>
          </button>
        </div>

        {/* Desktop View: Horizontal Tab Bar */}
        <div className="card-header bg-white border-bottom p-0 d-none d-md-block overflow-x-auto" style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
          <ul className="nav nav-tabs card-header-tabs px-3 pt-2 border-bottom-0 flex-nowrap" style={{ minWidth: 'max-content' }}>
            <li className="nav-item">
              <button
                className={`nav-link fw-semibold d-flex align-items-center gap-2 ${
                  activeTab === 'classes' ? 'active text-primary' : 'text-secondary'
                }`}
                onClick={() => {
                  setActiveTab('classes');
                  setSearchTerm('');
                }}
              >
                <i className="bi bi-mortarboard"></i>
                Classes & Degrees ({classes.length})
              </button>
            </li>
            <li className="nav-item">
              <button
                className={`nav-link fw-semibold d-flex align-items-center gap-2 ${
                  activeTab === 'batches' ? 'active text-success' : 'text-secondary'
                }`}
                onClick={() => {
                  setActiveTab('batches');
                  setSearchTerm('');
                }}
              >
                <i className="bi bi-collection"></i>
                Batches & Sections ({batches.length})
              </button>
            </li>
            <li className="nav-item">
              <button
                className={`nav-link fw-semibold d-flex align-items-center gap-2 ${
                  activeTab === 'subjects' ? 'active text-info' : 'text-secondary'
                }`}
                onClick={() => {
                  setActiveTab('subjects');
                  setSearchTerm('');
                }}
              >
                <i className="bi bi-book"></i>
                Subjects ({subjects.length})
              </button>
            </li>
          </ul>
        </div>

        <div className="card-body p-3">
          <div className="row g-2 align-items-center">
            <div className="col-12 col-md-7">
              <div className="input-group">
                <span className="input-group-text bg-white border-end-0">
                  <i className="bi bi-search text-muted"></i>
                </span>
                <input
                  type="text"
                  className="form-control border-start-0 ps-0"
                  placeholder={`Search ${activeTab}...`}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <button className="btn btn-outline-secondary" type="button" onClick={() => setSearchTerm('')}>
                    <i className="bi bi-x"></i>
                  </button>
                )}
              </div>
            </div>

            {activeTab !== 'classes' && (
              <div className="col-12 col-md-5">
                <select
                  className="form-select"
                  value={filterClassId}
                  onChange={(e) => setFilterClassId(e.target.value)}
                >
                  <option value="">Filter by Class (All Classes)</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.code ? `(${c.code})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="card border-0 shadow-sm rounded-3 overflow-hidden">
        {loading ? (
          <div className="py-5">
            <LoadingSpinner message="Loading academic records..." />
          </div>
        ) : (
          <>
            {/* -------------------- TAB 1: CLASSES -------------------- */}
            {activeTab === 'classes' && (
              <>
                {/* Desktop View: Full Data Table */}
                <div className="table-responsive d-none d-md-block">
                  <table className="table table-hover align-middle mb-0">
                    <thead className="table-light text-uppercase small text-muted">
                      <tr>
                        <th className="ps-4">Class / Program Name</th>
                        <th>Class Code</th>
                        <th>Description</th>
                        <th>Batches Assigned</th>
                        <th>Status</th>
                        <th className="text-end pe-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredClasses.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="text-center py-5 text-muted">
                            <i className="bi bi-inbox fs-2 d-block mb-2"></i>
                            No classes found. Click "+ Add Class / Degree" above to create one.
                          </td>
                        </tr>
                      ) : (
                        filteredClasses.map((c) => (
                          <tr key={c.id}>
                            <td className="ps-4">
                              <div className="fw-bold text-dark">{c.name}</div>
                              <small className="text-muted">ID: #{c.id}</small>
                            </td>
                            <td>
                              {c.code ? <code>{c.code}</code> : <span className="text-muted">—</span>}
                            </td>
                            <td>
                              <span className="small text-secondary">{c.description || 'No description'}</span>
                            </td>
                            <td>
                              <span className="badge bg-secondary-subtle text-secondary border px-2 py-1">
                                {c.batches ? c.batches.length : 0} Batch(es)
                              </span>
                            </td>
                            <td>
                              {c.is_active ? (
                                <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-1">
                                  <i className="bi bi-check-circle-fill me-1"></i> Active
                                </span>
                              ) : (
                                <span className="badge bg-secondary-subtle text-secondary border px-2 py-1">
                                  Inactive
                                </span>
                              )}
                            </td>
                            <td className="text-end pe-4">
                              <div className="btn-group btn-group-sm">
                                <button
                                  className={`btn ${c.is_active ? 'btn-outline-warning' : 'btn-outline-success'}`}
                                  onClick={() => handleToggleClass(c)}
                                  title={c.is_active ? 'Deactivate Class' : 'Activate Class'}
                                  disabled={actionLoading}
                                >
                                  <i className={`bi ${c.is_active ? 'bi-lock-fill' : 'bi-unlock-fill'}`}></i>
                                </button>
                                <button
                                  className="btn btn-outline-primary"
                                  onClick={() => openEditClassModal(c)}
                                  title="Edit Class"
                                  disabled={actionLoading}
                                >
                                  <i className="bi bi-pencil-fill"></i>
                                </button>
                                <button
                                  className="btn btn-outline-danger"
                                  onClick={() => handleDeleteClass(c)}
                                  title="Delete Class"
                                  disabled={actionLoading}
                                >
                                  <i className="bi bi-trash-fill"></i>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Mobile View: Interactive Responsive Accordion */}
                <div className="d-block d-md-none p-2 p-sm-3">
                  {filteredClasses.length === 0 ? (
                    <div className="text-center py-5 text-muted bg-light rounded-3 p-4">
                      <i className="bi bi-inbox fs-2 d-block mb-2 text-secondary"></i>
                      <p className="mb-2">No classes found matching your search.</p>
                      <button className="btn btn-sm btn-primary" onClick={openAddClassModal}>
                        <i className="bi bi-plus-circle me-1"></i> Add Class / Degree
                      </button>
                    </div>
                  ) : (
                    <div className="d-flex flex-column gap-2">
                      {filteredClasses.map((c) => {
                        const isExpanded = expandedClassId === c.id;
                        const classBatches = batches.filter((b) => String(b.class_id) === String(c.id));
                        const classSubjects = subjects.filter((s) => String(s.class_id) === String(c.id));

                        return (
                          <div
                            key={c.id}
                            className={`card border rounded-3 overflow-hidden shadow-sm ${
                              isExpanded ? 'border-primary' : 'border-light-subtle'
                            }`}
                          >
                            {/* Accordion Trigger Header */}
                            <div
                              className="p-3 bg-white d-flex align-items-center justify-content-between"
                              role="button"
                              tabIndex={0}
                              aria-expanded={isExpanded}
                              onClick={() => toggleClassAccordion(c.id)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  toggleClassAccordion(c.id);
                                }
                              }}
                              style={{ cursor: 'pointer', minHeight: '52px' }}
                            >
                              <div className="d-flex align-items-center gap-2.5 flex-grow-1 me-2" style={{ minWidth: 0 }}>
                                <div
                                  className="rounded-circle bg-primary bg-opacity-10 text-primary d-flex align-items-center justify-content-center flex-shrink-0"
                                  style={{ width: '38px', height: '38px' }}
                                >
                                  <i className="bi bi-mortarboard-fill fs-5"></i>
                                </div>
                                <div className="flex-grow-1" style={{ minWidth: 0 }}>
                                  <div className="fw-bold text-dark text-truncate fs-6">{c.name}</div>
                                  <div className="d-flex flex-wrap align-items-center gap-1.5 mt-1">
                                    {c.code && (
                                      <span
                                        className="badge bg-light text-dark border px-1.5 py-0.5 font-monospace"
                                        style={{ fontSize: '0.72rem' }}
                                      >
                                        {c.code}
                                      </span>
                                    )}
                                    <span
                                      className="badge bg-secondary-subtle text-secondary border px-1.5 py-0.5"
                                      style={{ fontSize: '0.72rem' }}
                                    >
                                      ID #{c.id}
                                    </span>
                                    <span
                                      className={`badge ${
                                        c.is_active
                                          ? 'bg-success-subtle text-success border border-success-subtle'
                                          : 'bg-secondary-subtle text-secondary border'
                                      } px-1.5 py-0.5`}
                                      style={{ fontSize: '0.72rem' }}
                                    >
                                      {c.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                    <span
                                      className="badge bg-primary-subtle text-primary border border-primary-subtle px-1.5 py-0.5"
                                      style={{ fontSize: '0.72rem' }}
                                    >
                                      {classBatches.length} {classBatches.length === 1 ? 'Batch' : 'Batches'}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div
                                className="btn btn-sm btn-light rounded-circle flex-shrink-0 d-flex align-items-center justify-content-center border"
                                style={{ width: '32px', height: '32px' }}
                              >
                                <i
                                  className={`bi bi-chevron-down transition-transform ${
                                    isExpanded ? 'rotate-180 text-primary' : 'text-muted'
                                  }`}
                                ></i>
                              </div>
                            </div>

                            {/* Accordion Expandable Body */}
                            {isExpanded && (
                              <div className="p-3 bg-light border-top">
                                {/* Description */}
                                <div className="mb-3">
                                  <span
                                    className="text-muted small fw-semibold text-uppercase d-block mb-1"
                                    style={{ fontSize: '0.68rem', letterSpacing: '0.04em' }}
                                  >
                                    Description
                                  </span>
                                  <div className="small text-secondary bg-white p-2.5 rounded-2 border">
                                    {c.description ? (
                                      c.description
                                    ) : (
                                      <em className="text-muted">No description provided for this class.</em>
                                    )}
                                  </div>
                                </div>

                                {/* Assigned Batches */}
                                <div className="mb-3">
                                  <div className="d-flex justify-content-between align-items-center mb-1.5">
                                    <span
                                      className="text-muted small fw-semibold text-uppercase"
                                      style={{ fontSize: '0.68rem', letterSpacing: '0.04em' }}
                                    >
                                      Batches / Sections ({classBatches.length})
                                    </span>
                                    <button
                                      type="button"
                                      className="btn btn-link btn-sm p-0 text-decoration-none text-primary fw-semibold"
                                      style={{ fontSize: '0.75rem' }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setBatchForm({
                                          class_id: String(c.id),
                                          name: '',
                                          code: '',
                                          start_year: '',
                                          end_year: ''
                                        });
                                        setEditingItem(null);
                                        setShowBatchModal(true);
                                      }}
                                    >
                                      <i className="bi bi-plus-circle me-1"></i>+ Add Batch
                                    </button>
                                  </div>

                                  {classBatches.length === 0 ? (
                                    <div className="bg-white p-2.5 rounded-2 border text-center text-muted small">
                                      <i className="bi bi-collection me-1 text-secondary"></i> No batches assigned to this class.
                                    </div>
                                  ) : (
                                    <div className="d-flex flex-column gap-1.5">
                                      {classBatches.map((b) => (
                                        <div
                                          key={b.id}
                                          className="bg-white p-2 rounded-2 border d-flex align-items-center justify-content-between"
                                        >
                                          <div>
                                            <div className="fw-semibold text-dark small">{b.name}</div>
                                            <div className="text-muted" style={{ fontSize: '0.72rem' }}>
                                              {b.code && <code className="me-1.5">{b.code}</code>}
                                              {b.start_year && b.end_year
                                                ? `${b.start_year} – ${b.end_year}`
                                                : 'Years not specified'}
                                            </div>
                                          </div>
                                          <span
                                            className={`badge ${
                                              b.is_active
                                                ? 'bg-success-subtle text-success border border-success-subtle'
                                                : 'bg-secondary-subtle text-secondary border'
                                            }`}
                                            style={{ fontSize: '0.68rem' }}
                                          >
                                            {b.is_active ? 'Active' : 'Inactive'}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                {/* Linked Subjects */}
                                <div className="mb-3">
                                  <div className="d-flex justify-content-between align-items-center mb-1.5">
                                    <span
                                      className="text-muted small fw-semibold text-uppercase"
                                      style={{ fontSize: '0.68rem', letterSpacing: '0.04em' }}
                                    >
                                      Curriculum Subjects ({classSubjects.length})
                                    </span>
                                    <button
                                      type="button"
                                      className="btn btn-link btn-sm p-0 text-decoration-none text-info-emphasis fw-semibold"
                                      style={{ fontSize: '0.75rem' }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSubjectForm({
                                          class_id: String(c.id),
                                          name: '',
                                          code: '',
                                          description: ''
                                        });
                                        setEditingItem(null);
                                        setShowSubjectModal(true);
                                      }}
                                    >
                                      <i className="bi bi-plus-circle me-1"></i>+ Add Subject
                                    </button>
                                  </div>

                                  {classSubjects.length === 0 ? (
                                    <div className="bg-white p-2.5 rounded-2 border text-center text-muted small">
                                      <i className="bi bi-book me-1 text-secondary"></i> No subjects mapped to this class.
                                    </div>
                                  ) : (
                                    <div className="d-flex flex-wrap gap-1.5">
                                      {classSubjects.map((s) => (
                                        <span
                                          key={s.id}
                                          className="badge bg-white text-dark border p-1.5 d-inline-flex align-items-center gap-1 font-monospace"
                                          style={{ fontSize: '0.72rem' }}
                                        >
                                          <i className="bi bi-book-fill text-info"></i>
                                          <span>{s.name}</span>
                                          {s.code && <span className="text-muted">({s.code})</span>}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                {/* Mobile Action Buttons */}
                                <div className="d-flex flex-column flex-sm-row align-items-stretch align-items-sm-center gap-2 pt-2 border-top w-100" style={{ minWidth: 0 }}>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-primary flex-grow-1 d-flex align-items-center justify-content-center gap-1.5 py-2"
                                    onClick={() => openEditClassModal(c)}
                                    disabled={actionLoading}
                                  >
                                    <i className="bi bi-pencil-fill"></i>
                                    <span>Edit Class</span>
                                  </button>
                                  <button
                                    type="button"
                                    className={`btn btn-sm ${
                                      c.is_active ? 'btn-outline-warning' : 'btn-outline-success'
                                    } flex-grow-1 d-flex align-items-center justify-content-center gap-1.5 py-2`}
                                    onClick={() => handleToggleClass(c)}
                                    disabled={actionLoading}
                                  >
                                    <i className={`bi ${c.is_active ? 'bi-lock-fill' : 'bi-unlock-fill'}`}></i>
                                    <span>{c.is_active ? 'Deactivate Class' : 'Activate Class'}</span>
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-danger flex-grow-1 d-flex align-items-center justify-content-center gap-1.5 py-2"
                                    onClick={() => handleDeleteClass(c)}
                                    disabled={actionLoading}
                                  >
                                    <i className="bi bi-trash-fill"></i>
                                    <span>Delete Class</span>
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* -------------------- TAB 2: BATCHES -------------------- */}
            {activeTab === 'batches' && (
              <>
                {/* Desktop View: Full Data Table */}
                <div className="table-responsive d-none d-md-block">
                  <table className="table table-hover align-middle mb-0">
                    <thead className="table-light text-uppercase small text-muted">
                      <tr>
                        <th className="ps-4">Batch Name</th>
                        <th>Class / Program</th>
                        <th>Batch Code</th>
                        <th>Academic Years</th>
                        <th>Status</th>
                        <th className="text-end pe-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredBatches.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="text-center py-5 text-muted">
                            <i className="bi bi-inbox fs-2 d-block mb-2"></i>
                            No batches found. Click "+ Add Batch / Section" above to create one.
                          </td>
                        </tr>
                      ) : (
                        filteredBatches.map((b) => (
                          <tr key={b.id}>
                            <td className="ps-4">
                              <div className="fw-bold text-dark">{b.name}</div>
                              <small className="text-muted">Batch ID: #{b.id}</small>
                            </td>
                            <td>
                              <span className="badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-1">
                                {b.class?.name || 'Class ID #' + b.class_id}
                              </span>
                            </td>
                            <td>
                              {b.code ? <code>{b.code}</code> : <span className="text-muted">—</span>}
                            </td>
                            <td>
                              <span className="small text-secondary">
                                {b.start_year && b.end_year ? `${b.start_year} – ${b.end_year}` : 'Not Specified'}
                              </span>
                            </td>
                            <td>
                              {b.is_active ? (
                                <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-1">
                                  <i className="bi bi-check-circle-fill me-1"></i> Active
                                </span>
                              ) : (
                                <span className="badge bg-secondary-subtle text-secondary border px-2 py-1">
                                  Inactive
                                </span>
                              )}
                            </td>
                            <td className="text-end pe-4">
                              <div className="btn-group btn-group-sm">
                                <button
                                  className={`btn ${b.is_active ? 'btn-outline-warning' : 'btn-outline-success'}`}
                                  onClick={() => handleToggleBatch(b)}
                                  title={b.is_active ? 'Deactivate Batch' : 'Activate Batch'}
                                  disabled={actionLoading}
                                >
                                  <i className={`bi ${b.is_active ? 'bi-lock-fill' : 'bi-unlock-fill'}`}></i>
                                </button>
                                <button
                                  className="btn btn-outline-primary"
                                  onClick={() => openEditBatchModal(b)}
                                  title="Edit Batch"
                                  disabled={actionLoading}
                                >
                                  <i className="bi bi-pencil-fill"></i>
                                </button>
                                <button
                                  className="btn btn-outline-danger"
                                  onClick={() => handleDeleteBatch(b)}
                                  title="Delete Batch"
                                  disabled={actionLoading}
                                >
                                  <i className="bi bi-trash-fill"></i>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Mobile View: Interactive Responsive Accordion */}
                <div className="d-block d-md-none p-2 p-sm-3">
                  {filteredBatches.length === 0 ? (
                    <div className="text-center py-5 text-muted bg-light rounded-3 p-4">
                      <i className="bi bi-inbox fs-2 d-block mb-2 text-secondary"></i>
                      <p className="mb-2">No batches found matching your search.</p>
                      <button className="btn btn-sm btn-primary" onClick={openAddBatchModal}>
                        <i className="bi bi-plus-circle me-1"></i> Add Batch / Section
                      </button>
                    </div>
                  ) : (
                    <div className="d-flex flex-column gap-2">
                      {filteredBatches.map((b) => {
                        const isExpanded = expandedBatchId === b.id;

                        return (
                          <div
                            key={b.id}
                            className={`card border rounded-3 overflow-hidden shadow-sm ${
                              isExpanded ? 'border-success' : 'border-light-subtle'
                            }`}
                          >
                            {/* Accordion Trigger Header */}
                            <div
                              className="p-3 bg-white d-flex align-items-center justify-content-between"
                              role="button"
                              tabIndex={0}
                              aria-expanded={isExpanded}
                              onClick={() => toggleBatchAccordion(b.id)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  toggleBatchAccordion(b.id);
                                }
                              }}
                              style={{ cursor: 'pointer', minHeight: '52px' }}
                            >
                              <div className="d-flex align-items-center gap-2.5 flex-grow-1 me-2" style={{ minWidth: 0 }}>
                                <div
                                  className="rounded-circle bg-success bg-opacity-10 text-success d-flex align-items-center justify-content-center flex-shrink-0"
                                  style={{ width: '38px', height: '38px' }}
                                >
                                  <i className="bi bi-collection-fill fs-5"></i>
                                </div>
                                <div className="flex-grow-1" style={{ minWidth: 0 }}>
                                  <div className="fw-bold text-dark text-truncate fs-6">{b.name}</div>
                                  <div className="d-flex flex-wrap align-items-center gap-1.5 mt-1">
                                    <span
                                      className="badge bg-primary-subtle text-primary border border-primary-subtle px-1.5 py-0.5"
                                      style={{ fontSize: '0.72rem' }}
                                    >
                                      {b.class?.name || 'Class ID #' + b.class_id}
                                    </span>
                                    {b.code && (
                                      <span
                                        className="badge bg-light text-dark border px-1.5 py-0.5 font-monospace"
                                        style={{ fontSize: '0.72rem' }}
                                      >
                                        {b.code}
                                      </span>
                                    )}
                                    <span
                                      className={`badge ${
                                        b.is_active
                                          ? 'bg-success-subtle text-success border border-success-subtle'
                                          : 'bg-secondary-subtle text-secondary border'
                                      } px-1.5 py-0.5`}
                                      style={{ fontSize: '0.72rem' }}
                                    >
                                      {b.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div
                                className="btn btn-sm btn-light rounded-circle flex-shrink-0 d-flex align-items-center justify-content-center border"
                                style={{ width: '32px', height: '32px' }}
                              >
                                <i
                                  className={`bi bi-chevron-down transition-transform ${
                                    isExpanded ? 'rotate-180 text-success' : 'text-muted'
                                  }`}
                                ></i>
                              </div>
                            </div>

                            {/* Accordion Expandable Body */}
                            {isExpanded && (
                              <div className="p-3 bg-light border-top">
                                <div className="row g-2 mb-3">
                                  <div className="col-6">
                                    <div className="bg-white p-2 rounded-2 border">
                                      <span className="text-muted d-block" style={{ fontSize: '0.68rem' }}>
                                        Academic Years
                                      </span>
                                      <span className="fw-semibold text-dark small">
                                        {b.start_year && b.end_year ? `${b.start_year} – ${b.end_year}` : 'Not specified'}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="col-6">
                                    <div className="bg-white p-2 rounded-2 border">
                                      <span className="text-muted d-block" style={{ fontSize: '0.68rem' }}>
                                        Linked Program
                                      </span>
                                      <span className="fw-semibold text-primary small text-truncate d-block">
                                        {b.class?.name || 'Class ID #' + b.class_id}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* Mobile Action Buttons */}
                                <div className="d-flex flex-column flex-sm-row align-items-stretch align-items-sm-center gap-2 pt-2 border-top w-100" style={{ minWidth: 0 }}>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-primary flex-grow-1 d-flex align-items-center justify-content-center gap-1.5 py-2"
                                    onClick={() => openEditBatchModal(b)}
                                    disabled={actionLoading}
                                  >
                                    <i className="bi bi-pencil-fill"></i>
                                    <span>Edit Batch</span>
                                  </button>
                                  <button
                                    type="button"
                                    className={`btn btn-sm ${
                                      b.is_active ? 'btn-outline-warning' : 'btn-outline-success'
                                    } flex-grow-1 d-flex align-items-center justify-content-center gap-1.5 py-2`}
                                    onClick={() => handleToggleBatch(b)}
                                    disabled={actionLoading}
                                  >
                                    <i className={`bi ${b.is_active ? 'bi-lock-fill' : 'bi-unlock-fill'}`}></i>
                                    <span>{b.is_active ? 'Deactivate Batch' : 'Activate Batch'}</span>
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-danger flex-grow-1 d-flex align-items-center justify-content-center gap-1.5 py-2"
                                    onClick={() => handleDeleteBatch(b)}
                                    disabled={actionLoading}
                                  >
                                    <i className="bi bi-trash-fill"></i>
                                    <span>Delete Batch</span>
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* -------------------- TAB 3: SUBJECTS -------------------- */}
            {activeTab === 'subjects' && (
              <>
                {/* Desktop View: Full Data Table */}
                <div className="table-responsive d-none d-md-block">
                  <table className="table table-hover align-middle mb-0">
                    <thead className="table-light text-uppercase small text-muted">
                      <tr>
                        <th className="ps-4">Subject Name</th>
                        <th>Subject Code</th>
                        <th>Linked Class</th>
                        <th>Description</th>
                        <th>Status</th>
                        <th className="text-end pe-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSubjects.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="text-center py-5 text-muted">
                            <i className="bi bi-inbox fs-2 d-block mb-2"></i>
                            No subjects found. Click "+ Add Subject" above to create one.
                          </td>
                        </tr>
                      ) : (
                        filteredSubjects.map((s) => (
                          <tr key={s.id}>
                            <td className="ps-4">
                              <div className="fw-bold text-dark">{s.name}</div>
                              <small className="text-muted">Subject ID: #{s.id}</small>
                            </td>
                            <td>
                              {s.code ? <code>{s.code}</code> : <span className="text-muted">—</span>}
                            </td>
                            <td>
                              {s.class?.name ? (
                                <span className="badge bg-info-subtle text-info-emphasis border border-info-subtle px-2 py-1">
                                  {s.class.name}
                                </span>
                              ) : (
                                <span className="badge bg-secondary-subtle text-secondary border px-2 py-1">
                                  Common / All
                                </span>
                              )}
                            </td>
                            <td>
                              <span className="small text-secondary">{s.description || '—'}</span>
                            </td>
                            <td>
                              {s.is_active ? (
                                <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-1">
                                  <i className="bi bi-check-circle-fill me-1"></i> Active
                                </span>
                              ) : (
                                <span className="badge bg-secondary-subtle text-secondary border px-2 py-1">
                                  Inactive
                                </span>
                              )}
                            </td>
                            <td className="text-end pe-4">
                              <div className="btn-group btn-group-sm">
                                <button
                                  className={`btn ${s.is_active ? 'btn-outline-warning' : 'btn-outline-success'}`}
                                  onClick={() => handleToggleSubject(s)}
                                  title={s.is_active ? 'Deactivate Subject' : 'Activate Subject'}
                                  disabled={actionLoading}
                                >
                                  <i className={`bi ${s.is_active ? 'bi-lock-fill' : 'bi-unlock-fill'}`}></i>
                                </button>
                                <button
                                  className="btn btn-outline-primary"
                                  onClick={() => openEditSubjectModal(s)}
                                  title="Edit Subject"
                                  disabled={actionLoading}
                                >
                                  <i className="bi bi-pencil-fill"></i>
                                </button>
                                <button
                                  className="btn btn-outline-danger"
                                  onClick={() => handleDeleteSubject(s)}
                                  title="Delete Subject"
                                  disabled={actionLoading}
                                >
                                  <i className="bi bi-trash-fill"></i>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Mobile View: Interactive Responsive Accordion */}
                <div className="d-block d-md-none p-2 p-sm-3">
                  {filteredSubjects.length === 0 ? (
                    <div className="text-center py-5 text-muted bg-light rounded-3 p-4">
                      <i className="bi bi-inbox fs-2 d-block mb-2 text-secondary"></i>
                      <p className="mb-2">No subjects found matching your search.</p>
                      <button className="btn btn-sm btn-primary" onClick={openAddSubjectModal}>
                        <i className="bi bi-plus-circle me-1"></i> Add Subject
                      </button>
                    </div>
                  ) : (
                    <div className="d-flex flex-column gap-2">
                      {filteredSubjects.map((s) => {
                        const isExpanded = expandedSubjectId === s.id;

                        return (
                          <div
                            key={s.id}
                            className={`card border rounded-3 overflow-hidden shadow-sm ${
                              isExpanded ? 'border-info' : 'border-light-subtle'
                            }`}
                          >
                            {/* Accordion Trigger Header */}
                            <div
                              className="p-3 bg-white d-flex align-items-center justify-content-between"
                              role="button"
                              tabIndex={0}
                              aria-expanded={isExpanded}
                              onClick={() => toggleSubjectAccordion(s.id)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  toggleSubjectAccordion(s.id);
                                }
                              }}
                              style={{ cursor: 'pointer', minHeight: '52px' }}
                            >
                              <div className="d-flex align-items-center gap-2.5 flex-grow-1 me-2" style={{ minWidth: 0 }}>
                                <div
                                  className="rounded-circle bg-info bg-opacity-10 text-info d-flex align-items-center justify-content-center flex-shrink-0"
                                  style={{ width: '38px', height: '38px' }}
                                >
                                  <i className="bi bi-book-fill fs-5"></i>
                                </div>
                                <div className="flex-grow-1" style={{ minWidth: 0 }}>
                                  <div className="fw-bold text-dark text-truncate fs-6">{s.name}</div>
                                  <div className="d-flex flex-wrap align-items-center gap-1.5 mt-1">
                                    <span
                                      className="badge bg-info-subtle text-info-emphasis border border-info-subtle px-1.5 py-0.5"
                                      style={{ fontSize: '0.72rem' }}
                                    >
                                      {s.class?.name || 'Common / All'}
                                    </span>
                                    {s.code && (
                                      <span
                                        className="badge bg-light text-dark border px-1.5 py-0.5 font-monospace"
                                        style={{ fontSize: '0.72rem' }}
                                      >
                                        {s.code}
                                      </span>
                                    )}
                                    <span
                                      className={`badge ${
                                        s.is_active
                                          ? 'bg-success-subtle text-success border border-success-subtle'
                                          : 'bg-secondary-subtle text-secondary border'
                                      } px-1.5 py-0.5`}
                                      style={{ fontSize: '0.72rem' }}
                                    >
                                      {s.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div
                                className="btn btn-sm btn-light rounded-circle flex-shrink-0 d-flex align-items-center justify-content-center border"
                                style={{ width: '32px', height: '32px' }}
                              >
                                <i
                                  className={`bi bi-chevron-down transition-transform ${
                                    isExpanded ? 'rotate-180 text-info' : 'text-muted'
                                  }`}
                                ></i>
                              </div>
                            </div>

                            {/* Accordion Expandable Body */}
                            {isExpanded && (
                              <div className="p-3 bg-light border-top">
                                <div className="mb-3">
                                  <span
                                    className="text-muted small fw-semibold text-uppercase d-block mb-1"
                                    style={{ fontSize: '0.68rem', letterSpacing: '0.04em' }}
                                  >
                                    Description
                                  </span>
                                  <div className="small text-secondary bg-white p-2.5 rounded-2 border">
                                    {s.description ? s.description : <em className="text-muted">No description provided.</em>}
                                  </div>
                                </div>

                                <div className="mb-3 bg-white p-2 rounded-2 border">
                                  <span className="text-muted d-block" style={{ fontSize: '0.68rem' }}>
                                    Program Curriculum
                                  </span>
                                  <span className="fw-semibold text-dark small">
                                    {s.class?.name ? s.class.name : 'Applicable to All Classes / Open Course'}
                                  </span>
                                </div>

                                {/* Mobile Action Buttons */}
                                <div className="d-flex flex-column flex-sm-row align-items-stretch align-items-sm-center gap-2 pt-2 border-top w-100" style={{ minWidth: 0 }}>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-primary flex-grow-1 d-flex align-items-center justify-content-center gap-1.5 py-2"
                                    onClick={() => openEditSubjectModal(s)}
                                    disabled={actionLoading}
                                  >
                                    <i className="bi bi-pencil-fill"></i>
                                    <span>Edit Subject</span>
                                  </button>
                                  <button
                                    type="button"
                                    className={`btn btn-sm ${
                                      s.is_active ? 'btn-outline-warning' : 'btn-outline-success'
                                    } flex-grow-1 d-flex align-items-center justify-content-center gap-1.5 py-2`}
                                    onClick={() => handleToggleSubject(s)}
                                    disabled={actionLoading}
                                  >
                                    <i className={`bi ${s.is_active ? 'bi-lock-fill' : 'bi-unlock-fill'}`}></i>
                                    <span>{s.is_active ? 'Deactivate Subject' : 'Activate Subject'}</span>
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-danger flex-grow-1 d-flex align-items-center justify-content-center gap-1.5 py-2"
                                    onClick={() => handleDeleteSubject(s)}
                                    disabled={actionLoading}
                                  >
                                    <i className="bi bi-trash-fill"></i>
                                    <span>Delete Subject</span>
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* ================================================================ */}
      {/* CLASS MODAL */}
      {/* ================================================================ */}
      {showClassModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg rounded-3">
              <div className="modal-header border-bottom">
                <h5 className="modal-title fw-bold">
                  <i className="bi bi-mortarboard-fill text-primary me-2"></i>
                  {editingItem ? 'Edit Class / Degree Program' : 'Add New Class / Degree Program'}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowClassModal(false)}
                  disabled={actionLoading}
                ></button>
              </div>
              <form onSubmit={handleClassSubmit}>
                <div className="modal-body p-4">
                  <div className="mb-3">
                    <label className="form-label fw-semibold">
                      Class / Program Name <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. B.Tech Computer Science & Engineering"
                      value={classForm.name}
                      onChange={(e) => setClassForm({ ...classForm, name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-semibold">Class Code / Identifier</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. BTECH-CSE"
                      value={classForm.code}
                      onChange={(e) => setClassForm({ ...classForm, code: e.target.value })}
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-semibold">Description</label>
                    <textarea
                      className="form-control"
                      rows="3"
                      placeholder="e.g. 4-year undergraduate degree program..."
                      value={classForm.description}
                      onChange={(e) => setClassForm({ ...classForm, description: e.target.value })}
                    ></textarea>
                  </div>
                </div>

                <div className="modal-footer border-top">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowClassModal(false)}
                    disabled={actionLoading}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={actionLoading}>
                    {actionLoading ? 'Saving...' : editingItem ? 'Save Changes' : 'Create Class'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* BATCH MODAL */}
      {/* ================================================================ */}
      {showBatchModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg rounded-3">
              <div className="modal-header border-bottom">
                <h5 className="modal-title fw-bold">
                  <i className="bi bi-collection-fill text-success me-2"></i>
                  {editingItem ? 'Edit Academic Batch' : 'Add New Academic Batch'}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowBatchModal(false)}
                  disabled={actionLoading}
                ></button>
              </div>
              <form onSubmit={handleBatchSubmit}>
                <div className="modal-body p-4">
                  <div className="mb-3">
                    <label className="form-label fw-semibold">
                      Parent Class / Degree <span className="text-danger">*</span>
                    </label>
                    <select
                      className="form-select"
                      value={batchForm.class_id}
                      onChange={(e) => setBatchForm({ ...batchForm, class_id: e.target.value })}
                      required
                    >
                      <option value="">Select Associated Class</option>
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.code ? `(${c.code})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-semibold">
                      Batch Name <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. CSE Batch 2026-A (Morning)"
                      value={batchForm.name}
                      onChange={(e) => setBatchForm({ ...batchForm, name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-semibold">Batch Code</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. CSE-2026-A"
                      value={batchForm.code}
                      onChange={(e) => setBatchForm({ ...batchForm, code: e.target.value })}
                    />
                  </div>

                  <div className="row g-3">
                    <div className="col-6">
                      <label className="form-label fw-semibold">Start Year</label>
                      <input
                        type="number"
                        className="form-control"
                        placeholder="2022"
                        value={batchForm.start_year}
                        onChange={(e) => setBatchForm({ ...batchForm, start_year: e.target.value })}
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label fw-semibold">End Year</label>
                      <input
                        type="number"
                        className="form-control"
                        placeholder="2026"
                        value={batchForm.end_year}
                        onChange={(e) => setBatchForm({ ...batchForm, end_year: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div className="modal-footer border-top">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowBatchModal(false)}
                    disabled={actionLoading}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-success" disabled={actionLoading}>
                    {actionLoading ? 'Saving...' : editingItem ? 'Save Changes' : 'Create Batch'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* SUBJECT MODAL */}
      {/* ================================================================ */}
      {showSubjectModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg rounded-3">
              <div className="modal-header border-bottom">
                <h5 className="modal-title fw-bold">
                  <i className="bi bi-book-fill text-info me-2"></i>
                  {editingItem ? 'Edit Subject' : 'Add New Subject'}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowSubjectModal(false)}
                  disabled={actionLoading}
                ></button>
              </div>
              <form onSubmit={handleSubjectSubmit}>
                <div className="modal-body p-4">
                  <div className="mb-3">
                    <label className="form-label fw-semibold">
                      Subject Name <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Data Structures and Algorithms"
                      value={subjectForm.name}
                      onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="row g-3 mb-3">
                    <div className="col-6">
                      <label className="form-label fw-semibold">Subject Code</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. CS-301"
                        value={subjectForm.code}
                        onChange={(e) => setSubjectForm({ ...subjectForm, code: e.target.value })}
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label fw-semibold">Linked Class</label>
                      <select
                        className="form-select"
                        value={subjectForm.class_id}
                        onChange={(e) => setSubjectForm({ ...subjectForm, class_id: e.target.value })}
                      >
                        <option value="">Common / All Classes</option>
                        {classes.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-semibold">Description</label>
                    <textarea
                      className="form-control"
                      rows="3"
                      placeholder="e.g. Trees, Graphs, Sorting algorithms, and Big-O..."
                      value={subjectForm.description}
                      onChange={(e) => setSubjectForm({ ...subjectForm, description: e.target.value })}
                    ></textarea>
                  </div>
                </div>

                <div className="modal-footer border-top">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowSubjectModal(false)}
                    disabled={actionLoading}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-info text-white" disabled={actionLoading}>
                    {actionLoading ? 'Saving...' : editingItem ? 'Save Changes' : 'Create Subject'}
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

export default AcademicManagement;
