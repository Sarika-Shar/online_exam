import React, { useState, useEffect, useMemo } from 'react';
import { userService } from '../../services/userService';
import { useAuth } from '../../context/AuthContext';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const TeacherManagement = () => {
  const { user: currentUser } = useAuth();
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState(null);

  // Add Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    username: '',
    password: '',
    phone: '',
    role: 'teacher'
  });

  // Edit Form state
  const [editFormData, setEditFormData] = useState({
    name: '',
    email: '',
    username: '',
    phone: '',
    password: ''
  });

  useEffect(() => {
    loadTeachers();
  }, []);

  const loadTeachers = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await userService.getUsers({ role: 'teacher' });
      if (res.success && res.data) {
        // Double filter client-side just in case
        const teacherList = res.data.filter((u) => u.role === 'teacher');
        setTeachers(teacherList);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load faculty list.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleEditInputChange = (e) => {
    const { name, value } = e.target;
    setEditFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim() || !formData.username.trim() || !formData.password.trim()) {
      setError('Please fill in all required fields (Name, Email, Username, Password).');
      return;
    }

    try {
      setActionLoading(true);
      setError(null);

      const payload = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        username: formData.username.trim(),
        password: formData.password,
        phone: formData.phone.trim() || undefined,
        role: 'teacher',
        institution_id: currentUser?.institution_id
      };

      const res = await userService.createUser(payload);
      if (res.success) {
        setSuccessMsg(`Teacher "${formData.name}" successfully registered!`);
        setShowAddModal(false);
        setFormData({
          name: '',
          email: '',
          username: '',
          password: '',
          phone: '',
          role: 'teacher'
        });
        loadTeachers();
        setTimeout(() => setSuccessMsg(null), 4000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to register teacher.');
    } finally {
      setActionLoading(false);
    }
  };

  const openEditModal = (teacher) => {
    setSelectedTeacher(teacher);
    setEditFormData({
      name: teacher.name || '',
      email: teacher.email || '',
      username: teacher.username || '',
      phone: teacher.phone || '',
      password: ''
    });
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editFormData.name.trim() || !editFormData.email.trim() || !editFormData.username.trim()) {
      setError('Name, Email, and Username are required.');
      return;
    }

    try {
      setActionLoading(true);
      setError(null);

      const payload = {
        name: editFormData.name.trim(),
        email: editFormData.email.trim(),
        username: editFormData.username.trim(),
        phone: editFormData.phone.trim() || null
      };

      if (editFormData.password && editFormData.password.trim()) {
        payload.password = editFormData.password.trim();
      }

      const res = await userService.updateUser(selectedTeacher.id, payload);
      if (res.success) {
        setSuccessMsg(`Teacher "${editFormData.name}" updated successfully.`);
        setShowEditModal(false);
        setSelectedTeacher(null);
        loadTeachers();
        setTimeout(() => setSuccessMsg(null), 4000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update teacher.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleStatus = async (teacher) => {
    const actionName = teacher.is_active ? 'deactivate' : 'activate';
    if (!window.confirm(`Are you sure you want to ${actionName} teacher "${teacher.name}"?`)) {
      return;
    }

    try {
      setActionLoading(true);
      const res = await userService.toggleUserStatus(teacher.id);
      if (res.success) {
        setSuccessMsg(`Teacher status updated successfully.`);
        loadTeachers();
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to toggle status.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteTeacher = async (teacher) => {
    if (!window.confirm(`Are you sure you want to permanently remove teacher "${teacher.name}" (${teacher.email})?`)) {
      return;
    }

    try {
      setActionLoading(true);
      const res = await userService.deleteUser(teacher.id);
      if (res.success) {
        setSuccessMsg(`Teacher "${teacher.name}" deleted successfully.`);
        loadTeachers();
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete teacher.');
    } finally {
      setActionLoading(false);
    }
  };

  // Filtered teachers
  const filteredTeachers = useMemo(() => {
    return teachers.filter((t) => {
      const matchSearch =
        !searchTerm.trim() ||
        t.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.phone?.includes(searchTerm);

      const matchStatus =
        selectedStatus === 'all' ||
        (selectedStatus === 'active' && t.is_active) ||
        (selectedStatus === 'inactive' && !t.is_active);

      return matchSearch && matchStatus;
    });
  }, [teachers, searchTerm, selectedStatus]);

  const activeCount = teachers.filter((t) => t.is_active).length;
  const inactiveCount = teachers.length - activeCount;

  return (
    <div className="container-fluid py-4 px-4">
      {/* Header */}
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-4">
        <div>
          <h3 className="fw-bold mb-1 d-flex align-items-center gap-2">
            <i className="bi bi-person-workspace text-primary"></i>
            Faculty & Teacher Management
          </h3>
          <p className="text-muted mb-0">
            Provision teacher accounts, assign exam authoring rights, and manage faculty credentials.
          </p>
        </div>

        <div className="d-flex align-items-center gap-2 mt-2 mt-md-0">
          <button
            className="btn btn-sm btn-outline-secondary"
            onClick={loadTeachers}
            disabled={loading || actionLoading}
            title="Refresh List"
          >
            <i className={`bi bi-arrow-clockwise me-1 ${loading ? 'spin' : ''}`}></i> Refresh
          </button>
          <button
            className="btn btn-sm btn-primary"
            onClick={() => setShowAddModal(true)}
            title="Add New Teacher"
          >
            <i className="bi bi-person-plus-fill me-1"></i> Add Teacher
          </button>
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
        <div className="col-12 col-sm-4">
          <div className="card shadow-sm border-0 border-start border-primary border-4 rounded-3 p-3 h-100">
            <span className="text-muted small fw-bold text-uppercase">Total Faculty</span>
            <h3 className="fw-bold mt-1 mb-0">{teachers.length}</h3>
            <small className="text-muted">Registered Teachers</small>
          </div>
        </div>
        <div className="col-12 col-sm-4">
          <div className="card shadow-sm border-0 border-start border-success border-4 rounded-3 p-3 h-100">
            <span className="text-success small fw-bold text-uppercase">Active Faculty</span>
            <h3 className="fw-bold mt-1 mb-0 text-success">{activeCount}</h3>
            <small className="text-muted">Can login & create exams</small>
          </div>
        </div>
        <div className="col-12 col-sm-4">
          <div className="card shadow-sm border-0 border-start border-warning border-4 rounded-3 p-3 h-100">
            <span className="text-warning small fw-bold text-uppercase">Inactive / Suspended</span>
            <h3 className="fw-bold mt-1 mb-0 text-warning">{inactiveCount}</h3>
            <small className="text-muted">Access suspended</small>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="card border-0 shadow-sm rounded-3 p-3 mb-4">
        <div className="row g-2 align-items-center">
          <div className="col-12 col-md-8">
            <div className="input-group">
              <span className="input-group-text bg-white border-end-0">
                <i className="bi bi-search text-muted"></i>
              </span>
              <input
                type="text"
                className="form-control border-start-0 ps-0"
                placeholder="Search teacher by name, email, username or phone..."
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
          <div className="col-12 col-md-4">
            <select
              className="form-select"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="card border-0 shadow-sm rounded-3 overflow-hidden">
        {loading ? (
          <div className="py-5">
            <LoadingSpinner message="Loading faculty roster..." />
          </div>
        ) : filteredTeachers.length === 0 ? (
          <div className="text-center py-5">
            <div className="mb-3 text-muted">
              <i className="bi bi-person-x fs-1"></i>
            </div>
            <h5 className="fw-bold text-secondary">No Teachers Found</h5>
            <p className="text-muted small">
              {searchTerm ? 'No faculty matched your search criteria.' : 'Start by onboarding your first faculty member.'}
            </p>
            {!searchTerm && (
              <button className="btn btn-primary btn-sm mt-2" onClick={() => setShowAddModal(true)}>
                <i className="bi bi-person-plus-fill me-1"></i> Add First Teacher
              </button>
            )}
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light text-uppercase small text-muted">
                <tr>
                  <th className="ps-4">Teacher Name</th>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Institution</th>
                  <th>Status</th>
                  <th>Joined Date</th>
                  <th className="text-end pe-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTeachers.map((t) => (
                  <tr key={t.id}>
                    <td className="ps-4">
                      <div className="d-flex align-items-center gap-2">
                        <div
                          className="rounded-circle bg-primary-subtle text-primary d-flex align-items-center justify-content-center fw-bold"
                          style={{ width: '36px', height: '36px', fontSize: '0.9rem' }}
                        >
                          {t.name ? t.name.charAt(0).toUpperCase() : 'T'}
                        </div>
                        <div>
                          <div className="fw-semibold text-dark">{t.name}</div>
                          <span className="badge bg-info-subtle text-info-emphasis rounded-pill" style={{ fontSize: '0.68rem' }}>
                            Faculty
                          </span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <code>{t.username}</code>
                    </td>
                    <td>
                      <span className="text-secondary">{t.email}</span>
                    </td>
                    <td>
                      <span className="text-secondary">{t.phone || '—'}</span>
                    </td>
                    <td>
                      <span className="small text-muted">{t.institution?.name || 'All Institutions'}</span>
                    </td>
                    <td>
                      {t.is_active ? (
                        <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-1">
                          <i className="bi bi-check-circle-fill me-1"></i> Active
                        </span>
                      ) : (
                        <span className="badge bg-secondary-subtle text-secondary border border-secondary-subtle px-2 py-1">
                          <i className="bi bi-dash-circle-fill me-1"></i> Inactive
                        </span>
                      )}
                    </td>
                    <td>
                      <span className="small text-muted">
                        {t.created_at ? new Date(t.created_at).toLocaleDateString() : '—'}
                      </span>
                    </td>
                    <td className="text-end pe-4">
                      <div className="btn-group btn-group-sm">
                        <button
                          className={`btn ${t.is_active ? 'btn-outline-warning' : 'btn-outline-success'}`}
                          onClick={() => handleToggleStatus(t)}
                          title={t.is_active ? 'Deactivate Account' : 'Activate Account'}
                          disabled={actionLoading}
                        >
                          <i className={`bi ${t.is_active ? 'bi-lock-fill' : 'bi-unlock-fill'}`}></i>
                        </button>
                        <button
                          className="btn btn-outline-primary"
                          onClick={() => openEditModal(t)}
                          title="Edit Teacher"
                          disabled={actionLoading}
                        >
                          <i className="bi bi-pencil-fill"></i>
                        </button>
                        <button
                          className="btn btn-outline-danger"
                          onClick={() => handleDeleteTeacher(t)}
                          title="Delete Teacher"
                          disabled={actionLoading}
                        >
                          <i className="bi bi-trash-fill"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Teacher Modal */}
      {showAddModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg rounded-3">
              <div className="modal-header border-bottom">
                <h5 className="modal-title fw-bold">
                  <i className="bi bi-person-plus-fill text-primary me-2"></i>
                  Add New Teacher
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowAddModal(false)}
                  disabled={actionLoading}
                ></button>
              </div>
              <form onSubmit={handleAddSubmit}>
                <div className="modal-body p-4">
                  <div className="mb-3">
                    <label className="form-label fw-semibold">
                      Full Name <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      name="name"
                      placeholder="e.g. Dr. Rajesh Sharma"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                    />
                  </div>

                  <div className="row g-3 mb-3">
                    <div className="col-12 col-md-6">
                      <label className="form-label fw-semibold">
                        Email Address <span className="text-danger">*</span>
                      </label>
                      <input
                        type="email"
                        className="form-control"
                        name="email"
                        placeholder="teacher@apex.edu"
                        value={formData.email}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label fw-semibold">
                        Username <span className="text-danger">*</span>
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        name="username"
                        placeholder="rajesh_teacher"
                        value={formData.username}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                  </div>

                  <div className="row g-3 mb-3">
                    <div className="col-12 col-md-6">
                      <label className="form-label fw-semibold">
                        Password <span className="text-danger">*</span>
                      </label>
                      <input
                        type="password"
                        className="form-control"
                        name="password"
                        placeholder="Min 6 characters"
                        value={formData.password}
                        onChange={handleInputChange}
                        required
                        minLength={6}
                      />
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label fw-semibold">Phone Number</label>
                      <input
                        type="tel"
                        className="form-control"
                        name="phone"
                        placeholder="+91-9876543210"
                        value={formData.phone}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>

                  <div className="p-3 bg-light rounded-2 border">
                    <div className="d-flex gap-2">
                      <i className="bi bi-info-circle-fill text-primary"></i>
                      <div className="small text-muted">
                        This user will be assigned the <strong>Teacher</strong> role. They will have access to create and schedule exams, author question banks, and review results.
                      </div>
                    </div>
                  </div>
                </div>

                <div className="modal-footer border-top">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowAddModal(false)}
                    disabled={actionLoading}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={actionLoading}>
                    {actionLoading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                        Registering...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-check2-circle me-1"></i> Register Teacher
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Teacher Modal */}
      {showEditModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg rounded-3">
              <div className="modal-header border-bottom">
                <h5 className="modal-title fw-bold">
                  <i className="bi bi-pencil-square text-primary me-2"></i>
                  Edit Teacher Details
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowEditModal(false)}
                  disabled={actionLoading}
                ></button>
              </div>
              <form onSubmit={handleEditSubmit}>
                <div className="modal-body p-4">
                  <div className="mb-3">
                    <label className="form-label fw-semibold">
                      Full Name <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      name="name"
                      value={editFormData.name}
                      onChange={handleEditInputChange}
                      required
                    />
                  </div>

                  <div className="row g-3 mb-3">
                    <div className="col-12 col-md-6">
                      <label className="form-label fw-semibold">
                        Email Address <span className="text-danger">*</span>
                      </label>
                      <input
                        type="email"
                        className="form-control"
                        name="email"
                        value={editFormData.email}
                        onChange={handleEditInputChange}
                        required
                      />
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label fw-semibold">
                        Username <span className="text-danger">*</span>
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        name="username"
                        value={editFormData.username}
                        onChange={handleEditInputChange}
                        required
                      />
                    </div>
                  </div>

                  <div className="row g-3 mb-3">
                    <div className="col-12 col-md-6">
                      <label className="form-label fw-semibold">Reset Password</label>
                      <input
                        type="password"
                        className="form-control"
                        name="password"
                        placeholder="Leave blank to keep current"
                        value={editFormData.password}
                        onChange={handleEditInputChange}
                        minLength={6}
                      />
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label fw-semibold">Phone Number</label>
                      <input
                        type="tel"
                        className="form-control"
                        name="phone"
                        value={editFormData.phone}
                        onChange={handleEditInputChange}
                      />
                    </div>
                  </div>
                </div>

                <div className="modal-footer border-top">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowEditModal(false)}
                    disabled={actionLoading}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={actionLoading}>
                    {actionLoading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                        Saving...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-save me-1"></i> Save Changes
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

export default TeacherManagement;
