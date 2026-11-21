const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PdfUpload = sequelize.define('PdfUpload', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  institution_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  uploaded_by: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  file_name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  file_path: {
    type: DataTypes.STRING(500),
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('uploaded', 'processing', 'extracted', 'failed', 'approved'),
    defaultValue: 'uploaded'
  },
  total_detected: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  approved_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  ocr_applied: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  error_message: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'pdf_uploads',
  timestamps: true,
  indexes: [
    { fields: ['institution_id'] },
    { fields: ['status'] }
  ]
});

module.exports = PdfUpload;
