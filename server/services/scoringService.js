const { getEmbedding } = require("./embeddingClient");
const { Resume, Score, Application, JobListing } = require("../models");

// Small, static keyword list for the "matched skills" feature. Not
// exhaustive — this is a simple overlap check, not NLP skill extraction.
// Expand this list as needed; it's intentionally plain so it's easy to tune.
const SKILL_KEYWORDS = [
  "react",
  "node.js",
  "nodejs",
  "express",
  "postgresql",
  "mongodb",
  "mysql",
  "redis",
  "javascript",
  "typescript",
  "python",
  "java",
  "aws",
  "docker",
  "kubernetes",
  "graphql",
  "rest api",
  "sql",
  "git",
  "ci/cd",
  "jwt",
  "socket.io",
  "microservices",
  "html",
  "css",
  "next.js",
  "django",
  "flask",
];

function extractMatchedSkills(resumeText, jobText) {
  const resumeLower = resumeText.toLowerCase();
  const jobLower = jobText.toLowerCase();
  return SKILL_KEYWORDS.filter(
    (skill) => resumeLower.includes(skill) && jobLower.includes(skill),
  );
}

function cosineSimilarity(vecA, vecB) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Runs the full scoring pipeline for one application:
 * download resume -> extract text -> embed both texts -> cosine similarity
 * -> write Score row. Designed to be called from the SQS worker (next step),
 * but works standalone for now.
 *
 * @param {number} applicationId
 */
async function scoreApplication(applicationId) {
  const resume = await Resume.findOne({
    where: { application_id: applicationId },
  });
  if (!resume)
    throw new Error(`No resume found for application ${applicationId}`);

  const application = await Application.findByPk(applicationId, {
    include: [{ model: JobListing, as: "job" }],
  });
  if (!application) throw new Error(`Application ${applicationId} not found`);
  if (!application.job)
    throw new Error(`Application ${applicationId} has no linked job`);

  // Mark as processing up front so the frontend can show a live status
  const [score] = await Score.findOrCreate({
    where: { application_id: applicationId },
    defaults: { status: "processing" },
  });
  await score.update({ status: "processing", error_message: null });

  try {
    const resumeText = resume.parsed_text;
    if (!resumeText) throw new Error("Resume has no extracted text");

    const jobText = `${application.job.title}\n${application.job.description}`;

    const [resumeEmbedding, jobEmbedding] = await Promise.all([
      getEmbedding(resumeText),
      getEmbedding(jobText),
    ]);

    const similarity = cosineSimilarity(resumeEmbedding, jobEmbedding);
    // Cosine similarity for text embeddings is typically 0-1 in practice,
    // but clamp defensively before scaling to a 0-100 fit score.
    const clamped = Math.max(0, Math.min(1, similarity));
    const fitScore = Math.round(clamped * 100);

    const matchedSkills = extractMatchedSkills(resumeText, jobText);

    await score.update({
      status: "done",
      fit_score: fitScore,
      raw_similarity: similarity,
      matched_skills: matchedSkills,
    });

    return score;
  } catch (err) {
    await score.update({ status: "failed", error_message: err.message });
    throw err;
  }
}

module.exports = { scoreApplication, cosineSimilarity, extractMatchedSkills };
