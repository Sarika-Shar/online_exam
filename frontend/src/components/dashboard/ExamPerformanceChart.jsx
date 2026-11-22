import React from 'react';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement
} from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement
);

const ExamPerformanceChart = ({ summary }) => {
  const examStatusData = {
    labels: ['Active Exams', 'Scheduled/Pending', 'Completed Exams'],
    datasets: [
      {
        data: [
          summary?.activeExams || 0,
          Math.max(0, (summary?.totalExams || 0) - (summary?.activeExams || 0) - (summary?.completedExams || 0)),
          summary?.completedExams || 0
        ],
        backgroundColor: ['#10b981', '#2563eb', '#94a3b8'],
        borderWidth: 2,
        borderColor: '#ffffff'
      }
    ]
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          boxWidth: 12,
          padding: 15,
          font: { family: 'Inter', size: 12 }
        }
      }
    },
    cutout: '72%'
  };

  const barData = {
    labels: ['Students', 'Questions', 'Exams', 'Results'],
    datasets: [
      {
        label: 'System Volume',
        data: [
          summary?.totalStudents || 0,
          summary?.totalQuestions || 0,
          summary?.totalExams || 0,
          summary?.totalResults || 0
        ],
        backgroundColor: '#3b82f6',
        borderRadius: 6
      }
    ]
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { font: { family: 'Inter', size: 11 } },
        grid: { color: '#f1f5f9' }
      },
      x: {
        ticks: { font: { family: 'Inter', size: 11 } },
        grid: { display: false }
      }
    }
  };

  return (
    <div className="row g-3">
      <div className="col-12 col-lg-5" style={{ minWidth: 0, maxWidth: '100%' }}>
        <div className="border rounded-3 p-3 bg-white h-100 overflow-hidden" style={{ minWidth: 0, maxWidth: '100%' }}>
          <h6 className="fw-semibold text-dark mb-3" style={{ fontSize: '0.9rem' }}>
            Exam Execution Status
          </h6>
          <div className="chart-container" style={{ height: '220px', position: 'relative', width: '100%', maxWidth: '100%', overflow: 'hidden' }}>
            <Doughnut data={examStatusData} options={doughnutOptions} />
          </div>
        </div>
      </div>
      <div className="col-12 col-lg-7" style={{ minWidth: 0, maxWidth: '100%' }}>
        <div className="border rounded-3 p-3 bg-white h-100 overflow-hidden" style={{ minWidth: 0, maxWidth: '100%' }}>
          <h6 className="fw-semibold text-dark mb-3" style={{ fontSize: '0.9rem' }}>
            Academic Assets Distribution
          </h6>
          <div className="chart-container" style={{ height: '220px', position: 'relative', width: '100%', maxWidth: '100%', overflow: 'hidden' }}>
            <Bar data={barData} options={barOptions} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExamPerformanceChart;
