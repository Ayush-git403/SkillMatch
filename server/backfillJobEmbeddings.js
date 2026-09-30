const sequelize = require('./config/database');
const { getEmbedding } = require('./services/embeddingClient');

async function backfill() {
  try {
    const [jobs] = await sequelize.query(`
      SELECT id, title, description, skills
      FROM "JobListings"
      WHERE embedding IS NULL
      ORDER BY id
    `);

    console.log(`Jobs needing embeddings: ${jobs.length}`);

    for (const job of jobs) {
      const skillsText = Array.isArray(job.skills)
        ? job.skills.join(', ')
        : '';

      const text = `
        Job Title: ${job.title || ''}
        Job Description: ${job.description || ''}
        Skills: ${skillsText}
      `.trim();

      console.log(`Generating embedding for job ${job.id}...`);

      const embedding = await getEmbedding(text);

      await sequelize.query(`
        UPDATE "JobListings"
        SET embedding = :embedding
        WHERE id = :id
      `, {
        replacements: {
          embedding: `[${embedding.join(',')}]`,
          id: job.id
        }
      });

      console.log(`Job ${job.id} completed`);
    }

    console.log('BACKFILL COMPLETE');

    await sequelize.close();
  } catch (error) {
    console.error('BACKFILL FAILED:', error);
    process.exit(1);
  }
}

backfill();