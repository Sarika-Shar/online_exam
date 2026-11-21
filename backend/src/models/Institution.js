const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Institution = sequelize.define('Institution', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  code: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  phone: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  address: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  logo_url: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  settings: {
    type: DataTypes.TEXT, // Stored as JSON string for broad database compatibility
    allowNull: true,
    get() {
      const rawValue = this.getDataValue('settings');
      try {
        return rawValue ? JSON.parse(rawValue) : {};
      } catch (e) {
        return {};
      }
    },
    set(value) {
      this.setDataValue('settings', JSON.stringify(value || {}));
    }
  }
}, {
  tableName: 'institutions',
  timestamps: true,
  indexes: [
    { fields: ['code'], unique: true },
    { fields: ['is_active'] }
  ]
});

module.exports = Institution;
