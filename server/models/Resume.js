const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Resume = sequelize.define('Resume', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  application_id: { type: DataTypes.INTEGER, allowNull: false },
  // Legacy: held the S3 object key when PDFs were stored in AWS (see the
  // aws-ecs-version git tag). Unused now but kept nullable so existing
  // queries that select it keep working.
  s3_key: { type: DataTypes.STRING, allowNull: true },
  // The extracted resume text. This is all the scorer needs.
  parsed_text: { type: DataTypes.TEXT, allowNull: false },
  original_file_name: { type: DataTypes.STRING, allowNull: true }
}, { timestamps: true });

module.exports = Resume;