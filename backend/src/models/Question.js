const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Question = sequelize.define('Question', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  institution_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  question_bank_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  subject_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  topic: {
    type: DataTypes.STRING(150),
    allowNull: true
  },
  difficulty_level: {
    type: DataTypes.ENUM('easy', 'medium', 'hard'),
    allowNull: false,
    defaultValue: 'medium'
  },
  question_text: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  question_type: {
    type: DataTypes.STRING(20),
    defaultValue: 'mcq'
  },
  language: {
    type: DataTypes.STRING(20),
    defaultValue: 'en' // 'en', 'hi', etc.
  },
  marks: {
    type: DataTypes.DECIMAL(4, 2),
    defaultValue: 1.00
  },
  negative_marks: {
    type: DataTypes.DECIMAL(4, 2),
    defaultValue: 0.00
  },
  explanation: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  is_verified: {
    type: DataTypes.BOOLEAN,
    defaultValue: true // extracted questions start as false
  },
  status: {
    type: DataTypes.ENUM('draft', 'pending_approval', 'approved', 'rejected'),
    defaultValue: 'approved'
  },
  source_pdf_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  created_by: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
}, {
  tableName: 'questions',
  timestamps: true,
  indexes: [
    { fields: ['institution_id'] },
    { fields: ['subject_id'] },
    { fields: ['difficulty_level'] },
    { fields: ['is_verified'] },
    { fields: ['status'] }
  ]
});

module.exports = Question;
