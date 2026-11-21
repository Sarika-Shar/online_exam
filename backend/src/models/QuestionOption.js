const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const QuestionOption = sequelize.define('QuestionOption', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  question_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  option_key: {
    type: DataTypes.STRING(10), // 'A', 'B', 'C', 'D'
    allowNull: false
  },
  option_text: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  is_correct: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  tableName: 'question_options',
  timestamps: true,
  indexes: [
    { fields: ['question_id'] },
    { fields: ['question_id', 'option_key'] }
  ]
});

module.exports = QuestionOption;
