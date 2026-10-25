const pdfParse = require('pdf-parse');
const { Application, Resume, Score } = require('../models');
const { kick } = require('../services/scoreQueue');

// UPLOAD RESUME (Applicant only)
// One request replaces the old presign -> PUT to S3 -> confirm -> SQS flow.
// The PDF is parsed here and only the extracted text is stored.
const uploadResume = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Attach a PDF in the "resume" field' });
    }

    // Check the file's actual bytes, not the client-supplied mimetype.
    if (req.file.buffer.slice(0, 4).toString() !== '%PDF') {
      return res.status(400).json({ message: 'Only PDF resumes are supported' });
    }

    const application = await Application.findByPk(req.params.id);
    if (!application) return res.status(404).json({ message: 'Application not found' });
    if (application.applicant_id !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Replacing a resume while it is being scored would race the scorer.
    const existingScore = await Score.findOne({ where: { application_id: application.id } });
    if (existingScore && existingScore.status === 'processing') {
      return res.status(409).json({ message: 'Your resume is still being analysed. Try again in a moment.' });
    }

    let text;
    try {
      const parsed = await pdfParse(req.file.buffer);
      text = (parsed.text || '').trim();
    } catch (parseErr) {
      return res.status(422).json({ message: 'Could not read this PDF' });
    }
    if (text.length < 50) {
      return res.status(422).json({
        message: 'No readable text found in this PDF. Scanned or image-only resumes are not supported.'
      });
    }

    const [resume] = await Resume.findOrCreate({
      where: { application_id: application.id },
      defaults: { parsed_text: text, original_file_name: req.file.originalname }
    });
    // Covers re-uploads, where findOrCreate finds the old row.
    await resume.update({ parsed_text: text, original_file_name: req.file.originalname });

    // Queue (or re-queue) scoring.
    const [score] = await Score.findOrCreate({
      where: { application_id: application.id },
      defaults: { status: 'pending' }
    });
    await score.update({
      status: 'pending',
      fit_score: null,
      raw_similarity: null,
      matched_skills: null,
      error_message: null
    });

    kick(); // start now instead of waiting for the next poll; fire and forget

    res.status(201).json({
      message: 'Resume received',
      resume: { id: resume.id, original_file_name: resume.original_file_name }
    });
  } catch (err) {
    console.error('UPLOAD RESUME ERROR:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

module.exports = { uploadResume };