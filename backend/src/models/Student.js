const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Student = sequelize.define('Student', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  institution_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  student_id: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  class_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  batch_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  enrollment_no: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  roll_no: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  gender: {
    type: DataTypes.ENUM('male', 'female', 'other'),
    allowNull: true
  },
  date_of_birth: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  parent_name: {
    type: DataTypes.STRING(150),
    allowNull: true
  },
  parent_phone: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'students',
  timestamps: true,
  indexes: [
    { fields: ['institution_id'] },
    { fields: ['user_id'] },
    { fields: ['institution_id', 'student_id'], unique: true },
    { fields: ['class_id'] },
    { fields: ['batch_id'] }
  ]
});

module.exports = Student;
