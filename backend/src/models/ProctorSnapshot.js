const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ProctorSnapshot = sequelize.define('ProctorSnapshot', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  institution_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  exam_attempt_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  student_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  snapshot_url: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  snapshot_type: {
    type: DataTypes.ENUM('identity_verification', 'periodic', 'anomaly_triggered'),
    defaultValue: 'periodic'
  },
  anomaly_detected: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  anomaly_type: {
    type: DataTypes.ENUM(
      'NONE',
      'MULTIPLE_FACES',
      'NO_FACE',
      'TAB_SWITCH',
      'CELLPHONE_DETECTED',
      'SUSPICIOUS_AUDIO',
      'LOOKING_AWAY'
    ),
    defaultValue: 'NONE'
  },
  confidence_score: {
    type: DataTypes.FLOAT,
    defaultValue: 1.0
  },
  captured_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'proctor_snapshots',
  timestamps: true,
  indexes: [
    { fields: ['institution_id'] },
    { fields: ['exam_attempt_id'] },
    { fields: ['student_id'] },
    { fields: ['anomaly_detected'] },
    { fields: ['captured_at'] }
  ]
});

module.exports = ProctorSnapshot;
