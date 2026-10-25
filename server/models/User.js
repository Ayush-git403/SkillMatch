const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false, unique: true },
  // Null for Google-only accounts, which never set a password.
  password_hash: { type: DataTypes.STRING, allowNull: true },
  // Null until a new Google user picks applicant/employer on first sign-in.
  role_id: { type: DataTypes.INTEGER, allowNull: true },
  // Google's stable user id (the "sub" claim in the ID token).
  google_id: { type: DataTypes.STRING, allowNull: true }
}, {
  timestamps: true,
  // Declared as an index rather than `unique: true` on the column: with
  // sync({ alter: true }), column-level unique can pile up a duplicate
  // constraint on every boot.
  indexes: [{ unique: true, fields: ['google_id'] }]
});

module.exports = User;