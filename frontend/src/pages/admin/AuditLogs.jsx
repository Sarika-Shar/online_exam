import React, { useState, useEffect } from 'react';
import { auditLogService } from '../../services/auditLogService';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const AuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [actionsList, setActionsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAction, setSelectedAction] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Inspector Modal state
  const [activeLogModal, setActiveLogModal] = useState(null);

  useEffect(() => {
    loadActionsList();
  }, []);

  useEffect(() => {
    loadLogs(currentPage);
  }, [currentPage, pageSize, selectedAction, startDate, endDate]);

  const loadActionsList = async () => {
    try {
      const res = await auditLogService.getAuditActions();
      if (res.success && res.data) {
        setActionsList(res.data);
      }
    } catch (err) {
      console.error('Failed to load audit actions:', err);
    }
  };

  const loadLogs = async (page = 1) => {
    try {
      setLoading(true);
      setError(null);

      const params = {
        page,
        limit: pageSize,
        search: searchTerm.trim() || undefined,
        action: selectedAction || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined
      };

      const res = await auditLogService.getAuditLogs(params);
      if (res.success) {
        setLogs(res.data.logs || []);
        setTotalPages(res.data.pagination.totalPages || 1);
        setTotalCount(res.data.pagination.totalLogs || 0);
        setCurrentPage(res.data.pagination.page || 1);
      } else {
        setError(res.message || 'Failed to fetch audit trail.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Error loading audit logs. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    loadLogs(1);
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedAction('');
    setStartDate('');
    setEndDate('');
    setCurrentPage(1);
  };

  const getActionBadgeClass = (action = '') => {
    const act = action.toUpperCase();
    if (act.includes('FAILED') || act.includes('VIOLATION') || act.includes('SECURITY')) {
      return 'bg-danger text-white';
    }
    if (act.includes('DELETE') || act.includes('REVOKE')) {
      return 'bg-warning text-dark';
    }
    if (act.includes('LOGIN') || act.includes('AUTH')) {
      return 'bg-info text-dark';
    }
    if (act.includes('SUBMIT') || act.includes('FINALIZE') || act.includes('CREATE')) {
      return 'bg-success text-white';
    }
    if (act.includes('EXAM') || act.includes('ATTEMPT')) {
      return 'bg-primary text-white';
    }
    return 'bg-secondary text-white';
  };

  const formatDate = (isoString) => {
    if (!isoString) return '—';
    const d = new Date(isoString);
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div className="container-fluid py-4 px-4">
      {/* Page Header */}
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-4">
        <div>
          <h3 className="fw-bold mb-1 d-flex align-items-center gap-2">
            <i className="bi bi-shield-lock-fill text-primary"></i>
            System Security & Audit Trail
          </h3>
          <p className="text-muted mb-0">
            Immutable, cryptographically verifiable telemetry of all administrative and student assessment activities.
          </p>
        </div>
        <div className="d-flex align-items-center gap-2 mt-2 mt-md-0">
          <span className="badge bg-light text-dark border px-3 py-2 fw-semibold">
            <i className="bi bi-database-check text-success me-1"></i>
            Total Logged Events: {totalCount}
          </span>
          <button
            className="btn btn-sm btn-outline-primary"
            onClick={() => loadLogs(currentPage)}
            title="Refresh logs"
          >
            <i className="bi bi-arrow-clockwise me-1"></i> Refresh
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="row g-3 mb-4">
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card shadow-sm border-0 border-start border-primary border-4 rounded-3 h-100 p-3">
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <span className="text-muted small fw-bold text-uppercase">Recorded Events</span>
                <h4 className="fw-bold mt-1 mb-0">{totalCount}</h4>
              </div>
              <div className="bg-primary bg-opacity-10 text-primary rounded-circle p-3">
                <i className="bi bi-list-check fs-4"></i>
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card shadow-sm border-0 border-start border-success border-4 rounded-3 h-100 p-3">
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <span className="text-muted small fw-bold text-uppercase">Active Guard</span>
                <h4 className="fw-bold mt-1 mb-0 text-success">SQLi & XSS Shield</h4>
              </div>
              <div className="bg-success bg-opacity-10 text-success rounded-circle p-3">
                <i className="bi bi-shield-check fs-4"></i>
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card shadow-sm border-0 border-start border-info border-4 rounded-3 h-100 p-3">
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <span className="text-muted small fw-bold text-uppercase">IP Geolocation</span>
                <h4 className="fw-bold mt-1 mb-0">Full Remote Trace</h4>
              </div>
              <div className="bg-info bg-opacity-10 text-info rounded-circle p-3">
                <i className="bi bi-geo-alt-fill fs-4"></i>
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card shadow-sm border-0 border-start border-warning border-4 rounded-3 h-100 p-3">
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <span className="text-muted small fw-bold text-uppercase">Rate Limiting</span>
                <h4 className="fw-bold mt-1 mb-0 text-warning">100 req / 15m</h4>
              </div>
              <div className="bg-warning bg-opacity-10 text-warning rounded-circle p-3">
                <i className="bi bi-speedometer fs-4"></i>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="card shadow-sm border-0 rounded-3 mb-4">
        <div className="card-body p-3">
          <form onSubmit={handleSearchSubmit} className="row g-2 align-items-center">
            {/* Search Input */}
            <div className="col-12 col-md-4 col-lg-3">
              <div className="input-group input-group-sm">
                <span className="input-group-text bg-light border-end-0">
                  <i className="bi bi-search text-muted"></i>
                </span>
                <input
                  type="text"
                  className="form-control border-start-0"
                  placeholder="Search user, IP, action..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            {/* Action Type Dropdown */}
            <div className="col-12 col-sm-6 col-md-3 col-lg-3">
              <select
                className="form-select form-select-sm"
                value={selectedAction}
                onChange={(e) => {
                  setSelectedAction(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="">All Action Types</option>
                {actionsList.map((a, i) => (
                  <option key={i} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>

            {/* Start Date */}
            <div className="col-6 col-sm-3 col-md-2">
              <input
                type="date"
                className="form-control form-control-sm"
                placeholder="Start Date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>

            {/* End Date */}
            <div className="col-6 col-sm-3 col-md-2">
              <input
                type="date"
                className="form-control form-control-sm"
                placeholder="End Date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>

            {/* Action Buttons */}
            <div className="col-12 col-lg-2 d-flex gap-2">
              <button type="submit" className="btn btn-sm btn-primary flex-fill">
                <i className="bi bi-funnel-fill me-1"></i> Filter
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={handleClearFilters}
                title="Reset filters"
              >
                Reset
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="card shadow-sm border-0 rounded-3">
        <div className="card-header bg-white border-bottom py-3 d-flex justify-content-between align-items-center">
          <span className="fw-semibold text-secondary">
            Displaying {logs.length} of {totalCount} Records
          </span>
          <div className="d-flex align-items-center gap-2">
            <span className="small text-muted">Rows per page:</span>
            <select
              className="form-select form-select-sm"
              style={{ width: '80px' }}
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
            >
              <option value="15">15</option>
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </div>
        </div>

        <div className="card-body p-0">
          {loading ? (
            <div className="py-5 text-center">
              <LoadingSpinner message="Querying secure audit ledger..." />
            </div>
          ) : error ? (
            <div className="alert alert-danger m-3 mb-0" role="alert">
              <i className="bi bi-exclamation-triangle-fill me-2"></i>
              {error}
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-5">
              <i className="bi bi-shield-slash fs-1 text-muted d-block mb-3"></i>
              <h5 className="text-secondary">No Audit Log Records Found</h5>
              <p className="text-muted small">No security actions match your filter criteria.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light text-uppercase small text-muted">
                  <tr>
                    <th scope="col" style={{ width: '180px' }}>Timestamp</th>
                    <th scope="col">User</th>
                    <th scope="col">Action</th>
                    <th scope="col">Entity</th>
                    <th scope="col">Client IP</th>
                    <th scope="col">User Agent</th>
                    <th scope="col" className="text-end" style={{ width: '100px' }}>Telemetry</th>
                  </tr>
                </thead>
                <tbody className="small">
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td className="text-nowrap text-muted fw-semibold">
                        {formatDate(log.created_at)}
                      </td>
                      <td>
                        {log.user ? (
                          <div>
                            <div className="fw-bold text-dark">{log.user.name}</div>
                            <div className="text-muted small">{log.user.email}</div>
                          </div>
                        ) : (
                          <span className="text-muted fst-italic">Anonymous / System</span>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${getActionBadgeClass(log.action)} px-2 py-1`}>
                          {log.action}
                        </span>
                      </td>
                      <td>
                        {log.entity_type ? (
                          <span className="badge bg-light text-secondary border">
                            {log.entity_type} {log.entity_id ? `#${log.entity_id}` : ''}
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td>
                        <span className="badge bg-light text-dark font-monospace border">
                          {log.ip_address || '127.0.0.1'}
                        </span>
                      </td>
                      <td style={{ maxWidth: '240px' }} className="text-truncate text-muted" title={log.user_agent}>
                        {log.user_agent || 'Unknown Agent'}
                      </td>
                      <td className="text-end">
                        <button
                          className="btn btn-xs btn-outline-secondary py-1 px-2"
                          onClick={() => setActiveLogModal(log)}
                          title="Inspect raw telemetry payload"
                        >
                          <i className="bi bi-code-slash me-1"></i> JSON
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
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </button>
              </li>
              {[...Array(Math.min(5, totalPages))].map((_, i) => {
                const pageNum = i + 1;
                return (
                  <li key={pageNum} className={`page-item ${currentPage === pageNum ? 'active' : ''}`}>
                    <button className="page-link" onClick={() => setCurrentPage(pageNum)}>
                      {pageNum}
                    </button>
                  </li>
                );
              })}
              <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
                <button
                  className="page-link"
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </button>
              </li>
            </ul>
          </div>
        )}
      </div>

      {/* JSON Payload Inspector Modal */}
      {activeLogModal && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
        >
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content shadow">
              <div className="modal-header bg-dark text-white">
                <h5 className="modal-title d-flex align-items-center gap-2">
                  <i className="bi bi-file-earmark-code"></i>
                  Audit Log Telemetry Details (ID: #{activeLogModal.id})
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setActiveLogModal(null)}
                ></button>
              </div>
              <div className="modal-body p-4">
                <div className="row g-2 mb-3">
                  <div className="col-sm-6">
                    <strong>Action:</strong>{' '}
                    <span className={`badge ${getActionBadgeClass(activeLogModal.action)}`}>
                      {activeLogModal.action}
                    </span>
                  </div>
                  <div className="col-sm-6">
                    <strong>Timestamp:</strong> {formatDate(activeLogModal.created_at)}
                  </div>
                  <div className="col-sm-6">
                    <strong>User:</strong> {activeLogModal.user?.name || 'System / Anonymous'} (
                    {activeLogModal.user?.email || 'N/A'})
                  </div>
                  <div className="col-sm-6">
                    <strong>IP Address:</strong>{' '}
                    <code className="text-primary">{activeLogModal.ip_address}</code>
                  </div>
                </div>

                <div className="mb-2 fw-semibold text-secondary">Structured Telemetry Payload:</div>
                <pre
                  className="bg-light p-3 rounded border font-monospace text-dark"
                  style={{ maxHeight: '320px', overflowY: 'auto', fontSize: '0.85rem' }}
                >
                  {JSON.stringify(activeLogModal.details, null, 2) || '{}'}
                </pre>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setActiveLogModal(null)}
                >
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

export default AuditLogs;
