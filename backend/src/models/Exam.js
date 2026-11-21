const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Exam = sequelize.define('Exam', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  institution_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  instructions: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  subject_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  class_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  batch_id: {
    type: DataTypes.INTEGER,
    allowNull: true // Null means all batches in class
  },
  exam_date: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  start_time: {
    type: DataTypes.DATE,
    allowNull: false
  },
  end_time: {
    type: DataTypes.DATE,
    allowNull: false
  },
  duration_minutes: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 60
  },
  total_questions: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 100
  },
  total_marks: {
    type: DataTypes.DECIMAL(6, 2),
    allowNull: false,
    defaultValue: 100.00
  },
  marks_per_question: {
    type: DataTypes.DECIMAL(4, 2),
    allowNull: false,
    defaultValue: 1.00
  },
  negative_marking: {
    type: DataTypes.DECIMAL(4, 2),
    allowNull: false,
    defaultValue: 0.00
  },
  passing_percentage: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    defaultValue: 40.00
  },
  selection_mode: {
    type: DataTypes.ENUM('manual_fixed', 'random_fixed_pool', 'random_per_student'),
    allowNull: false,
    defaultValue: 'manual_fixed'
  },
  status: {
    type: DataTypes.ENUM('draft', 'scheduled', 'active', 'completed', 'cancelled'),
    defaultValue: 'scheduled'
  },
  results_published: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  created_by: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
}, {
  tableName: 'exams',
  timestamps: true,
  indexes: [
    { fields: ['institution_id'] },
    { fields: ['class_id'] },
    { fields: ['subject_id'] },
    { fields: ['status'] },
    { fields: ['exam_date'] },
    { fields: ['start_time', 'end_time'] }
  ]
});

module.exports = Exam;
