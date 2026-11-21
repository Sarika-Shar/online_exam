import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import ProtectedRoute from './components/common/ProtectedRoute';
import AppLayout from './components/layout/AppLayout';
import Login from './pages/auth/Login';
import AdminDashboard from './pages/admin/AdminDashboard';
import AcademicManagement from './pages/admin/AcademicManagement';
import TeacherManagement from './pages/admin/TeacherManagement';
import StudentManagement from './pages/admin/StudentManagement';
import PdfQuestionUpload from './pages/admin/PdfQuestionUpload';
import QuestionBank from './pages/admin/QuestionBank';
import ExamManagement from './pages/admin/ExamManagement';
import ResultManagement from './pages/admin/ResultManagement';
import AnswerKeyChallengeStudio from './pages/admin/AnswerKeyChallengeStudio';
import WinnerManagement from './pages/admin/WinnerManagement';
import CertificateManagement from './pages/admin/CertificateManagement';
import LiveMonitor from './pages/admin/LiveMonitor';
import ProctorEvidenceStudio from './pages/admin/ProctorEvidenceStudio';
import AuditLogs from './pages/admin/AuditLogs';
import StudentDashboard from './pages/student/StudentDashboard';
import AvailableExams from './pages/student/AvailableExams';
import ExamInstructions from './pages/student/ExamInstructions';
import ExamHall from './pages/student/ExamHall';
import StudentResults from './pages/student/StudentResults';
import NotFound from './pages/NotFound';
import PhasePlaceholder from './components/common/PhasePlaceholder';
import LoadingSpinner from './components/common/LoadingSpinner';

const HomeRedirect = () => {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="vh-100 d-flex align-items-center justify-content-center bg-light">
        <LoadingSpinner message="Starting application..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.role === 'student') {
    return <Navigate to="/student/dashboard" replace />;
  }

  return <Navigate to="/admin/dashboard" replace />;
};

function App() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<HomeRedirect />} />

      {/* Admin / Teacher Protected Routes */}
      <Route element={<ProtectedRoute allowedRoles={['super_admin', 'institution_admin', 'teacher']} />}>
        <Route element={<AppLayout />}>
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/academic" element={<AcademicManagement />} />
          <Route element={<ProtectedRoute allowedRoles={['super_admin', 'institution_admin']} />}>
            <Route path="/admin/teachers" element={<TeacherManagement />} />
          </Route>
          <Route path="/admin/students" element={<StudentManagement />} />
          <Route path="/admin/pdf-upload" element={<PdfQuestionUpload />} />
          <Route path="/admin/question-bank" element={<QuestionBank />} />
          <Route path="/admin/exams" element={<ExamManagement />} />
          <Route path="/admin/live-monitor" element={<LiveMonitor />} />
          <Route path="/admin/proctor-evidence" element={<ProctorEvidenceStudio />} />
          <Route path="/admin/results" element={<ResultManagement />} />
          <Route path="/admin/key-challenges" element={<AnswerKeyChallengeStudio />} />
          <Route path="/admin/winners" element={<WinnerManagement />} />
          <Route path="/admin/certificates" element={<CertificateManagement />} />
          <Route path="/admin/audit-logs" element={<AuditLogs />} />
        </Route>
      </Route>

      {/* Student Protected Routes */}
      <Route element={<ProtectedRoute allowedRoles={['student']} />}>
        {/* Full Screen Distraction-Free Exam Hall */}
        <Route path="/student/exam-hall/:id" element={<ExamHall />} />

        {/* Portal Pages with AppLayout */}
        <Route element={<AppLayout />}>
          <Route path="/student/dashboard" element={<StudentDashboard />} />
          <Route path="/student/exams" element={<AvailableExams />} />
          <Route path="/student/exams/:id/instructions" element={<ExamInstructions />} />
          <Route path="/student/results" element={<StudentResults />} />
        </Route>
      </Route>

      {/* Fallback 404 Route */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default App;
