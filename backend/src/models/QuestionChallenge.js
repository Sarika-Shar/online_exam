const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const QuestionChallenge = sequelize.define('QuestionChallenge', {
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
  question_id: {
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
  challenge_type: {
    type: DataTypes.ENUM('WRONG_KEY', 'AMBIGUOUS_QUESTION', 'OUT_OF_SYLLABUS', 'TYPO_ERROR'),
    allowNull: false,
    defaultValue: 'WRONG_KEY'
  },
  claimed_option_key: {
    type: DataTypes.STRING(10),
    allowNull: true
  },
  justification: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  reference_source: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('pending', 'under_review', 'accepted', 'rejected'),
    allowNull: false,
    defaultValue: 'pending'
  },
  resolution_action: {
    type: DataTypes.ENUM('NONE', 'KEY_CHANGE', 'BONUS_MARKS', 'REJECT'),
    allowNull: false,
    defaultValue: 'NONE'
  },
  resolution_notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  reviewed_by: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  reviewed_at: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'question_challenges',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['institution_id'] },
    { fields: ['exam_id'] },
    { fields: ['question_id'] },
    { fields: ['student_id'] },
    { fields: ['exam_attempt_id'] },
    { fields: ['status'] }
  ]
});

module.exports = QuestionChallenge;
