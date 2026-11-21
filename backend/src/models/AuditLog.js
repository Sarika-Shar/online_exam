const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const AuditLog = sequelize.define('AuditLog', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  institution_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  action: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  entity_type: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  entity_id: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  details: {
    type: DataTypes.TEXT,
    allowNull: true,
    get() {
      const raw = this.getDataValue('details');
      try {
        return raw ? JSON.parse(raw) : {};
      } catch (e) {
        return { message: raw };
      }
    },
    set(val) {
      this.setDataValue('details', typeof val === 'object' ? JSON.stringify(val) : val);
    }
  },
  ip_address: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  user_agent: {
    type: DataTypes.STRING(300),
    allowNull: true
  }
}, {
  tableName: 'audit_logs',
  timestamps: true,
  updatedAt: false,
  indexes: [
    { fields: ['institution_id'] },
    { fields: ['user_id'] },
    { fields: ['action'] },
    { fields: ['created_at'] }
  ]
});

module.exports = AuditLog;
