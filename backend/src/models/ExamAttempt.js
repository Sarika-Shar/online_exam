const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ExamAttempt = sequelize.define('ExamAttempt', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  exam_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  student_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  start_time: {
    type: DataTypes.DATE,
    allowNull: false
  },
  end_time: {
    type: DataTypes.DATE,
    allowNull: true
  },
  server_expiry_time: {
    type: DataTypes.DATE,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('in_progress', 'submitted', 'auto_submitted', 'disqualified'),
    defaultValue: 'in_progress'
  },
  submission_type: {
    type: DataTypes.ENUM('manual', 'auto'),
    allowNull: true
  },
  ip_address: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  user_agent: {
    type: DataTypes.STRING(300),
    allowNull: true
  },
  integrity_score: {
    type: DataTypes.INTEGER,
    defaultValue: 100
  },
  proctor_verdict: {
    type: DataTypes.ENUM('pending', 'verified_clean', 'suspicious_flagged', 'disqualified'),
    defaultValue: 'pending'
  },
  proctor_notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  proctor_reviewed_by: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  proctor_reviewed_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  is_paused: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  paused_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  total_paused_seconds: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  proctor_interventions_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  }
}, {
  tableName: 'exam_attempts',
  timestamps: true,
  indexes: [
    { fields: ['exam_id'] },
    { fields: ['student_id'] },
    { fields: ['exam_id', 'student_id'] },
    { fields: ['status'] },
    { fields: ['server_expiry_time'] }
  ]
});

module.exports = ExamAttempt;
