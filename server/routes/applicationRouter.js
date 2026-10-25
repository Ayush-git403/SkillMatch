const express = require('express');
const multer = require('multer');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const { resumeUploadLimiter } = require('../middleware/rateLimiter');
const {
  applyToJob,
  getMyApplications,
  getJobApplications,
  updateApplicationStatus
} = require('../controllers/applicationController');
const { uploadResume } = require('../controllers/Resumecontroller');

// Resume PDFs are held in memory just long enough to extract their text,
// so nothing is written to disk (Render's free filesystem is wiped on restart).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5 MB
});

// Wraps multer so a too-large or malformed upload returns clean JSON
// instead of Express's default HTML error page.
const handleResumeFile = (req, res, next) => {
  upload.single('resume')(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ message: 'Resume must be under 5 MB' });
    }
    return res.status(400).json({ message: 'Upload failed' });
  });
};

// Applicant only
router.post('/', authMiddleware, roleMiddleware('applicant'), applyToJob);
router.get('/my', authMiddleware, roleMiddleware('applicant'), getMyApplications);
// Order matters: auth, role, then the limiter (needs req.user), then the file parse.
router.post(
  '/:id/resume',
  authMiddleware,
  roleMiddleware('applicant'),
  resumeUploadLimiter,
  handleResumeFile,
  uploadResume
);

// Employer only
router.get('/job/:job_id', authMiddleware, roleMiddleware('employer'), getJobApplications);
router.patch('/:id', authMiddleware, roleMiddleware('employer'), updateApplicationStatus);

module.exports = router;