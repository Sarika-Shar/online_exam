const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ExamAssignment = sequelize.define('ExamAssignment', {
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
  status: {
    type: DataTypes.ENUM('assigned', 'started', 'completed', 'absent'),
    defaultValue: 'assigned'
  }
}, {
  tableName: 'exam_assignments',
  timestamps: true,
  indexes: [
    { fields: ['exam_id'] },
    { fields: ['student_id'] },
    { fields: ['exam_id', 'student_id'], unique: true }
  ]
});

module.exports = ExamAssignment;
