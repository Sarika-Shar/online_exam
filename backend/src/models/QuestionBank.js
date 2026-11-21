const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const QuestionBank = sequelize.define('QuestionBank', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  institution_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  subject_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  name: {
    type: DataTypes.STRING(200),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'question_banks',
  timestamps: true,
  indexes: [
    { fields: ['institution_id'] },
    { fields: ['subject_id'] }
  ]
});

module.exports = QuestionBank;
