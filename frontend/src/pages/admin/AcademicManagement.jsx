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
      setError(err.response?.data?.message || 'Failed to save batch.');
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
    <div className="container-fluid py-4 px-4">
      {/* Header */}
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-4">
        <div>
          <h3 className="fw-bold mb-1 d-flex align-items-center gap-2">
            <i className="bi bi-mortarboard-fill text-primary"></i>
            Academic Structure (Classes & Batches)
          </h3>
          <p className="text-muted mb-0">
            Define degrees, classes/programs, section batches, and curriculum subjects for your institution.
          </p>
        </div>

        <div className="d-flex align-items-center gap-2 mt-2 mt-md-0">
          <button
            className="btn btn-sm btn-outline-secondary"
            onClick={loadAllAcademicData}
            disabled={loading || actionLoading}
            title="Refresh Data"
          >
            <i className={`bi bi-arrow-clockwise me-1 ${loading ? 'spin' : ''}`}></i> Refresh
          </button>

          {activeTab === 'classes' && (
            <button className="btn btn-sm btn-primary" onClick={openAddClassModal}>
              <i className="bi bi-plus-circle me-1"></i> Add Class / Degree
            </button>
          )}

          {activeTab === 'batches' && (
            <button className="btn btn-sm btn-primary" onClick={openAddBatchModal}>
              <i className="bi bi-plus-circle me-1"></i> Add Batch / Section
            </button>
          )}

          {activeTab === 'subjects' && (
            <button className="btn btn-sm btn-primary" onClick={openAddSubjectModal}>
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

      {/* KPI Cards */}
      <div className="row g-3 mb-4">
        <div className="col-12 col-md-4">
          <div
            className={`card shadow-sm border-0 border-start border-4 rounded-3 p-3 h-100 ${
              activeTab === 'classes' ? 'border-primary bg-primary-subtle bg-opacity-25' : 'border-primary'
            }`}
            style={{ cursor: 'pointer' }}
            onClick={() => setActiveTab('classes')}
          >
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <span className="text-muted small fw-bold text-uppercase">Classes / Programs</span>
                <h3 className="fw-bold mt-1 mb-0 text-primary">{classes.length}</h3>
                <small className="text-muted">Degree / Course Programs</small>
              </div>
              <div className="rounded-circle bg-primary bg-opacity-10 p-3 text-primary">
                <i className="bi bi-mortarboard fs-3"></i>
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-md-4">
          <div
            className={`card shadow-sm border-0 border-start border-4 rounded-3 p-3 h-100 ${
              activeTab === 'batches' ? 'border-success bg-success-subtle bg-opacity-25' : 'border-success'
            }`}
            style={{ cursor: 'pointer' }}
            onClick={() => setActiveTab('batches')}
          >
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <span className="text-success small fw-bold text-uppercase">Academic Batches</span>
                <h3 className="fw-bold mt-1 mb-0 text-success">{batches.length}</h3>
                <small className="text-muted">Sections & Year Batches</small>
              </div>
              <div className="rounded-circle bg-success bg-opacity-10 p-3 text-success">
                <i className="bi bi-collection fs-3"></i>
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-md-4">
          <div
            className={`card shadow-sm border-0 border-start border-4 rounded-3 p-3 h-100 ${
              activeTab === 'subjects' ? 'border-info bg-info-subtle bg-opacity-25' : 'border-info'
            }`}
            style={{ cursor: 'pointer' }}
            onClick={() => setActiveTab('subjects')}
          >
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <span className="text-info-emphasis small fw-bold text-uppercase">Subjects</span>
                <h3 className="fw-bold mt-1 mb-0 text-info">{subjects.length}</h3>
                <small className="text-muted">Curriculum Modules</small>
              </div>
              <div className="rounded-circle bg-info bg-opacity-10 p-3 text-info">
                <i className="bi bi-book fs-3"></i>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs & Search Bar */}
      <div className="card border-0 shadow-sm rounded-3 mb-4">
        <div className="card-header bg-white border-bottom p-0">
          <ul className="nav nav-tabs card-header-tabs mx-3 mt-2 border-bottom-0">
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
              <div className="table-responsive">
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
            )}

            {/* -------------------- TAB 2: BATCHES -------------------- */}
            {activeTab === 'batches' && (
              <div className="table-responsive">
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
            )}

            {/* -------------------- TAB 3: SUBJECTS -------------------- */}
            {activeTab === 'subjects' && (
              <div className="table-responsive">
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
