const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Prize = sequelize.define('Prize', {
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
  position: {
    type: DataTypes.INTEGER, // 1, 2, 3
    allowNull: false
  },
  title: {
    type: DataTypes.STRING(200),
    allowNull: false
  },
  cash_amount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00
  },
  is_distributed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  tableName: 'prizes',
  timestamps: true,
  indexes: [
    { fields: ['institution_id'] },
    { fields: ['exam_id'] }
  ]
});

module.exports = Prize;
