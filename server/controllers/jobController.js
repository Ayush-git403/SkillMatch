const { Op, QueryTypes } = require('sequelize');
const { JobListing, User, sequelize } = require('../models');
const { getEmbedding } = require('../services/embeddingClient');

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

// Build the text that represents a job for semantic search
const buildJobText = ({ title, description, skills }) => {
  const skillText = Array.isArray(skills)
    ? skills.join(', ')
    : '';

  return `
    Job Title: ${title || ''}
    Job Description: ${description || ''}
    Skills: ${skillText}
  `.trim();
};

// CREATE JOB
const createJob = async (req, res) => {
  try {
    const {
      title,
      description,
      location,
      job_type,
      salary,
      skills
    } = req.body;

    const normalizedSkills = Array.isArray(skills) ? skills : [];

    // Generate semantic-search embedding
    const jobText = buildJobText({
      title,
      description,
      skills: normalizedSkills
    });

    const embedding = await getEmbedding(jobText);

    const job = await JobListing.create({
      title,
      description,
      location: location || null,
      job_type: job_type || null,
      salary: salary || null,
      skills: normalizedSkills,
      employer_id: req.user.id,
      status: 'open'
    });

    // Store the vector separately because Sequelize doesn't natively
    // handle pgvector with DataTypes.JSON.
    await sequelize.query(
      `
      UPDATE "JobListings"
      SET embedding = :embedding
      WHERE id = :id
      `,
      {
        replacements: {
          embedding: `[${embedding.join(',')}]`,
          id: job.id
        }
      }
    );

    // Fetch the updated job so the response contains the stored data
    const savedJob = await JobListing.findByPk(job.id);

    res.status(201).json({
      message: 'Job created successfully',
      job: savedJob
    });

  } catch (err) {
    console.error('CREATE JOB ERROR:', err);

    res.status(500).json({
      message: 'Server error',
      error: err.message
    });
  }
};


