const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ExamResult = sequelize.define('ExamResult', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  institution_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  exam_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  student_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  exam_attempt_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  total_questions: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  attempted_questions: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  correct_answers: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  wrong_answers: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  unattempted_questions: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  total_marks_obtained: {
    type: DataTypes.DECIMAL(6, 2),
    allowNull: false,
    defaultValue: 0.00
  },
  max_marks: {
    type: DataTypes.DECIMAL(6, 2),
    allowNull: false
  },
  percentage: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    defaultValue: 0.00
  },
  is_passed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  rank: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  completion_time_seconds: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  calculated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'exam_results',
  timestamps: true,
  indexes: [
    { fields: ['institution_id'] },
    { fields: ['exam_id'] },
    { fields: ['student_id'] },
    { fields: ['exam_id', 'student_id'], unique: true },
    { fields: ['rank'] }
  ]
});

module.exports = ExamResult;
