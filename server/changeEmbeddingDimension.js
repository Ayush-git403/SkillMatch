const sequelize = require('./config/database');

async function changeDimension() {
  try {
    await sequelize.query(`
      ALTER TABLE "JobListings"
      ADD COLUMN IF NOT EXISTS embedding vector(1024)
    `);

    console.log('Embedding column restored as vector(1024)');

    await sequelize.close();
  } catch (error) {
    console.error('FAILED:', error);
    process.exit(1);
  }
}

changeDimension();