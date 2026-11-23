import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { dashboardService } from '../../services/dashboardService';
import StatCard from '../../components/common/StatCard';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import RecentActivityList from '../../components/dashboard/RecentActivityList';
import UpcomingExamsList from '../../components/dashboard/UpcomingExamsList';
import ExamPerformanceChart from '../../components/dashboard/ExamPerformanceChart';
import { Link } from 'react-router-dom';

const AdminDashboard = () => {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboardData = async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) setRefreshing(true);
      setError(null);
      const res = await dashboardService.getStats();
      if (res.success) {
        setData(res.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load dashboard metrics.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="p-4">
        <LoadingSpinner message="Loading institutional analytics..." />
      </div>
    );
  }

  const { summary, recentActivities, upcomingExams } = data || {
    summary: {},
    recentActivities: [],
    upcomingExams: []
  };

  return (
    <div className="container-fluid py-3 py-sm-4 px-2 px-sm-3 px-md-4" style={{ minWidth: 0, maxWidth: '100%', overflowX: 'hidden' }}>
      {/* Header Banner */}
      <div className="d-flex flex-column flex-md-row align-items-start align-items-md-center justify-content-between pb-3 mb-4 border-bottom gap-3">
        <div>
          <h2 className="fw-bold text-dark mb-1 fs-3 fs-sm-2">
            Institutional Dashboard
          </h2>
          <p className="text-muted mb-0 small">
            Welcome back, <span className="fw-semibold text-primary">{user?.name}</span>. Here is the operational summary for{' '}
            <span className="fw-semibold text-dark">
              {(user?.institution?.name || 'All Institutions').replace(/Apex International University/gi, 'Our International University')}
            </span>.
          </p>
        </div>
        <div className="d-flex flex-wrap align-items-center gap-2 w-100 w-md-auto">
          <button
            className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-2 flex-grow-1 flex-sm-grow-0 justify-content-center"
            onClick={() => fetchDashboardData(true)}
            disabled={refreshing}
          >
            <i className={`bi bi-arrow-clockwise ${refreshing ? 'spin' : ''}`}></i>
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
          {['super_admin', 'institution_admin'].includes(user?.role) && (
            <Link to="/admin/teachers" className="btn btn-outline-primary btn-sm d-flex align-items-center gap-2 shadow-sm flex-grow-1 flex-sm-grow-0 justify-content-center">
              <i className="bi bi-person-workspace"></i>
              <span>Faculty</span>
            </Link>
          )}
          <Link to="/admin/exams" className="btn btn-primary btn-sm d-flex align-items-center gap-2 shadow-sm flex-grow-1 flex-sm-grow-0 justify-content-center">
            <i className="bi bi-plus-circle"></i>
            <span>Schedule Exam</span>
          </Link>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger d-flex align-items-center mb-4 rounded-3 shadow-sm" role="alert">
          <i className="bi bi-exclamation-triangle-fill fs-5 me-2"></i>
          <div>{error}</div>
        </div>
      )}

      {/* Metrics Row 1: Key Operational Counts (Section 3 Requirements) */}
      <div className="row g-2 g-sm-3 mb-4">
        <div className="col-6 col-md-4 col-xl-2">
          <StatCard
            title="Total Students"
            value={summary.totalStudents}
            icon="bi-people-fill"
            color="primary"
            subtitle="Enrolled active students"
          />
        </div>

        <div className="col-6 col-md-4 col-xl-2">
          <StatCard
            title="Total Exams"
            value={summary.totalExams}
            icon="bi-journal-text"
            color="purple"
            subtitle="Created in institution"
          />
        </div>

        <div className="col-6 col-md-4 col-xl-2">
          <StatCard
            title="Active Exams"
            value={summary.activeExams}
            icon="bi-broadcast"
            color="success"
            badgeText="Live"
            subtitle="Currently underway"
          />
        </div>

        <div className="col-6 col-md-4 col-xl-2">
          <StatCard
            title="Completed Exams"
            value={summary.completedExams}
            icon="bi-check-circle-fill"
            color="info"
            subtitle="Evaluation finished"
          />
        </div>

        <div className="col-6 col-md-4 col-xl-2">
          <StatCard
            title="Total Questions"
            value={summary.totalQuestions}
            icon="bi-patch-question-fill"
            color="warning"
            subtitle="In question bank"
          />
        </div>

        <div className="col-6 col-md-4 col-xl-2">
          <StatCard
            title="Total Results"
            value={summary.totalResults}
            icon="bi-award-fill"
            color="danger"
            subtitle="Evaluated scorecards"
          />
        </div>
      </div>

      {/* Quick Action Hub */}
      <div className="row g-3 mb-4">
        <div className="col-12" style={{ minWidth: 0, maxWidth: '100%' }}>
          <div className="card-custom p-3 bg-white" style={{ minWidth: 0, maxWidth: '100%' }}>
            <div className="d-flex flex-column flex-sm-row align-items-start align-items-sm-center justify-content-between mb-3 gap-1">
              <h6 className="fw-bold text-dark mb-0" style={{ fontSize: '0.92rem' }}>
                <i className="bi bi-lightning-charge-fill text-warning me-1"></i> Quick Action Center
              </h6>
              <span className="text-muted" style={{ fontSize: '0.78rem' }}>Fast navigation to phase modules</span>
            </div>
            <div className="row g-2 pt-1">
              <div className="col-12 col-sm-6 col-md-3">
                <Link to="/admin/students" className="btn btn-outline-primary w-100 text-start py-2 d-flex align-items-center gap-2">
                  <i className="bi bi-person-plus-fill fs-5 flex-shrink-0"></i>
                  <div className="overflow-hidden">
                    <div className="fw-semibold small text-truncate">Student Management</div>
                    <div className="text-muted text-truncate" style={{ fontSize: '0.7rem' }}>Bulk CSV / Individual</div>
                  </div>
                </Link>
              </div>

              <div className="col-12 col-sm-6 col-md-3">
                <Link to="/admin/pdf-upload" className="btn btn-outline-primary w-100 text-start py-2 d-flex align-items-center gap-2">
                  <i className="bi bi-file-earmark-pdf-fill fs-5 text-danger flex-shrink-0"></i>
                  <div className="overflow-hidden">
                    <div className="fw-semibold small text-truncate">Upload Question PDF</div>
                    <div className="text-muted text-truncate" style={{ fontSize: '0.7rem' }}>OCR & Text Extraction</div>
                  </div>
                </Link>
              </div>

              <div className="col-12 col-sm-6 col-md-3">
                <Link to="/admin/question-bank" className="btn btn-outline-primary w-100 text-start py-2 d-flex align-items-center gap-2">
                  <i className="bi bi-journal-plus fs-5 text-success flex-shrink-0"></i>
                  <div className="overflow-hidden">
                    <div className="fw-semibold small text-truncate">Question Bank</div>
                    <div className="text-muted text-truncate" style={{ fontSize: '0.7rem' }}>Categorize & Difficulty</div>
                  </div>
                </Link>
              </div>

              <div className="col-12 col-sm-6 col-md-3">
                <Link to="/admin/winners" className="btn btn-outline-primary w-100 text-start py-2 d-flex align-items-center gap-2">
                  <i className="bi bi-trophy-fill fs-5 text-warning flex-shrink-0"></i>
                  <div className="overflow-hidden">
                    <div className="fw-semibold small text-truncate">Top 3 Winners</div>
                    <div className="text-muted text-truncate" style={{ fontSize: '0.7rem' }}>Podium & Voice Announce</div>
                  </div>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Visual Analytics */}
      <div className="mb-4">
        <ExamPerformanceChart summary={summary} />
      </div>

      {/* Two Column Grid: Upcoming Exams & Recent Activities (Section 3 Requirements) */}
      <div className="row g-4">
        {/* Upcoming Exams Table */}
        <div className="col-12 col-xl-8" style={{ minWidth: 0, maxWidth: '100%' }}>
          <div className="card-custom bg-white h-100 overflow-hidden" style={{ minWidth: 0, maxWidth: '100%' }}>
            <div className="p-3 border-bottom d-flex align-items-center justify-content-between">
              <div>
                <h5 className="fw-bold text-dark mb-0" style={{ fontSize: '1.05rem' }}>
                  <i className="bi bi-calendar-event me-2 text-primary"></i> Upcoming & Active Examinations
                </h5>
                <small className="text-muted">Examinations scheduled for upcoming batches</small>
              </div>
              <Link to="/admin/exams" className="btn btn-sm btn-link text-decoration-none fw-semibold">
                View All <i className="bi bi-chevron-right"></i>
              </Link>
            </div>
            <div className="p-0" style={{ minWidth: 0, maxWidth: '100%', overflowX: 'hidden' }}>
              <UpcomingExamsList exams={upcomingExams} />
            </div>
          </div>
        </div>

        {/* Recent Activities Audit Feed */}
        <div className="col-12 col-xl-4" style={{ minWidth: 0, maxWidth: '100%' }}>
          <div className="card-custom bg-white h-100 overflow-hidden" style={{ minWidth: 0, maxWidth: '100%' }}>
            <div className="p-3 border-bottom d-flex align-items-center justify-content-between">
              <div>
                <h5 className="fw-bold text-dark mb-0" style={{ fontSize: '1.05rem' }}>
                  <i className="bi bi-activity me-2 text-danger"></i> Recent System Activities
                </h5>
                <small className="text-muted">Real-time audit log stream</small>
              </div>
              <Link to="/admin/audit-logs" className="btn btn-sm btn-link text-decoration-none fw-semibold">
                Audit Trail <i className="bi bi-chevron-right"></i>
              </Link>
            </div>
            <div className="p-3" style={{ minWidth: 0, maxWidth: '100%', overflowX: 'hidden' }}>
              <RecentActivityList activities={recentActivities} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
