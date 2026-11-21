const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ExamQuestion = sequelize.define('ExamQuestion', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  exam_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  question_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  question_order: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1
  }
}, {
  tableName: 'exam_questions',
  timestamps: true,
  indexes: [
    { fields: ['exam_id'] },
    { fields: ['question_id'] },
    { fields: ['exam_id', 'question_id'], unique: true }
  ]
});

module.exports = ExamQuestion;
