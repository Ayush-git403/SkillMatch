import React, { useEffect, useMemo, useState } from "react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

// ============================================================
// SMALL ICON COMPONENTS (replace text-glyph placeholders)
// ============================================================

const IconSearch = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
    <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
    <path d="M20 20L16.65 16.65" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const IconPin = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
    <path
      d="M12 22s7-7.58 7-12.5A7 7 0 0 0 5 9.5C5 14.42 12 22 12 22Z"
      stroke="currentColor" strokeWidth="2" strokeLinejoin="round"
    />
    <circle cx="12" cy="9.5" r="2.5" stroke="currentColor" strokeWidth="2" />
  </svg>
);

const IconClose = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <path d="M6 6L18 18M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
  </svg>
);

const IconEmpty = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    <rect x="3" y="7" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" />
    <path d="M3 7L7 3H17L21 7" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    <path d="M9 11H15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const IconUpload = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
    <path d="M12 16V4M12 4L7 9M12 4L17 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M4 16V18C4 19.1 4.9 20 6 20H18C19.1 20 20 19.1 20 18V16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

// Circular progress ring for the fit score — replaces the old flat
// bordered-circle-with-a-number. Animates in on mount/update.
const ScoreRing = ({ value, size = 40, stroke = 4, trackColor = "#dbeafe", fillColor = "#2563eb" }) => {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, value ?? 0));
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block" }}>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={trackColor} strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={radius} fill="none"
        stroke={fillColor} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={circumference} strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset 0.7s cubic-bezier(.4,0,.2,1)" }}
      />
    </svg>
  );
};

