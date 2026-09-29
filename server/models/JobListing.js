const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const JobListing = sequelize.define('JobListing', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  title: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: false },
  employer_id: { type: DataTypes.INTEGER, allowNull: false },
  status: { type: DataTypes.STRING, defaultValue: 'open' },

  // Added to back the frontend's existing (previously dead) filters
  location: { type: DataTypes.STRING, allowNull: true },
  job_type: { type: DataTypes.STRING, allowNull: true }, // 'full-time' | 'part-time' | 'internship'
  salary: { type: DataTypes.STRING, allowNull: true }, // free text, e.g. "$80k - $100k"
  skills: { type: DataTypes.JSON, allowNull: true } // array of strings, e.g. ["react", "node.js"]
}, {
  timestamps: true,
  indexes: [
    // status is filtered on every public job list request
    { fields: ['status'] },
    // employer_id is filtered in getMyJobs and checked in update/delete
    { fields: ['employer_id'] },
    // createdAt is the sort column for pagination — an index here is what
    // keeps ORDER BY + LIMIT/OFFSET fast as the table grows
    { fields: ['createdAt'] }
  ]
});

module.exports = JobListing;