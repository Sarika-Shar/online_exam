const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Winner = sequelize.define('Winner', {
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
  position: {
    type: DataTypes.INTEGER, // 1, 2, 3
    allowNull: false
  },
  marks_obtained: {
    type: DataTypes.DECIMAL(6, 2),
    allowNull: false
  },
  completion_time_seconds: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  announced: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  announced_at: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'winners',
  timestamps: true,
  indexes: [
    { fields: ['institution_id'] },
    { fields: ['exam_id'] },
    { fields: ['exam_id', 'position'], unique: true }
  ]
});

module.exports = Winner;