const ApplicantDashboard = () => {
  const { user, logout } = useAuth();

  const [jobs, setJobs] = useState([]);
  const [myApplications, setMyApplications] = useState([]);

  const [activeTab, setActiveTab] = useState("jobs");
  const [selectedJob, setSelectedJob] = useState(null);

  const [search, setSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState("all");
  const [jobTypeFilter, setJobTypeFilter] = useState("all");

  const [message, setMessage] = useState("");
  const [uploadingId, setUploadingId] = useState(null);

  // =========================================================
  // FETCH JOBS
  // =========================================================

  const fetchJobs = async () => {
    try {
      const response = await api.get("/jobs");
      const data = Array.isArray(response.data) ? response.data : [];
      setJobs(data);
      if (data.length > 0 && !selectedJob) {
        setSelectedJob(data[0]);
      }
    } catch (error) {
      console.error("Failed to fetch jobs:", error);
      setMessage("Unable to load jobs.");
    }
  };

  // =========================================================
  // FETCH APPLICATIONS
  // =========================================================

  const fetchApplications = async () => {
    try {
      const response = await api.get("/applications/my");
      const data = Array.isArray(response.data) ? response.data : [];
      setMyApplications(data);
    } catch (error) {
      console.error("Failed to fetch applications:", error);
    }
  };

  // =========================================================
  // INITIAL LOAD
  // =========================================================

  useEffect(() => {
    fetchJobs();
    fetchApplications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // =========================================================
  // GET SCORE OBJECT
  // =========================================================

  const getScoreData = (application) => {
    if (!application) return null;

    if (application.score && typeof application.score === "object" && !Array.isArray(application.score)) {
      return application.score;
    }
    if (application.fit_score && typeof application.fit_score === "object" && !Array.isArray(application.fit_score)) {
      return application.fit_score;
    }
    if (application.fit_score !== undefined || application.matched_skills !== undefined || application.status !== undefined) {
      return application;
    }
    return null;
  };

  const getScore = (application) => {
    const scoreData = getScoreData(application);
    if (!scoreData) return null;
    const score = scoreData.fit_score;
    if (score === null || score === undefined || score === "") return null;
    const numericScore = Number(score);
    return Number.isNaN(numericScore) ? null : Math.round(numericScore);
  };

  const getScoreStatus = (application) => {
    const scoreData = getScoreData(application);
    if (!scoreData) return "pending";
    return String(scoreData.status || application.score_status || application.status || "pending").toLowerCase();
  };

  const getMatchedSkills = (application) => {
    const scoreData = getScoreData(application);
    if (!scoreData) return [];
    const skills = scoreData.matched_skills;
    if (!Array.isArray(skills)) return [];
    return skills;
  };

  // =========================================================
  // POLL AI SCORING
  // =========================================================

  useEffect(() => {
    const shouldPoll = myApplications.some((application) => {
      const status = getScoreStatus(application);
      return application.resume_url && ["pending", "processing"].includes(status);
    });

    if (!shouldPoll) return;

    const interval = setInterval(() => {
      fetchApplications();
    }, 4000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myApplications]);

  // =========================================================
  // HELPERS
  // =========================================================

  const hasApplied = (jobId) => myApplications.some((application) => application.job_id === jobId);
  const getApplicationForJob = (jobId) => myApplications.find((application) => application.job_id === jobId);

  const handleApply = async (jobId) => {
    try {
      setMessage("");
      await api.post("/applications", { job_id: jobId });
      setMessage("Application submitted successfully.");
      await fetchApplications();
    } catch (error) {
      console.error("Apply error:", error);
      setMessage(error?.response?.data?.message || "Unable to submit application.");
    }
  };

  const handleResumeUpload = async (applicationId, file) => {
    if (!file) return;
    if (file.type !== "application/pdf") {
      setMessage("Please upload a PDF resume.");
      return;
    }

    try {
      setUploadingId(applicationId);
      setMessage("");

      const uploadResponse = await api.post(`/applications/${applicationId}/resume-upload-url`);
      const { uploadUrl, s3Key } = uploadResponse.data;

      await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": "application/pdf" },
      });

      await api.post(`/applications/${applicationId}/resume-confirm`, {
        s3Key,
        originalFileName: file.name,
      });

      setMessage("Resume uploaded. Your AI fit analysis is being generated.");
      await fetchApplications();
    } catch (error) {
      console.error("Resume upload error:", error);
      setMessage(error?.response?.data?.message || "Resume upload failed.");
    } finally {
      setUploadingId(null);
    }
  };

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      const query = search.trim().toLowerCase();
      const matchesSearch =
        !query ||
        job.title?.toLowerCase().includes(query) ||
        job.company?.toLowerCase().includes(query) ||
        job.description?.toLowerCase().includes(query);
      const matchesLocation =
        locationFilter === "all" || job.location?.toLowerCase().includes(locationFilter.toLowerCase());
      const matchesJobType =
        jobTypeFilter === "all" || job.job_type?.toLowerCase().includes(jobTypeFilter.toLowerCase());
      return matchesSearch && matchesLocation && matchesJobType;
    });
  }, [jobs, search, locationFilter, jobTypeFilter]);

  const renderSkill = (skill) => {
    if (typeof skill === "string") return skill;
    if (skill && typeof skill === "object") return skill.name || skill.skill || skill.title || "";
    return String(skill);
  };

  // =========================================================
  // UI
  // =========================================================

  return (
    <div className="skillmatch-page">
      {/* NAVBAR */}
     

      {/* HERO */}
      {activeTab === "jobs" && (
        <section className="sm-search-section">
          <div className="sm-search-container">
            <div className="sm-hero-copy">
              <span className="sm-eyebrow">AI-powered job matching</span>
              <h1>
                Find work that
                <br />
                fits your skills.
              </h1>
              <p>Discover opportunities and see how well your resume matches each role.</p>
            </div>

            <div className="sm-search-box">
              <div className="sm-search-field">
                <span className="search-icon"><IconSearch /></span>
                <input
                  type="text"
                  placeholder="Job title, skills or company"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="search-divider" />
              <div className="sm-search-field">
                <span className="location-icon"><IconPin /></span>
                <input
                  type="text"
                  placeholder="Location"
                  value={locationFilter === "all" ? "" : locationFilter}
                  onChange={(e) => setLocationFilter(e.target.value || "all")}
                />
              </div>
              <button className="sm-search-button">Search jobs</button>
            </div>
          </div>
        </section>
      )}

      {/* MESSAGE */}
      {message && (
        <div className="sm-message">
          <span>{message}</span>
          <button onClick={() => setMessage("")}><IconClose /></button>
        </div>
      )}

      <main className="sm-main">
        {/* JOBS TAB */}
        {activeTab === "jobs" && (
          <div className="sm-job-layout">
            {/* FILTER SIDEBAR */}
            <aside className="sm-filter-sidebar">
              <div className="filter-header">
                <h3>Filter jobs</h3>
                <button
                  onClick={() => {
                    setSearch("");
                    setLocationFilter("all");
                    setJobTypeFilter("all");
                  }}
                >
                  Clear
                </button>
              </div>

              <div className="filter-section">
                <label>Job type</label>
                {[
                  ["all", "All jobs"],
                  ["full-time", "Full-time"],
                  ["part-time", "Part-time"],
                  ["internship", "Internship"],
                ].map(([value, text]) => (
                  <button
                    key={value}
                    className={jobTypeFilter === value ? "filter-option selected" : "filter-option"}
                    onClick={() => setJobTypeFilter(value)}
                  >
                    <span className="filter-radio" />
                    {text}
                  </button>
                ))}
              </div>

              <div className="filter-section">
                <label>Work location</label>
                {[
                  ["all", "Any location"],
                  ["remote", "Remote"],
                  ["hybrid", "Hybrid"],
                  ["on-site", "On-site"],
                ].map(([value, text]) => (
                  <button
                    key={value}
                    className={locationFilter === value ? "filter-option selected" : "filter-option"}
                    onClick={() => setLocationFilter(value)}
                  >
                    <span className="filter-radio" />
                    {text}
                  </button>
                ))}
              </div>

              <div className="ai-sidebar-card">
                <div className="ai-sidebar-label">SkillMatch AI</div>
                <h4>
                  Let your resume
                  <br />
                  do the matching.
                </h4>
                <p>Upload your resume after applying to see your compatibility with the role.</p>
              </div>
            </aside>

            {/* JOB LIST */}
            <section className="sm-job-list">
              <div className="job-list-header">
                <div>
                  <span className="results-count">{filteredJobs.length} opportunities</span>
                  <h2>Jobs for you</h2>
                </div>
                <select className="sort-select" defaultValue="relevance">
                  <option value="relevance">Most relevant</option>
                  <option value="recent">Most recent</option>
                </select>
              </div>

              {filteredJobs.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon"><IconEmpty /></div>
                  <h3>No jobs found</h3>
                  <p>Try changing your search or filters.</p>
                </div>
              ) : (
                filteredJobs.map((job) => {
                  const application = getApplicationForJob(job.id);
                  const applied = hasApplied(job.id);
                  const score = getScore(application);

                  return (
                    <article
                      key={job.id}
                      className={selectedJob?.id === job.id ? "job-card selected" : "job-card"}
                      onClick={() => setSelectedJob(job)}
                    >
                      <div className="job-card-top">
                        <div className="company-logo">{job.company?.charAt(0).toUpperCase() || "C"}</div>

                        <div className="job-card-content">
                          <div className="job-card-title-row">
                            <div>
                              <h3>{job.title}</h3>
                              <p className="company-name">{job.company || "Company"}</p>
                            </div>
                            {applied && <span className="applied-badge">Applied</span>}
                          </div>

                          <div className="job-meta">
                            <span className="job-meta-item">
                              <IconPin />
                              {job.location || "Location not specified"}
                            </span>
                            <span className="meta-dot">·</span>
                            <span>{job.job_type || "Full-time"}</span>
                          </div>

                          {job.salary && <div className="job-salary">{job.salary}</div>}

                          {job.skills && (
                            <div className="job-skills">
                              {(Array.isArray(job.skills) ? job.skills : String(job.skills).split(","))
                                .slice(0, 4)
                                .map((skill, index) => (
                                  <span key={index}>{renderSkill(skill)}</span>
                                ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {score !== null && (
                        <div className="mini-score">
                          <div className="mini-score-ring-wrap">
                            <ScoreRing value={score} size={34} stroke={3} />
                            <span className="mini-score-num">{score}</span>
                          </div>
                          <span>AI fit match</span>
                        </div>
                      )}
                    </article>
                  );
                })
              )}
            </section>

            {/* JOB DETAILS */}
            <aside className="sm-job-details">
              {!selectedJob ? (
                <div className="details-empty">
                  <div className="empty-icon"><IconEmpty /></div>
                  <h3>Select a job</h3>
                  <p>Choose an opportunity to see its details.</p>
                </div>
              ) : (
                <div className="details-inner" key={selectedJob.id}>
                  <div className="details-company">
                    <div className="details-logo">{selectedJob.company?.charAt(0).toUpperCase() || "C"}</div>
                    <div>
                      <span>{selectedJob.company || "Company"}</span>
                    </div>
                  </div>

                  <h1>{selectedJob.title}</h1>

                  <div className="details-meta">
                    <span className="job-meta-item"><IconPin />{selectedJob.location || "Location not specified"}</span>
                    <span>{selectedJob.job_type || "Full-time"}</span>
                  </div>

                  {selectedJob.salary && <div className="details-salary">{selectedJob.salary}</div>}

                  <div className="details-actions">
                    {hasApplied(selectedJob.id) ? (
                      <button className="already-applied" disabled>
                        Application submitted
                      </button>
                    ) : (
                      <button className="apply-button" onClick={() => handleApply(selectedJob.id)}>
                        Apply for this job
                      </button>
                    )}
                  </div>

                  <div className="details-divider" />

                  {(() => {
                    const application = getApplicationForJob(selectedJob.id);
                    const score = getScore(application);
                    const status = getScoreStatus(application);
                    const matchedSkills = getMatchedSkills(application);

                    if (!application) {
                      return (
                        <div className="ai-match-card">
                          <div className="ai-label">SkillMatch AI</div>
                          <h3>See how well you match</h3>
                          <p>Apply for this role and upload your resume to get an AI-powered fit analysis.</p>
                        </div>
                      );
                    }

                    if (!application.resume_url) {
                      return (
                        <div className="ai-match-card">
                          <div className="ai-label">SkillMatch AI</div>
                          <h3>Upload your resume</h3>
                          <p>Your application is ready. Upload a PDF resume to calculate your AI fit score.</p>
                          <label className="resume-upload">
                            <input
                              type="file"
                              accept=".pdf"
                              onChange={(e) => handleResumeUpload(application.id, e.target.files[0])}
                            />
                            <IconUpload />
                            <span>{uploadingId === application.id ? "Uploading..." : "Upload PDF resume"}</span>
                          </label>
                        </div>
                      );
                    }

                    if (["pending", "processing"].includes(status)) {
                      return (
                        <div className="ai-match-card processing">
                          <div className="ai-label">SkillMatch AI</div>
                          <h3>Analysing your resume</h3>
                          <p>We're comparing your experience and skills with this role.</p>
                          <div className="loading-line"><span /></div>
                          <small>This usually takes a few moments.</small>
                        </div>
                      );
                    }

                    if (status === "failed" || status === "error") {
                      return (
                        <div className="ai-match-card error-card">
                          <div className="ai-label">SkillMatch AI</div>
                          <h3>Analysis unavailable</h3>
                          <p>We couldn't calculate your fit score right now. Please try again later.</p>
                        </div>
                      );
                    }

                    return (
                      <div className="ai-result-card">
                        <div className="ai-result-header">
                          <div>
                            <div className="ai-label">SkillMatch AI</div>
                            <h3>Your fit for this role</h3>
                          </div>
                          <div className="large-score-ring-wrap">
                            <ScoreRing value={score ?? 0} size={84} stroke={6} />
                            <div className="large-score">
                              {score !== null ? score : "--"}
                              {score !== null && <span>%</span>}
                            </div>
                          </div>
                        </div>

                        {matchedSkills.length > 0 && (
                          <div className="matched-skills">
                            <span className="matched-title">Matching skills</span>
                            <div className="skill-list">
                              {matchedSkills.map((skill, index) => {
                                const skillText = renderSkill(skill);
                                if (!skillText) return null;
                                return <span key={index}>{skillText}</span>;
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  <section className="job-description">
                    <h2>About this role</h2>
                    <div className="description-text">
                      {selectedJob.description || "No job description has been provided for this position."}
                    </div>
                  </section>
                </div>
              )}
            </aside>
          </div>
        )}

        {/* APPLICATIONS TAB */}
        {activeTab === "applications" && (
          <section className="applications-page">
            <div className="applications-heading">
              <div>
                <span className="sm-eyebrow">Your activity</span>
                <h1>My applications</h1>
                <p>Track your applications and AI compatibility results.</p>
              </div>
              <div className="application-count">
                {myApplications.length}
                <span>applications</span>
              </div>
            </div>

            {myApplications.length === 0 ? (
              <div className="applications-empty">
                <div className="empty-icon"><IconEmpty /></div>
                <h3>No applications yet</h3>
                <p>Start exploring jobs and apply to roles that match your skills.</p>
                <button onClick={() => setActiveTab("jobs")}>Explore jobs</button>
              </div>
            ) : (
              <div className="applications-grid">
                {myApplications.map((application) => {
                  const score = getScore(application);
                  const status = getScoreStatus(application);
                  const matchedSkills = getMatchedSkills(application);

                  return (
                    <article className="application-card" key={application.id}>
                      <div className="application-card-header">
                        <div>
                          <span className="application-company">
                            {application.company || application.job?.company || "Company"}
                          </span>
                          <h3>{application.title || application.job?.title || "Job application"}</h3>
                        </div>
                        <span className={status === "completed" ? "status completed" : "status"}>{status}</span>
                      </div>

                      <div className="application-card-body">
                        <div className="application-info">
                          <span className="job-meta-item">
                            <IconPin />
                            {application.location || application.job?.location || "Location not specified"}
                          </span>
                        </div>

                        {!application.resume_url ? (
                          <div className="application-upload">
                            <p>Upload your resume to receive your AI fit score.</p>
                            <label className="resume-upload">
                              <input
                                type="file"
                                accept=".pdf"
                                onChange={(e) => handleResumeUpload(application.id, e.target.files[0])}
                              />
                              <IconUpload />
                              <span>{uploadingId === application.id ? "Uploading..." : "Upload resume"}</span>
                            </label>
                          </div>
                        ) : status === "pending" || status === "processing" ? (
                          <div className="score-pending">
                            <div className="small-loader" />
                            <span>AI analysis in progress</span>
                          </div>
                        ) : (
                          <div className="application-score">
                            <div className="app-score-ring-wrap">
                              <ScoreRing value={score ?? 0} size={48} stroke={4} />
                              <span className="app-score-num">{score !== null ? score : "--"}</span>
                            </div>
                            <div className="app-score-text">
                              <span className="score-label">AI fit score</span>
                              <strong>{score !== null ? `${score}%` : "--"}</strong>
                            </div>
                            <button
                              onClick={() => {
                                const job = jobs.find((j) => j.id === application.job_id);
                                if (job) {
                                  setSelectedJob(job);
                                  setActiveTab("jobs");
                                }
                              }}
                            >
                              View job
                            </button>
                          </div>
                        )}

                        {matchedSkills.length > 0 && (
                          <div className="application-matched-skills">
                            <span>Matching skills</span>
                            <div>
                              {matchedSkills.slice(0, 5).map((skill, index) => (
                                <small key={index}>{renderSkill(skill)}</small>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </main>

      <style>{`
        * { box-sizing: border-box; }

        .skillmatch-page {
          min-height: 100vh;
          background: #f7f9fc;
          color: #172033;
          font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        /* HERO */
        .sm-search-section {
          background:
            radial-gradient(circle at 5% 20%, #dbeafe 0, transparent 30%),
            radial-gradient(circle at 90% 20%, #e0e7ff 0, transparent 30%),
            #f5f8ff;
          border-bottom: 1px solid #e5eaf2;
        }
        .sm-search-container { max-width: 1440px; margin: auto; padding: 48px 40px 52px; }
        .sm-hero-copy { margin-bottom: 30px; }
        .sm-eyebrow {
          color: #2563eb;
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 1.2px;
        }
        .sm-hero-copy h1 {
          margin: 10px 0 12px;
          font-family: Georgia, "Times New Roman", serif;
          font-size: clamp(40px, 5vw, 62px);
          line-height: 1.03;
          letter-spacing: -2.5px;
        }
        .sm-hero-copy p { max-width: 550px; margin: 0; color: #667085; font-size: 16px; line-height: 1.6; }

        .sm-search-box {
          max-width: 1000px;
          min-height: 68px;
          display: flex;
          align-items: center;
          padding: 8px;
          background: white;
          border: 1px solid #d9e0e8;
          border-radius: 14px;
          box-shadow: 0 1px 2px rgba(16,24,40,0.04), 0 12px 32px rgba(16,24,40,0.07);
          transition: box-shadow 0.2s ease;
        }
        .sm-search-box:focus-within {
          box-shadow: 0 1px 2px rgba(16,24,40,0.04), 0 16px 40px rgba(37,99,235,0.14);
          border-color: #bcd0f7;
        }
        .sm-search-field { flex: 1; display: flex; align-items: center; gap: 12px; padding: 0 18px; }
        .sm-search-field input {
          width: 100%; border: none; outline: none; background: transparent;
          font-size: 14px; color: #172033;
        }
        .sm-search-field input::placeholder { color: #98a2b3; }
        .search-icon, .location-icon { color: #2563eb; display: flex; }
        .search-divider { width: 1px; height: 34px; background: #e4e7ec; }
        .sm-search-button {
          height: 52px; padding: 0 28px;
          border: none; border-radius: 9px;
          background: #2563eb; color: white;
          font-size: 14px; font-weight: 700;
          cursor: pointer;
          transition: background 0.15s ease, transform 0.1s ease;
        }
        .sm-search-button:hover { background: #1d4ed8; }
        .sm-search-button:active { transform: scale(0.98); }

        /* MESSAGE */
        .sm-message {
          max-width: 1360px; margin: 16px auto 0; padding: 12px 18px;
          display: flex; align-items: center; justify-content: space-between;
          background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 9px;
          color: #1d4ed8; font-size: 13px;
        }
        .sm-message button {
          border: none; background: transparent; color: #2563eb;
          cursor: pointer; display: flex; padding: 4px;
        }

        /* MAIN */
        .sm-main { max-width: 1440px; margin: auto; padding: 32px 40px 70px; }
        .sm-job-layout {
          display: grid;
          grid-template-columns: 220px minmax(340px, 0.9fr) minmax(420px, 1.15fr);
          gap: 24px;
          align-items: start;
        }

        /* FILTER */
        .sm-filter-sidebar { background: white; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; }
        .filter-header { padding: 20px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #eaecf0; }
        .filter-header h3 { margin: 0; font-size: 15px; }
        .filter-header button { border: none; background: none; color: #2563eb; font-size: 12px; font-weight: 600; cursor: pointer; }
        .filter-section { padding: 20px; border-bottom: 1px solid #eaecf0; }
        .filter-section label { display: block; margin-bottom: 10px; color: #344054; font-size: 12px; font-weight: 700; }
        .filter-option {
          width: 100%; display: flex; align-items: center; gap: 9px; padding: 8px 0;
          border: none; background: transparent; color: #667085; font-size: 13px;
          text-align: left; cursor: pointer; transition: color 0.15s ease;
        }
        .filter-option:hover { color: #172033; }
        .filter-option.selected { color: #2563eb; font-weight: 600; }
        .filter-radio { width: 15px; height: 15px; border: 1px solid #cbd5e1; border-radius: 50%; position: relative; transition: border-color 0.15s ease; }
        .filter-option.selected .filter-radio { border-color: #2563eb; }
        .filter-option.selected .filter-radio::after {
          content: ""; position: absolute; width: 7px; height: 7px;
          left: 3px; top: 3px; background: #2563eb; border-radius: 50%;
        }
        .ai-sidebar-card { margin: 16px; padding: 18px; background: #eff6ff; border: 1px solid #dbeafe; border-radius: 10px; }
        .ai-sidebar-label, .ai-label { color: #2563eb; font-size: 10px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; }
        .ai-sidebar-card h4 { margin: 8px 0; font-family: Georgia, serif; font-size: 18px; line-height: 1.2; }
        .ai-sidebar-card p { margin: 0; color: #667085; font-size: 12px; line-height: 1.5; }

        /* JOB LIST */
        .job-list-header { margin-bottom: 16px; display: flex; align-items: flex-end; justify-content: space-between; }
        .results-count { color: #98a2b3; font-size: 12px; }
        .job-list-header h2 { margin: 4px 0 0; font-size: 22px; letter-spacing: -0.4px; }
        .sort-select { padding: 9px 12px; background: white; border: 1px solid #d9dee7; border-radius: 8px; color: #344054; font-size: 12px; outline: none; }

        /* JOB CARD */
        .job-card {
          position: relative; margin-bottom: 12px; padding: 20px;
          background: white; border: 1px solid #e4e7ec; border-radius: 12px;
          cursor: pointer;
          transition: border-color 0.2s ease, box-shadow 0.25s ease, transform 0.2s ease;
        }
        .job-card:hover {
          border-color: #93c5fd;
          box-shadow: 0 2px 4px rgba(16,24,40,0.03), 0 12px 28px rgba(37,99,235,0.1);
          transform: translateY(-2px);
        }
        .job-card.selected {
          border-color: #2563eb;
          box-shadow: 0 0 0 1px #2563eb, 0 2px 4px rgba(16,24,40,0.03), 0 12px 28px rgba(37,99,235,0.1);
        }
        .job-card-top { display: flex; gap: 14px; }
        .company-logo, .details-logo {
          width: 44px; height: 44px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          background: #eff6ff; border: 1px solid #dbeafe; border-radius: 10px;
          color: #2563eb; font-weight: 800;
        }
        .job-card-content { flex: 1; min-width: 0; }
        .job-card-title-row { display: flex; justify-content: space-between; gap: 12px; }
        .job-card h3 { margin: 0; font-size: 16px; line-height: 1.3; }
        .company-name { margin: 4px 0 0; color: #667085; font-size: 13px; }
        .applied-badge {
          white-space: nowrap; height: fit-content; padding: 5px 8px;
          background: #ecfdf3; color: #027a48; border-radius: 6px;
          font-size: 10px; font-weight: 700;
        }
        .job-meta { margin-top: 13px; display: flex; align-items: center; flex-wrap: wrap; gap: 8px; color: #667085; font-size: 12px; }
        .job-meta-item { display: inline-flex; align-items: center; gap: 5px; }
        .job-meta-item svg { color: #98a2b3; flex-shrink: 0; }
        .meta-dot { color: #cbd5e1; }
        .job-salary { margin-top: 9px; color: #344054; font-size: 12px; font-weight: 600; }
        .job-skills { margin-top: 13px; display: flex; flex-wrap: wrap; gap: 6px; }
        .job-skills span { padding: 4px 8px; background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 6px; color: #475467; font-size: 10px; }

        .mini-score {
          margin-top: 16px; padding-top: 14px;
          display: flex; align-items: center; gap: 10px;
          border-top: 1px solid #edf0f4;
        }
        .mini-score-ring-wrap { position: relative; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; }
        .mini-score-num { position: absolute; font-size: 9px; font-weight: 800; color: #2563eb; }
        .mini-score > span { color: #667085; font-size: 11px; }

        /* JOB DETAILS */
        .sm-job-details {
          min-height: 650px;
          position: sticky; top: 96px;
          background: white; border: 1px solid #e4e7ec; border-radius: 14px;
          overflow: hidden;
        }
        .details-inner { padding: 28px; animation: fadeIn 0.25s ease; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        .details-company { margin-bottom: 20px; display: flex; align-items: center; gap: 12px; }
        .details-company span { color: #667085; font-size: 13px; font-weight: 600; }
        .details-inner > h1 { margin: 0; font-size: 28px; line-height: 1.2; letter-spacing: -0.8px; }
        .details-meta { margin-top: 15px; display: flex; align-items: center; flex-wrap: wrap; gap: 15px; color: #667085; font-size: 13px; }
        .details-salary { margin-top: 12px; color: #344054; font-size: 13px; font-weight: 600; }
        .details-actions { margin-top: 22px; }
        .apply-button, .already-applied {
          width: 100%; height: 48px; border: none; border-radius: 10px;
          font-size: 14px; font-weight: 700; transition: background 0.15s ease, transform 0.1s ease;
        }
        .apply-button { background: #2563eb; color: white; cursor: pointer; }
        .apply-button:hover { background: #1d4ed8; }
        .apply-button:active { transform: scale(0.99); }
        .already-applied { background: #ecfdf3; color: #027a48; }
        .details-divider { height: 1px; margin: 26px 0; background: #eaecf0; }

        /* AI MATCH */
        .ai-match-card { padding: 20px; background: #eff6ff; border: 1px solid #dbeafe; border-radius: 12px; }
        .ai-match-card h3, .ai-result-card h3 { margin: 7px 0; font-size: 17px; }
        .ai-match-card p { margin: 0 0 16px; color: #667085; font-size: 13px; line-height: 1.6; }
        .resume-upload {
          display: inline-flex; align-items: center; gap: 8px; justify-content: center;
          padding: 10px 16px; background: #2563eb; color: white; border-radius: 8px;
          font-size: 12px; font-weight: 700; cursor: pointer; transition: background 0.15s ease;
        }
        .resume-upload:hover { background: #1d4ed8; }
        .resume-upload input { display: none; }
        .ai-match-card.processing { background: #f8fafc; border-color: #e4e7ec; }
        .error-card { background: #fff7f7; border-color: #fecaca; }
        .loading-line { height: 5px; margin: 18px 0 9px; background: #dbeafe; border-radius: 10px; overflow: hidden; }
        .loading-line span {
          display: block; width: 40%; height: 100%; background: #2563eb; border-radius: inherit;
          animation: loading 1.5s infinite ease-in-out;
        }
        @keyframes loading { 0% { transform: translateX(-100%); } 100% { transform: translateX(300%); } }
        .ai-match-card small { color: #98a2b3; font-size: 11px; }

        .ai-result-card { padding: 20px; background: linear-gradient(135deg, #eff6ff, #f8fbff); border: 1px solid #bfdbfe; border-radius: 12px; }
        .ai-result-header { display: flex; align-items: center; justify-content: space-between; gap: 15px; }
        .large-score-ring-wrap { position: relative; width: 84px; height: 84px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .large-score { position: absolute; color: #2563eb; font-size: 21px; font-weight: 800; letter-spacing: -1px; }
        .large-score span { font-size: 11px; letter-spacing: 0; }
        .matched-skills { margin-top: 20px; padding-top: 16px; border-top: 1px solid #dbeafe; }
        .matched-title { display: block; margin-bottom: 9px; color: #475467; font-size: 11px; font-weight: 700; }
        .skill-list { display: flex; flex-wrap: wrap; gap: 6px; }
        .skill-list span { padding: 5px 9px; background: white; border: 1px solid #dbeafe; border-radius: 6px; color: #2563eb; font-size: 10px; font-weight: 600; }

        /* DESCRIPTION */
        .job-description { margin-top: 30px; }
        .job-description h2 { margin-bottom: 12px; font-size: 18px; }
        .description-text { color: #667085; font-size: 13px; line-height: 1.75; white-space: pre-line; }

        /* EMPTY */
        .empty-state, .details-empty {
          padding: 50px 25px; background: white; border: 1px dashed #d0d5dd; border-radius: 12px; text-align: center;
        }
        .empty-state h3, .details-empty h3 { margin: 12px 0 5px; }
        .empty-state p, .details-empty p { color: #98a2b3; font-size: 13px; }
        .empty-icon {
          width: 44px; height: 44px; margin: auto;
          display: flex; align-items: center; justify-content: center;
          background: #f2f4f7; border-radius: 50%; color: #667085;
        }

        /* APPLICATIONS */
        .applications-page { max-width: 1100px; margin: auto; }
        .applications-heading { margin-bottom: 28px; display: flex; align-items: flex-end; justify-content: space-between; }
        .applications-heading h1 { margin: 7px 0; font-family: Georgia, serif; font-size: 42px; letter-spacing: -1.5px; }
        .applications-heading p { margin: 0; color: #667085; font-size: 14px; }
        .application-count {
          min-width: 100px; padding: 15px; background: white; border: 1px solid #e4e7ec; border-radius: 10px;
          color: #2563eb; font-size: 24px; font-weight: 800; text-align: center;
        }
        .application-count span { display: block; margin-top: 2px; color: #98a2b3; font-size: 10px; font-weight: 500; }
        .applications-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
        .application-card { background: white; border: 1px solid #e4e7ec; border-radius: 12px; overflow: hidden; transition: box-shadow 0.2s ease; }
        .application-card:hover { box-shadow: 0 8px 24px rgba(16,24,40,0.06); }
        .application-card-header { padding: 20px; display: flex; justify-content: space-between; gap: 15px; border-bottom: 1px solid #eaecf0; }
        .application-company { color: #667085; font-size: 11px; }
        .application-card h3 { margin: 5px 0 0; font-size: 17px; }
        .status { height: fit-content; padding: 5px 8px; background: #f2f4f7; border-radius: 6px; color: #667085; font-size: 9px; font-weight: 700; text-transform: uppercase; }
        .status.completed { background: #ecfdf3; color: #027a48; }
        .application-card-body { padding: 20px; }
        .application-info { display: flex; gap: 12px; color: #667085; font-size: 11px; }
        .application-upload { margin-top: 20px; padding-top: 18px; border-top: 1px solid #eaecf0; }
        .application-upload p { margin: 0 0 12px; color: #667085; font-size: 12px; line-height: 1.5; }
        .score-pending { margin-top: 20px; padding: 12px; display: flex; align-items: center; gap: 9px; background: #f8fafc; border-radius: 8px; color: #667085; font-size: 12px; }
        .small-loader { width: 15px; height: 15px; border: 2px solid #dbeafe; border-top-color: #2563eb; border-radius: 50%; animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .application-score { margin-top: 20px; padding-top: 18px; display: flex; align-items: center; gap: 14px; border-top: 1px solid #eaecf0; }
        .app-score-ring-wrap { position: relative; width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .app-score-num { position: absolute; font-size: 12px; font-weight: 800; color: #2563eb; }
        .app-score-text { flex: 1; }
        .score-label { display: block; color: #98a2b3; font-size: 10px; }
        .application-score strong { display: block; margin-top: 3px; color: #2563eb; font-size: 20px; }
        .application-score button {
          padding: 9px 12px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px;
          color: #2563eb; font-size: 11px; font-weight: 700; cursor: pointer; transition: background 0.15s ease;
        }
        .application-score button:hover { background: #dbeafe; }
        .application-matched-skills { margin-top: 16px; padding-top: 14px; border-top: 1px solid #eaecf0; }
        .application-matched-skills > span { display: block; margin-bottom: 8px; color: #667085; font-size: 10px; font-weight: 700; }
        .application-matched-skills > div { display: flex; flex-wrap: wrap; gap: 5px; }
        .application-matched-skills small { padding: 4px 8px; background: #eff6ff; border-radius: 6px; color: #2563eb; font-size: 9px; font-weight: 600; }
        .applications-empty { padding: 70px 25px; background: white; border: 1px dashed #d0d5dd; border-radius: 12px; text-align: center; }
        .applications-empty h3 { margin: 15px 0 7px; }
        .applications-empty p { color: #98a2b3; font-size: 13px; }
        .applications-empty button {
          margin-top: 12px; padding: 11px 20px; background: #2563eb; color: white; border: none;
          border-radius: 8px; font-weight: 700; cursor: pointer; transition: background 0.15s ease;
        }
        .applications-empty button:hover { background: #1d4ed8; }

        /* RESPONSIVE */
        @media (max-width: 1150px) {
          .sm-job-layout { grid-template-columns: 190px minmax(300px, 1fr); }
          .sm-job-details { grid-column: 1 / -1; position: static; }
        }
        @media (max-width: 850px) {
          .sm-navbar-inner { padding: 0 18px; }
          .sm-nav-links { display: none; }
          .sm-user-info { display: none; }
          .sm-search-container, .sm-main { padding-left: 18px; padding-right: 18px; }
          .sm-search-box { flex-direction: column; padding: 8px; }
          .sm-search-field { width: 100%; min-height: 48px; }
          .search-divider { display: none; }
          .sm-search-button { width: 100%; }
          .sm-job-layout { display: block; }
          .sm-filter-sidebar { margin-bottom: 20px; }
          .sm-job-details { margin-top: 20px; }
          .applications-grid { grid-template-columns: 1fr; }
          .applications-heading { align-items: flex-start; gap: 20px; }
        }
        @media (max-width: 550px) {
          .sm-hero-copy h1 { font-size: 40px; }
          .sm-search-container { padding-top: 35px; }
          .job-card { padding: 16px; }
          .details-inner { padding: 20px; }
          .details-inner > h1 { font-size: 23px; }
          .applications-heading { flex-direction: column; }
          .applications-heading h1 { font-size: 35px; }
          .application-count { width: 100%; }
        }
      `}</style>
    </div>
  );
};

export default ApplicantDashboard;