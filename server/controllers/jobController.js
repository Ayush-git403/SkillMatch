const { Op } = require('sequelize');
const { JobListing, User } = require('../models');

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50; // cap so a client can't request ?limit=100000 and defeat pagination

// CREATE JOB (Employer only)
const createJob = async (req, res) => {
  try {
    const { title, description } = req.body;

    const job = await JobListing.create({
      title,
      description,
      employer_id: req.user.id,
      status: 'open'
    });

    res.status(201).json({ message: 'Job created successfully', job });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// GET ALL JOBS (Public) — paginated
// Query params: ?page=1&limit=10&q=search-text
const getAllJobs = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || DEFAULT_LIMIT, 1),
      MAX_LIMIT
    );
    const q = (req.query.q || '').trim();

    const where = { status: 'open' };
    if (q) {
      where[Op.or] = [
        { title: { [Op.iLike]: `%${q}%` } },
        { description: { [Op.iLike]: `%${q}%` } }
      ];
    }

    const { count, rows } = await JobListing.findAndCountAll({
      where,
      include: [{
        model: User,
        as: 'employer',
        attributes: ['id', 'name', 'email']
      }],
      // id is a tie-breaker: without it, jobs sharing the same createdAt can
      // shuffle between pages and show up twice or get skipped.
      order: [['createdAt', 'DESC'], ['id', 'DESC']],
      limit,
      offset: (page - 1) * limit
    });

    res.json({
      jobs: rows,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
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

    if (!job) return res.status(404).json({ message: 'Job not found' });

    res.json(job);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// GET EMPLOYER'S OWN JOBS (left unpaginated — an employer's own list stays small)
const getMyJobs = async (req, res) => {
  try {
    const jobs = await JobListing.findAll({
      where: { employer_id: req.user.id },
      order: [['createdAt', 'DESC']]
    });

    res.json(jobs);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// UPDATE JOB (Employer only)
const updateJob = async (req, res) => {
  try {
    const job = await JobListing.findByPk(req.params.id);

    if (!job) return res.status(404).json({ message: 'Job not found' });

    if (job.employer_id !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to update this job' });
    }

    await job.update(req.body);
    res.json({ message: 'Job updated successfully', job });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// DELETE JOB (Employer only)
const deleteJob = async (req, res) => {
  try {
    const job = await JobListing.findByPk(req.params.id);

    if (!job) return res.status(404).json({ message: 'Job not found' });

    if (job.employer_id !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to delete this job' });
    }

    await job.destroy();
    res.json({ message: 'Job deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

module.exports = { createJob, getAllJobs, getJobById, getMyJobs, updateJob, deleteJob };