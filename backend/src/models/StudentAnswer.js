const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const StudentAnswer = sequelize.define('StudentAnswer', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  exam_attempt_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  question_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  selected_option_key: {
    type: DataTypes.STRING(10), // 'A', 'B', 'C', 'D' or null if cleared
    allowNull: true
  },
  is_marked_for_review: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  is_correct: {
    type: DataTypes.BOOLEAN,
    allowNull: true
  },
  marks_awarded: {
    type: DataTypes.DECIMAL(4, 2),
    defaultValue: 0.00
  },
  answered_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'student_answers',
  timestamps: true,
  indexes: [
    { fields: ['exam_attempt_id'] },
    { fields: ['question_id'] },
    { fields: ['exam_attempt_id', 'question_id'], unique: true }
  ]
});

module.exports = StudentAnswer;
