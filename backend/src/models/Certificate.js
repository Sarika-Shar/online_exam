const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Certificate = sequelize.define('Certificate', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  institution_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  certificate_uuid: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true
  },
  exam_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  student_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  rank: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  percentage: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false
  },
  marks_obtained: {
    type: DataTypes.DECIMAL(6, 2),
    allowNull: false
  },
  total_marks: {
    type: DataTypes.DECIMAL(6, 2),
    allowNull: false
  },
  file_url: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  issue_date: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  authorized_signature: {
    type: DataTypes.STRING(255),
    allowNull: true
  }
}, {
  tableName: 'certificates',
  timestamps: true,
  indexes: [
    { fields: ['institution_id'] },
    { fields: ['certificate_uuid'], unique: true },
    { fields: ['exam_id', 'student_id'], unique: true }
  ]
});

module.exports = Certificate;
