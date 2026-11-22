import React, { useState, useEffect } from 'react';
import { studentService } from '../../services/studentService';
import { academicService } from '../../services/academicService';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const StudentManagement = () => {
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [batches, setBatches] = useState([]);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Filters & Pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedBatch, setSelectedBatch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalStudents, setTotalStudents] = useState(0);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);

  // Single Student Form
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    username: '',
    password: '',
    class_id: '',
    batch_id: '',
    roll_no: '',
    enrollment_no: '',
    gender: 'male',
    parent_name: '',
    parent_phone: ''
  });

  // Bulk Import Form
  const [importMode, setImportMode] = useState('excel'); // 'excel' | 'csv_text'
  const [selectedFile, setSelectedFile] = useState(null);
  const [bulkCsvText, setBulkCsvText] = useState('');
  const [bulkDefaultClass, setBulkDefaultClass] = useState('');
  const [bulkDefaultBatch, setBulkDefaultBatch] = useState('');
  const [bulkPreview, setBulkPreview] = useState([]);
  const [bulkResult, setBulkResult] = useState(null);

  useEffect(() => {
    loadAcademicMeta();
  }, []);

  useEffect(() => {
    loadStudents(currentPage);
  }, [currentPage, selectedClass, selectedBatch, selectedStatus]);

  useEffect(() => {
    if (selectedClass) {
      loadBatchesForClass(selectedClass);
    } else {
      setBatches([]);
      setSelectedBatch('');
    }
  }, [selectedClass]);

  const loadAcademicMeta = async () => {
    try {
      const clsRes = await academicService.getClasses();
      if (clsRes.success && clsRes.data) {
        setClasses(clsRes.data);
      }
    } catch (err) {
      console.error('Failed to load classes:', err);
    }
  };

  const loadBatchesForClass = async (classId) => {
    try {
      const bRes = await academicService.getBatches(classId);
      if (bRes.success && bRes.data) {
        setBatches(bRes.data);
      }
    } catch (err) {
      console.error('Failed to load batches:', err);
    }
  };

  const loadStudents = async (page = 1) => {
    try {
      setLoading(true);
      setError(null);
      const params = {
        page,
        limit: 15,
        search: searchTerm.trim() || undefined,
        class_id: selectedClass || undefined,
        batch_id: selectedBatch || undefined,
        status: selectedStatus !== 'all' ? selectedStatus : undefined
      };

      const res = await studentService.getStudents(params);
      if (res.success) {
        setStudents(res.data.students || []);
        setTotalPages(res.data.pagination.totalPages || 1);
        setTotalStudents(res.data.pagination.total || 0);
        setCurrentPage(res.data.pagination.page || 1);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load students roster.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    loadStudents(1);
  };

  const handleToggleStatus = async (student) => {
    try {
      setActionLoading(true);
      const res = await studentService.toggleStudentStatus(student.id);
      if (res.success) {
        setStudents((prev) =>
          prev.map((s) => (s.id === student.id ? { ...s, is_active: res.data.is_active } : s))
        );
        setSuccessMsg(`Student account ${res.data.is_active ? 'activated' : 'deactivated'} successfully.`);
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to toggle student status.');
      setTimeout(() => setError(null), 4000);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      setError(null);

      const res = await studentService.createStudent(formData);
      if (res.success) {
        setSuccessMsg('Student registered successfully!');
        setShowAddModal(false);
        setFormData({
          name: '',
          email: '',
          username: '',
          password: '',
          class_id: '',
          batch_id: '',
          roll_no: '',
          enrollment_no: '',
          gender: 'male',
          parent_name: '',
          parent_phone: ''
        });
        loadStudents(1);
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to register student.');
    } finally {
      setActionLoading(false);
    }
  };

  // Parse CSV text into preview table
  const handleCsvTextChange = (text) => {
    setBulkCsvText(text);
    setBulkResult(null);

    const lines = text.trim().split('\n');
    if (lines.length <= 1) {
      setBulkPreview([]);
      return;
    }

    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const parsed = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const values = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));

      const entry = { rowNum: i };
      headers.forEach((h, idx) => {
        if (h.includes('name')) entry.name = values[idx] || '';
        else if (h.includes('email')) entry.email = values[idx] || '';
        else if (h.includes('roll')) entry.roll_no = values[idx] || '';
        else if (h.includes('student') || h.includes('id')) entry.student_id = values[idx] || '';
        else if (h.includes('gender')) entry.gender = values[idx] || 'male';
      });

      // Simple fallback if headers not named
      if (!entry.name && values[0]) entry.name = values[0];
      if (!entry.email && values[1]) entry.email = values[1];
      if (!entry.roll_no && values[2]) entry.roll_no = values[2];

      entry.isValid = Boolean(entry.name && entry.email && entry.email.includes('@'));
      parsed.push(entry);
    }

    setBulkPreview(parsed);
  };

  const handleDownloadTemplate = async () => {
    try {
      setActionLoading(true);
      const blob = await studentService.downloadTemplate();
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'student_bulk_import_template.xlsx');
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
    } catch (err) {
      setError('Failed to download Excel template: ' + (err.response?.data?.message || err.message));
    } finally {
      setActionLoading(false);
    }
  };

  const handleBulkImportSubmit = async (e) => {
    e.preventDefault();

    if (importMode === 'excel') {
      if (!selectedFile) {
        setError('Please choose an Excel (.xlsx, .xls) or CSV file to upload.');
        return;
      }

      try {
        setActionLoading(true);
        setError(null);
        const formData = new FormData();
        formData.append('file', selectedFile);
        if (bulkDefaultClass) formData.append('default_class_id', bulkDefaultClass);
        if (bulkDefaultBatch) formData.append('default_batch_id', bulkDefaultBatch);
        formData.append('default_password', 'Student@123');

        const res = await studentService.bulkImportStudents(formData, true);
        if (res.success) {
          setBulkResult(res.data);
          setSuccessMsg(`Bulk Excel Import Completed: ${res.data.importedCount} student(s) enrolled!`);
          loadStudents(1);
          setSelectedFile(null);
          setTimeout(() => setSuccessMsg(null), 5000);
        }
      } catch (err) {
        setError(err.response?.data?.message || 'Error processing Excel roster.');
      } finally {
        setActionLoading(false);
      }
      return;
    }

    if (!bulkDefaultClass || !bulkDefaultBatch) {
      setError('Please select a Default Class and Batch for bulk imported students.');
      return;
    }

    const validRows = bulkPreview.filter((r) => r.isValid);
    if (validRows.length === 0) {
      setError('No valid student records found in CSV. Please verify Name and Email columns.');
      return;
    }

    try {
      setActionLoading(true);
      setError(null);

      const payload = {
        default_class_id: bulkDefaultClass,
        default_batch_id: bulkDefaultBatch,
        default_password: 'Student@123',
        students: validRows.map((r) => ({
          name: r.name,
          email: r.email,
          roll_no: r.roll_no,
          student_id: r.student_id,
          gender: r.gender
        }))
      };

      const res = await studentService.bulkImportStudents(payload);
      if (res.success) {
        setBulkResult(res.data);
        setSuccessMsg(`Bulk import completed: ${res.data.importedCount} student(s) enrolled!`);
        loadStudents(1);
        setTimeout(() => setSuccessMsg(null), 4000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Error during bulk roster import.');
    } finally {
      setActionLoading(false);
    }
  };

  const activeCount = students.filter((s) => s.is_active).length;
  const inactiveCount = students.length - activeCount;

  return (
    <div className="container-fluid py-4 px-4">
      {/* Header */}
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-4">
        <div>
          <h3 className="fw-bold mb-1 d-flex align-items-center gap-2">
            <i className="bi bi-people-fill text-primary"></i>
            Student Roster & Identity Management
          </h3>
          <p className="text-muted mb-0">
            Provision candidate accounts, manage batch assignments, and bulk import rosters.
          </p>
        </div>

        <div className="d-flex flex-wrap align-items-center gap-2 mt-2 mt-md-0 w-100 w-md-auto">
          <a
            href={studentService.exportStudentsUrl({
              class_id: selectedClass || undefined,
              batch_id: selectedBatch || undefined
            })}
            download
            className="btn btn-sm btn-outline-secondary flex-grow-1 flex-sm-grow-0 text-center"
            title="Export CSV"
          >
            <i className="bi bi-file-earmark-arrow-down me-1"></i> Export CSV
          </a>
          <button
            className="btn btn-sm btn-outline-primary flex-grow-1 flex-sm-grow-0 text-center"
            onClick={() => setShowBulkModal(true)}
            title="Bulk CSV Import"
          >
            <i className="bi bi-file-earmark-spreadsheet me-1"></i> Bulk Import
          </button>
          <button
            className="btn btn-sm btn-primary flex-grow-1 flex-sm-grow-0 text-center"
            onClick={() => setShowAddModal(true)}
            title="Register Single Student"
          >
            <i className="bi bi-person-plus-fill me-1"></i> Add Student
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="alert alert-success alert-dismissible fade show" role="alert">
          <i className="bi bi-check-circle-fill me-2"></i> {successMsg}
          <button type="button" className="btn-close" onClick={() => setSuccessMsg(null)}></button>
        </div>
      )}
      {error && (
        <div className="alert alert-danger alert-dismissible fade show" role="alert">
          <i className="bi bi-exclamation-triangle-fill me-2"></i> {error}
          <button type="button" className="btn-close" onClick={() => setError(null)}></button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="row g-3 mb-4">
        <div className="col-12 col-sm-6 col-md-3">
          <div className="card shadow-sm border-0 border-start border-primary border-4 rounded-3 p-3 h-100">
            <span className="text-muted small fw-bold text-uppercase">Total Students</span>
            <h3 className="fw-bold mt-1 mb-0">{totalStudents}</h3>
            <small className="text-muted">Registered in Roster</small>
          </div>
        </div>
        <div className="col-12 col-sm-6 col-md-3">
          <div className="card shadow-sm border-0 border-start border-success border-4 rounded-3 p-3 h-100">
            <span className="text-success small fw-bold text-uppercase">Active Enrolled</span>
            <h3 className="fw-bold mt-1 mb-0 text-success">{activeCount}</h3>
            <small className="text-muted">Eligible for Exams</small>
          </div>
        </div>
        <div className="col-12 col-sm-6 col-md-3">
          <div className="card shadow-sm border-0 border-start border-warning border-4 rounded-3 p-3 h-100">
            <span className="text-warning small fw-bold text-uppercase">Suspended</span>
            <h3 className="fw-bold mt-1 mb-0 text-warning">{inactiveCount}</h3>
            <small className="text-muted">Access Restricted</small>
          </div>
        </div>
        <div className="col-12 col-sm-6 col-md-3">
          <div className="card shadow-sm border-0 border-start border-info border-4 rounded-3 p-3 h-100">
            <span className="text-info small fw-bold text-uppercase">Classes / Batches</span>
            <h3 className="fw-bold mt-1 mb-0">{classes.length}</h3>
            <small className="text-muted">Academic Cohorts</small>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="card shadow-sm border-0 rounded-3 mb-4">
        <div className="card-body p-3">
          <form onSubmit={handleSearchSubmit} className="row g-2 align-items-center">
            {/* Search */}
            <div className="col-12 col-md-4">
              <div className="input-group input-group-sm">
                <span className="input-group-text bg-light border-end-0">
                  <i className="bi bi-search text-muted"></i>
                </span>
                <input
                  type="text"
                  className="form-control border-start-0"
                  placeholder="Search name, roll no, student ID, email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            {/* Class Filter */}
            <div className="col-6 col-md-3">
              <select
                className="form-select form-select-sm"
                value={selectedClass}
                onChange={(e) => {
                  setSelectedClass(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="">All Academic Classes</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Batch Filter */}
            <div className="col-6 col-md-2">
              <select
                className="form-select form-select-sm"
                value={selectedBatch}
                onChange={(e) => {
                  setSelectedBatch(e.target.value);
                  setCurrentPage(1);
                }}
                disabled={!selectedClass}
              >
                <option value="">All Batches</option>
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="col-6 col-md-2">
              <select
                className="form-select form-select-sm"
                value={selectedStatus}
                onChange={(e) => {
                  setSelectedStatus(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            {/* Buttons */}
            <div className="col-6 col-md-1 d-flex gap-1">
              <button type="submit" className="btn btn-sm btn-primary w-100" title="Apply filter">
                <i className="bi bi-funnel-fill"></i>
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary w-100"
                onClick={() => {
                  setSearchTerm('');
                  setSelectedClass('');
                  setSelectedBatch('');
                  setSelectedStatus('all');
                  setCurrentPage(1);
                }}
                title="Reset filters"
              >
                <i className="bi bi-x-circle"></i>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Students Data Table */}
      <div className="card shadow-sm border-0 rounded-3">
        <div className="card-header bg-white border-bottom py-3 d-flex justify-content-between align-items-center">
          <span className="fw-semibold text-secondary">
            Displaying {students.length} of {totalStudents} Enrolled Candidates
          </span>
          <button
            className="btn btn-xs btn-outline-secondary py-1 px-2"
            onClick={() => loadStudents(currentPage)}
            title="Refresh roster"
          >
            <i className="bi bi-arrow-clockwise me-1"></i> Refresh
          </button>
        </div>

        <div className="card-body p-0">
          {loading ? (
            <div className="py-5 text-center">
              <LoadingSpinner message="Querying student roster..." />
            </div>
          ) : students.length === 0 ? (
            <div className="text-center py-5">
              <i className="bi bi-person-slash fs-1 text-muted d-block mb-3"></i>
              <h5 className="text-secondary">No Student Records Found</h5>
              <p className="text-muted small">No candidates match your current search criteria.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0 small">
                <thead className="table-light text-uppercase text-muted">
                  <tr>
                    <th>Student ID</th>
                    <th>Candidate</th>
                    <th>Roll / Enrollment</th>
                    <th>Class & Batch</th>
                    <th>Status</th>
                    <th>Joined</th>
                    <th className="text-end">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((st) => (
                    <tr key={st.id}>
                      <td>
                        <span className="badge bg-light text-dark font-monospace border">
                          {st.student_id}
                        </span>
                      </td>
                      <td>
                        <div className="fw-bold text-dark">{st.user?.name || 'Unnamed'}</div>
                        <div className="text-muted">{st.user?.email}</div>
                      </td>
                      <td>
                        <div className="fw-semibold">{st.roll_no || '—'}</div>
                        <div className="text-muted" style={{ fontSize: '0.72rem' }}>
                          {st.enrollment_no ? `Enr: ${st.enrollment_no}` : ''}
                        </div>
                      </td>
                      <td>
                        <span className="badge bg-primary bg-opacity-10 text-primary me-1">
                          {st.class?.name || 'Class N/A'}
                        </span>
                        <span className="badge bg-secondary bg-opacity-10 text-secondary">
                          {st.batch?.name || 'Batch N/A'}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            st.is_active ? 'bg-success text-white' : 'bg-danger text-white'
                          }`}
                        >
                          {st.is_active ? 'Active' : 'Suspended'}
                        </span>
                      </td>
                      <td className="text-muted">
                        {new Date(st.created_at).toLocaleDateString()}
                      </td>
                      <td className="text-end">
                        <button
                          className={`btn btn-xs py-1 px-2 ${
                            st.is_active ? 'btn-outline-danger' : 'btn-outline-success'
                          }`}
                          onClick={() => handleToggleStatus(st)}
                          disabled={actionLoading}
                          title={st.is_active ? 'Suspend access' : 'Activate student'}
                        >
                          <i
                            className={`bi ${st.is_active ? 'bi-person-x' : 'bi-person-check'} me-1`}
                          ></i>
                          {st.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="card-footer bg-white border-top py-3 d-flex justify-content-between align-items-center">
            <span className="text-muted small">
              Page {currentPage} of {totalPages}
            </span>
            <ul className="pagination pagination-sm mb-0">
              <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                <button
                  className="page-link"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </button>
              </li>
              {[...Array(Math.min(5, totalPages))].map((_, i) => {
                const pageNum = i + 1;
                return (
                  <li
                    key={pageNum}
                    className={`page-item ${currentPage === pageNum ? 'active' : ''}`}
                  >
                    <button className="page-link" onClick={() => setCurrentPage(pageNum)}>
                      {pageNum}
                    </button>
                  </li>
                );
              })}
              <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
                <button
                  className="page-link"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </button>
              </li>
            </ul>
          </div>
        )}
      </div>

      {/* Register Individual Student Modal */}
      {showAddModal && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
        >
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content shadow border-0 rounded-3">
              <div className="modal-header bg-primary text-white">
                <h5 className="modal-title d-flex align-items-center gap-2">
                  <i className="bi bi-person-plus-fill"></i> Register New Student
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setShowAddModal(false)}
                ></button>
              </div>

              <form onSubmit={handleAddSubmit}>
                <div className="modal-body p-4">
                  <div className="row g-3">
                    <div className="col-12 col-md-6">
                      <label className="form-label small fw-bold">Full Name *</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="e.g. Priya Sharma"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      />
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label small fw-bold">Email Address *</label>
                      <input
                        type="email"
                        className="form-control form-control-sm"
                        placeholder="e.g. priya.sharma@student.edu"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      />
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label small fw-bold">Academic Class *</label>
                      <select
                        className="form-select form-select-sm"
                        required
                        value={formData.class_id}
                        onChange={(e) => {
                          setFormData({ ...formData, class_id: e.target.value, batch_id: '' });
                          loadBatchesForClass(e.target.value);
                        }}
                      >
                        <option value="">Select Class...</option>
                        {classes.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label small fw-bold">Academic Batch *</label>
                      <select
                        className="form-select form-select-sm"
                        required
                        value={formData.batch_id}
                        onChange={(e) => setFormData({ ...formData, batch_id: e.target.value })}
                        disabled={!formData.class_id}
                      >
                        <option value="">Select Batch...</option>
                        {batches.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label small fw-bold">Roll Number</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="e.g. CS-2026-042"
                        value={formData.roll_no}
                        onChange={(e) => setFormData({ ...formData, roll_no: e.target.value })}
                      />
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label small fw-bold">Gender</label>
                      <select
                        className="form-select form-select-sm"
                        value={formData.gender}
                        onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                      >
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </select>
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label small fw-bold">Default Password</label>
                      <input
                        type="text"
                        className="form-control form-control-sm font-monospace"
                        placeholder="Student@123"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      />
                      <small className="text-muted">Leave blank to use default (Student@123)</small>
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label small fw-bold">Parent Phone</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="+91-9876543210"
                        value={formData.parent_phone}
                        onChange={(e) => setFormData({ ...formData, parent_phone: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div className="modal-footer bg-light">
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    onClick={() => setShowAddModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-sm btn-primary"
                    disabled={actionLoading}
                  >
                    {actionLoading ? 'Registering...' : 'Complete Registration'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Bulk CSV Import Modal */}
      {showBulkModal && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
        >
          <div className="modal-dialog modal-dialog-centered modal-xl">
            <div className="modal-content shadow border-0 rounded-3">
              <div className="modal-header bg-dark text-white">
                <h5 className="modal-title d-flex align-items-center gap-2">
                  <i className="bi bi-file-earmark-spreadsheet-fill text-success"></i> Bulk Student
                  Roster CSV Import
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setShowBulkModal(false)}
                ></button>
              </div>

              <form onSubmit={handleBulkImportSubmit}>
                <div className="modal-body p-4">
                  {/* Mode Selector Tabs & Template Download */}
                  <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3 border-bottom pb-3">
                    <div className="btn-group btn-group-sm">
                      <button
                        type="button"
                        className={`btn ${importMode === 'excel' ? 'btn-primary' : 'btn-outline-primary'}`}
                        onClick={() => setImportMode('excel')}
                      >
                        <i className="bi bi-file-earmark-excel me-1"></i> Upload Excel / CSV
                      </button>
                      <button
                        type="button"
                        className={`btn ${importMode === 'csv_text' ? 'btn-primary' : 'btn-outline-primary'}`}
                        onClick={() => setImportMode('csv_text')}
                      >
                        <i className="bi bi-file-text me-1"></i> Paste CSV Raw
                      </button>
                    </div>

                    <button
                      type="button"
                      className="btn btn-outline-success btn-sm d-flex align-items-center gap-1 shadow-sm"
                      onClick={handleDownloadTemplate}
                      disabled={actionLoading}
                    >
                      <i className="bi bi-file-earmark-arrow-down-fill"></i>
                      <span>Download Sample Excel Template</span>
                    </button>
                  </div>

                  {/* Select Default Class & Batch */}
                  <div className="row g-3 mb-3">
                    <div className="col-12 col-md-6">
                      <label className="form-label small fw-bold">Default Target Class</label>
                      <select
                        className="form-select form-select-sm"
                        value={bulkDefaultClass}
                        onChange={(e) => {
                          setBulkDefaultClass(e.target.value);
                          setBulkDefaultBatch('');
                          loadBatchesForClass(e.target.value);
                        }}
                      >
                        <option value="">Select Target Class (or auto-match from Excel)...</option>
                        {classes.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label small fw-bold">Default Target Batch</label>
                      <select
                        className="form-select form-select-sm"
                        value={bulkDefaultBatch}
                        onChange={(e) => setBulkDefaultBatch(e.target.value)}
                        disabled={!bulkDefaultClass}
                      >
                        <option value="">Select Target Batch (or auto-match from Excel)...</option>
                        {batches.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Mode 1: Excel File Upload Dropzone */}
                  {importMode === 'excel' ? (
                    <div className="mb-3 p-4 bg-light rounded-3 border text-center">
                      <i className="bi bi-cloud-arrow-up text-primary fs-1 d-block mb-2"></i>
                      <h6 className="fw-bold mb-1">Select Student Roster Spreadsheet</h6>
                      <p className="text-muted small mb-3">
                        Supported file formats: <strong>.xlsx, .xls, .csv</strong> (Columns: Full Name, Email Address, Roll Number, Class, Batch)
                      </p>
                      <input
                        type="file"
                        className="form-control form-control-sm mx-auto"
                        style={{ maxWidth: '400px' }}
                        accept=".xlsx, .xls, .csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                        onChange={(e) => setSelectedFile(e.target.files[0] || null)}
                      />
                      {selectedFile && (
                        <div className="mt-2 text-success small fw-semibold">
                          <i className="bi bi-check-circle-fill me-1"></i> Ready to import: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Mode 2: CSV Input Textarea */
                    <div className="mb-3">
                      <label className="form-label small fw-bold d-flex justify-content-between">
                        <span>Paste CSV Content (Comma-Separated Values):</span>
                        <span className="text-muted fw-normal">
                          Format: Name, Email, Roll No, Gender
                        </span>
                      </label>
                      <textarea
                        className="form-control font-monospace small"
                        rows="6"
                        placeholder={`Name, Email, Roll No, Gender\nArjun Kumar, arjun.k@student.edu, ROLL-001, male\nSneha Patel, sneha.p@student.edu, ROLL-002, female`}
                        value={bulkCsvText}
                        onChange={(e) => handleCsvTextChange(e.target.value)}
                      ></textarea>
                    </div>
                  )}

                  {/* Live Parsed Preview Table */}
                  {importMode === 'csv_text' && bulkPreview.length > 0 && (
                    <div className="border rounded p-3 bg-light">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <span className="fw-bold small text-secondary">
                          Detected Records Preview ({bulkPreview.filter((r) => r.isValid).length} Valid,{' '}
                          {bulkPreview.filter((r) => !r.isValid).length} Invalid)
                        </span>
                      </div>
                      <div className="table-responsive" style={{ maxHeight: '200px' }}>
                        <table className="table table-sm table-bordered bg-white mb-0 small">
                          <thead>
                            <tr className="table-light">
                              <th>Row</th>
                              <th>Name</th>
                              <th>Email</th>
                              <th>Roll No</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {bulkPreview.map((r) => (
                              <tr key={r.rowNum} className={!r.isValid ? 'table-danger' : ''}>
                                <td>{r.rowNum}</td>
                                <td>{r.name || '—'}</td>
                                <td>{r.email || '—'}</td>
                                <td>{r.roll_no || '—'}</td>
                                <td>
                                  {r.isValid ? (
                                    <span className="badge bg-success">Ready</span>
                                  ) : (
                                    <span className="badge bg-danger">Invalid Format</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Bulk Result Summary */}
                  {bulkResult && (
                    <div className="alert alert-info mt-3 p-2 small">
                      <strong>Import Result:</strong> {bulkResult.importedCount} student(s) imported
                      successfully! {bulkResult.skippedCount > 0 && `(${bulkResult.skippedCount} skipped due to duplicate email).`}
                    </div>
                  )}
                </div>

                <div className="modal-footer bg-light">
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    onClick={() => setShowBulkModal(false)}
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    className="btn btn-sm btn-success d-flex align-items-center gap-2"
                    disabled={
                      actionLoading ||
                      (importMode === 'excel'
                        ? !selectedFile
                        : bulkPreview.filter((r) => r.isValid).length === 0)
                    }
                  >
                    {actionLoading ? (
                      <>
                        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                        <span>Processing Roster...</span>
                      </>
                    ) : (
                      <>
                        <i className="bi bi-cloud-arrow-up-fill"></i>
                        <span>Execute Bulk Import</span>
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

export default StudentManagement;