// GET ALL JOBS — semantic search + pagination
//
// Examples:
// GET /jobs
// GET /jobs?q=software
// GET /jobs?q=backend%20developer&page=1&limit=10
//
const getAllJobs = async (req, res) => {
  try {
    const page = Math.max(
      parseInt(req.query.page, 10) || 1,
      1
    );

    const limit = Math.min(
      Math.max(
        parseInt(req.query.limit, 10) || DEFAULT_LIMIT,
        1
      ),
      MAX_LIMIT
    );

    const q = (req.query.q || '').trim();

    // --------------------------------------------------
    // NO SEARCH QUERY
    // --------------------------------------------------

    if (!q) {
      const { count, rows } = await JobListing.findAndCountAll({
        where: {
          status: 'open'
        },

        include: [{
          model: User,
          as: 'employer',
          attributes: ['id', 'name', 'email']
        }],

        order: [
          ['createdAt', 'DESC'],
          ['id', 'DESC']
        ],

        limit,
        offset: (page - 1) * limit
      });

      return res.json({
        jobs: rows,
        pagination: {
          page,
          limit,
          total: count,
          totalPages: Math.ceil(count / limit)
        }
      });
    }


    // --------------------------------------------------
    // SEMANTIC SEARCH
    // --------------------------------------------------

    const queryEmbedding = await getEmbedding(q);

    const vectorString = `[${queryEmbedding.join(',')}]`;

    /*
      pgvector cosine distance:

      embedding <=> query_embedding

      Lower distance = more semantically similar.

      We convert distance into similarity:

      1 - cosine_distance
    */

    const offset = (page - 1) * limit;

    const jobs = await sequelize.query(
      `
      SELECT
        j.id,
        j.title,
        j.description,
        j.employer_id,
        j.status,
        j."createdAt",
        j."updatedAt",
        j.location,
        j.job_type,
        j.salary,
        j.skills,

        1 - (j.embedding <=> CAST(:embedding AS vector))
          AS similarity,

        u.id AS "employer.id",
        u.name AS "employer.name",
        u.email AS "employer.email"

      FROM "JobListings" j

      JOIN "Users" u
        ON u.id = j.employer_id

      WHERE j.status = 'open'
        AND j.embedding IS NOT NULL

      ORDER BY j.embedding <=> CAST(:embedding AS vector)

      LIMIT :limit
      OFFSET :offset
      `,
      {
        replacements: {
          embedding: vectorString,
          limit,
          offset
        },

        type: QueryTypes.SELECT
      }
    );


    // --------------------------------------------------
    // COUNT SEARCH RESULTS
    // --------------------------------------------------

    const countResult = await sequelize.query(
      `
      SELECT COUNT(*)::integer AS count

      FROM "JobListings" j

      WHERE j.status = 'open'
        AND j.embedding IS NOT NULL
      `,
      {
        type: QueryTypes.SELECT
      }
    );

    const total = countResult[0]?.count || 0;


    // --------------------------------------------------
    // FORMAT EMPLOYER OBJECT
    // --------------------------------------------------

    const formattedJobs = jobs.map(job => ({
      id: job.id,
      title: job.title,
      description: job.description,
      employer_id: job.employer_id,
      status: job.status,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      location: job.location,
      job_type: job.job_type,
      salary: job.salary,
      skills: job.skills,

      similarity: Number(job.similarity),

      employer: {
        id: job['employer.id'],
        name: job['employer.name'],
        email: job['employer.email']
      }
    }));


    res.json({
      jobs: formattedJobs,

      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (err) {
    console.error('GET JOBS ERROR:', err);

    res.status(500).json({
      message: 'Server error',
      error: err.message
    });
  }
};


// GET SINGLE JOB
const getJobById = async (req, res) => {
  try {
    const job = await JobListing.findByPk(req.params.id, {
      include: [{
        model: User,
        as: 'employer',
        attributes: ['id', 'name', 'email']
      }]
    });

    if (!job) {
      return res.status(404).json({
        message: 'Job not found'
      });
    }

    res.json(job);

  } catch (err) {
    res.status(500).json({
      message: 'Server error',
      error: err.message
    });
  }
};


// GET EMPLOYER'S OWN JOBS
const getMyJobs = async (req, res) => {
  try {
    const jobs = await JobListing.findAll({
      where: {
        employer_id: req.user.id
      },

      order: [
        ['createdAt', 'DESC']
      ]
    });

    res.json(jobs);

  } catch (err) {
    res.status(500).json({
      message: 'Server error',
      error: err.message
    });
  }
};


// UPDATE JOB
const updateJob = async (req, res) => {
  try {
    const job = await JobListing.findByPk(req.params.id);

    if (!job) {
      return res.status(404).json({
        message: 'Job not found'
      });
    }

    if (job.employer_id !== req.user.id) {
      return res.status(403).json({
        message: 'Not authorized to update this job'
      });
    }

    await job.update(req.body);

    // Regenerate embedding because job content may have changed
    const updatedSkills = Array.isArray(req.body.skills)
      ? req.body.skills
      : job.skills;

    const jobText = buildJobText({
      title: job.title,
      description: job.description,
      skills: updatedSkills
    });

    const embedding = await getEmbedding(jobText);

    await sequelize.query(
      `
      UPDATE "JobListings"
      SET embedding = :embedding
      WHERE id = :id
      `,
      {
        replacements: {
          embedding: `[${embedding.join(',')}]`,
          id: job.id
        }
      }
    );

    const updatedJob = await JobListing.findByPk(job.id);

    res.json({
      message: 'Job updated successfully',
      job: updatedJob
    });

  } catch (err) {
    console.error('UPDATE JOB ERROR:', err);

    res.status(500).json({
      message: 'Server error',
      error: err.message
    });
  }
};


// DELETE JOB
const deleteJob = async (req, res) => {
  try {
    const job = await JobListing.findByPk(req.params.id);

    if (!job) {
      return res.status(404).json({
        message: 'Job not found'
      });
    }

    if (job.employer_id !== req.user.id) {
      return res.status(403).json({
        message: 'Not authorized to delete this job'
      });
    }

    await job.destroy();

    res.json({
      message: 'Job deleted successfully'
    });

  } catch (err) {
    res.status(500).json({
      message: 'Server error',
      error: err.message
    });
  }
};


module.exports = {
  createJob,
  getAllJobs,
  getJobById,
  getMyJobs,
  updateJob,
  deleteJob
};