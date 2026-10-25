const { randomUUID } = require("crypto");
const { PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { SendMessageCommand } = require("@aws-sdk/client-sqs");
const { Application, JobListing, User, Resume } = require("../models");
const { s3Client, RESUME_BUCKET } = require("../config/s3");
const { sqsClient, RESUME_SCORING_QUEUE_URL } = require("../config/sqs");

// APPLY TO JOB (Applicant only)
const applyToJob = async (req, res) => {
  try {
    const { job_id } = req.body;

    // Check job exists
    const job = await JobListing.findByPk(job_id);
    if (!job) return res.status(404).json({ message: "Job not found" });
    if (job.status !== "open")
      return res.status(400).json({ message: "Job is no longer open" });

    // Check already applied
    const existing = await Application.findOne({
      where: { job_id, applicant_id: req.user.id },
    });
    if (existing)
      return res.status(400).json({ message: "Already applied to this job" });

    // Create application
    const application = await Application.create({
      job_id,
      applicant_id: req.user.id,
      status: "pending",
    });

    res
      .status(201)
      .json({ message: "Application submitted successfully", application });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// GET MY APPLICATIONS (Applicant only)
const getMyApplications = async (req, res) => {
  try {
    const applications = await Application.findAll({
      where: { applicant_id: req.user.id },
      include: [
        {
          model: JobListing,
          as: "job",
          include: [
            {
              model: User,
              as: "employer",
              attributes: ["id", "name", "email"],
            },
          ],
        },
        {
          association: "resume",
          attributes: ["id", "s3_key", "original_file_name"],
        },
        { association: "score" },
      ],
      order: [["createdAt", "DESC"]],
    });

    res.json(
      applications.map((a) => ({
        ...a.toJSON(),
        resume_url: a.resume ? a.resume.original_file_name || "uploaded" : null,
      })),
    );
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// GET APPLICATIONS FOR A JOB (Employer only)
const getJobApplications = async (req, res) => {
  try {
    const job = await JobListing.findByPk(req.params.job_id);
    if (!job) return res.status(404).json({ message: "Job not found" });

    if (job.employer_id !== req.user.id) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const applications = await Application.findAll({
      where: { job_id: req.params.job_id },
      include: [
        {
          model: User,
          as: "applicant",
          attributes: ["id", "name", "email"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    res.json(applications);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// UPDATE APPLICATION STATUS (Employer only)
const updateApplicationStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ["pending", "shortlisted", "rejected"];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const application = await Application.findByPk(req.params.id, {
      include: [{ model: JobListing, as: "job" }],
    });

    if (!application)
      return res.status(404).json({ message: "Application not found" });

    if (application.job.employer_id !== req.user.id) {
      return res.status(403).json({ message: "Not authorized" });
    }

    await application.update({ status });
    res.json({ message: "Application status updated", application });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// GET PRESIGNED S3 UPLOAD URL (Applicant only)
// Frontend calls this first, then PUTs the file directly to S3 using the returned URL.
const getResumeUploadUrl = async (req, res) => {
  try {
    const { fileName, contentType } = req.body;
    if (!fileName || !contentType) {
      return res
        .status(400)
        .json({ message: "fileName and contentType are required" });
    }
    if (contentType !== "application/pdf") {
      return res
        .status(400)
        .json({ message: "Only PDF resumes are supported" });
    }

    const application = await Application.findByPk(req.params.id);
    if (!application)
      return res.status(404).json({ message: "Application not found" });

    if (application.applicant_id !== req.user.id) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const s3Key = `resumes/${application.id}-${randomUUID()}.pdf`;

    const command = new PutObjectCommand({
      Bucket: RESUME_BUCKET,
      Key: s3Key,
      ContentType: contentType,
    });

    // URL expires in 5 minutes — plenty for a direct browser upload
    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });

    res.json({ uploadUrl, s3Key });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// CONFIRM RESUME UPLOAD (Applicant only)
// Frontend calls this after the direct-to-S3 PUT succeeds, so we record the
// resume in Postgres. This is also where the scoring job will get queued (next step).
const confirmResumeUpload = async (req, res) => {
  try {
    const { s3Key, originalFileName } = req.body;
    if (!s3Key) return res.status(400).json({ message: "s3Key is required" });

    const application = await Application.findByPk(req.params.id);
    if (!application)
      return res.status(404).json({ message: "Application not found" });

    if (application.applicant_id !== req.user.id) {
      return res.status(403).json({ message: "Not authorized" });
    }

    // upsert — applicant might re-upload before scoring finishes
    const [resume] = await Resume.findOrCreate({
      where: { application_id: application.id },
      defaults: { s3_key: s3Key, original_file_name: originalFileName || null },
    });
    if (resume.s3_key !== s3Key) {
      await resume.update({
        s3_key: s3Key,
        original_file_name: originalFileName || null,
      });
    }

    // Push to SQS instead of scoring in-process — a separate worker process
    // (scoreWorker.js) polls this queue and does the actual scoring. This
    // decouples upload confirmation from scoring: if the worker is busy,
    // slow, or briefly down, the message just waits in the queue instead of
    // the request failing or the API server taking on that load itself.
    await sqsClient.send(
      new SendMessageCommand({
        QueueUrl: RESUME_SCORING_QUEUE_URL,
        MessageBody: JSON.stringify({ application_id: application.id }),
      }),
    );

    res.status(201).json({ message: "Resume recorded successfully", resume });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

module.exports = {
  applyToJob,
  getMyApplications,
  getJobApplications,
  updateApplicationStatus,
  getResumeUploadUrl,
  confirmResumeUpload,
};
