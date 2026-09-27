import { useState, useEffect, useRef } from 'react';
import API from '../api/axios';
import { useAuth } from '../context/AuthContext';

const ApplicantDashboard = () => {
  const { user, logout } = useAuth();

  const [jobs, setJobs] = useState([]);
  const [myApplications, setMyApplications] = useState([]);
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState('jobs');
  const [uploadingId, setUploadingId] = useState(null);

  const prevPendingCountRef = useRef(0);

  // =========================
  // FETCH JOBS
  // =========================
  const fetchJobs = async () => {
    try {
      const res = await API.get('/jobs');
      setJobs(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  // =========================
  // FETCH APPLICATIONS
  // =========================
  const fetchMyApplications = async () => {
    try {
      const res = await API.get('/applications/my');
      setMyApplications(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchJobs();
    fetchMyApplications();
  }, []);

  // =========================
  // POLL AI SCORING
  // =========================
  useEffect(() => {
    const pendingCount = myApplications.filter(
      (app) =>
        app.resume &&
        (!app.score ||
          ['pending', 'processing'].includes(app.score.status))
    ).length;

    if (prevPendingCountRef.current > 0 && pendingCount === 0) {
      setMessage('AI scoring completed.');
    }

    prevPendingCountRef.current = pendingCount;

    if (pendingCount === 0) return;

    const interval = setInterval(() => {
      fetchMyApplications();
    }, 4000);

    return () => clearInterval(interval);
  }, [myApplications]);

  // =========================
  // APPLY TO JOB
  // =========================
  const handleApply = async (job_id) => {
    try {
      await API.post('/applications', { job_id });
      setMessage('Application submitted successfully.');
      fetchMyApplications();
    } catch (err) {
      setMessage(
        err.response?.data?.message ||
          'Unable to submit application.'
      );
    }
  };

  // =========================
  // CHECK APPLICATION
  // =========================
  const hasApplied = (job_id) => {
    return myApplications.some(
      (app) => app.job_id === job_id
    );
  };

  // =========================
  // RESUME UPLOAD
  // =========================
  const handleResumeUpload = async (applicationId, file) => {
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setMessage('Only PDF resumes are supported.');
      return;
    }

    setUploadingId(applicationId);
    setMessage('');

    try {
      const { data: urlData } = await API.post(
        `/applications/${applicationId}/resume-upload-url`,
        {
          fileName: file.name,
          contentType: file.type,
        }
      );

      // Direct upload to S3 using presigned URL
      const uploadRes = await fetch(
        urlData.uploadUrl,
        {
          method: 'PUT',
          headers: {
            'Content-Type': file.type,
          },
          body: file,
        }
      );

      if (!uploadRes.ok) {
        throw new Error('Upload to storage failed');
      }

      // Confirm upload with backend
      await API.post(
        `/applications/${applicationId}/resume-confirm`,
        {
          s3Key: urlData.s3Key,
          originalFileName: file.name,
        }
      );

      setMessage(
        'Resume uploaded. AI scoring is now in progress.'
      );

      fetchMyApplications();
    } catch (err) {
      setMessage(
        err.response?.data?.message ||
          err.message ||
          'Error uploading resume.'
      );
    } finally {
      setUploadingId(null);
    }
  };

  // =========================
  // STATS
  // =========================
  const scoredApplications = myApplications.filter(
    (app) => app.score?.status === 'done'
  );

  return (
    <>
      <style>{`

        /* =========================
           GLOBAL
        ========================= */

        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          font-family:
            Inter,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;

          background: #faf9f7;
          color: #181818;
        }

        button,
        input {
          font-family: inherit;
        }

        button {
          transition:
            background 0.2s ease,
            color 0.2s ease,
            border-color 0.2s ease,
            transform 0.2s ease;
        }

        /* =========================
           PAGE
        ========================= */

        .skillmatch-page {
          min-height: 100vh;
          background: #faf9f7;
        }

        /* =========================
           NAVBAR
        ========================= */

        .skillmatch-navbar {
          height: 76px;

          padding: 0 6%;

          display: flex;
          align-items: center;
          justify-content: space-between;

          background: rgba(250, 249, 247, 0.94);

          border-bottom: 1px solid #e8e5e1;

          position: sticky;
          top: 0;
          z-index: 20;

          backdrop-filter: blur(12px);
        }

        .brand {
          font-family:
            Georgia,
            "Times New Roman",
            serif;

          font-size: 27px;
          font-weight: 600;

          letter-spacing: -0.8px;

          color: #171717;
        }

        .brand span {
          color: #e85b88;
        }

        .navbar-right {
          display: flex;
          align-items: center;
          gap: 28px;
        }

        .nav-user {
          font-size: 14px;
          color: #77716c;
        }

        .logout-btn {
          border: 1px solid #ded9d4;

          background: transparent;
          color: #242424;

          padding: 9px 17px;

          border-radius: 999px;

          cursor: pointer;

          font-size: 13px;
        }

        .logout-btn:hover {
          border-color: #e85b88;
          color: #e85b88;
        }

        /* =========================
           MAIN
        ========================= */

        .dashboard-container {
          width: min(1180px, 88%);

          margin: 0 auto;

          padding: 62px 0 90px;
        }

        /* =========================
           HERO
        ========================= */

        .hero-section {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;

          gap: 40px;

          margin-bottom: 48px;
        }

        .hero-eyebrow {
          margin: 0 0 12px;

          color: #e85b88;

          font-size: 12px;
          font-weight: 700;

          letter-spacing: 1.8px;

          text-transform: uppercase;
        }

        .hero-title {
          margin: 0;

          font-family:
            Georgia,
            "Times New Roman",
            serif;

          font-size: clamp(42px, 5vw, 68px);

          font-weight: 500;

          letter-spacing: -3px;

          line-height: 0.98;

          max-width: 700px;
        }

        .hero-title span {
          color: #e85b88;
          font-style: italic;
        }

        .hero-description {
          margin: 20px 0 0;

          max-width: 570px;

          color: #77716c;

          font-size: 16px;

          line-height: 1.7;
        }

        /* =========================
           MESSAGE
        ========================= */

        .message {
          margin-bottom: 28px;

          padding: 13px 18px;

          border: 1px solid #f0ccd9;

          background: #fff5f8;

          color: #a63d62;

          border-radius: 10px;

          font-size: 14px;
        }

        /* =========================
           STATS
        ========================= */

        .stats-grid {
          display: grid;

          grid-template-columns:
            repeat(3, 1fr);

          gap: 14px;

          margin-bottom: 55px;
        }

        .stat-card {
          padding: 24px 26px;

          background: #ffffff;

          border: 1px solid #e8e5e1;

          border-radius: 14px;
        }

        .stat-number {
          display: block;

          font-family:
            Georgia,
            "Times New Roman",
            serif;

          font-size: 36px;

          line-height: 1;

          margin-bottom: 8px;
        }

        .stat-label {
          color: #85807b;

          font-size: 13px;
        }

        /* =========================
           CONTENT HEADER
        ========================= */

        .content-header {
          display: flex;

          align-items: center;

          justify-content: space-between;

          margin-bottom: 24px;
        }

        .section-title {
          margin: 0;

          font-family:
            Georgia,
            "Times New Roman",
            serif;

          font-size: 32px;

          font-weight: 500;

          letter-spacing: -1px;
        }

        /* =========================
           TABS
        ========================= */

        .tabs {
          display: flex;

          gap: 7px;

          padding: 4px;

          background: #efedea;

          border-radius: 999px;
        }

        .tab {
          border: none;

          background: transparent;

          padding: 9px 18px;

          border-radius: 999px;

          color: #77716c;

          font-size: 13px;

          cursor: pointer;
        }

        .tab:hover {
          color: #e85b88;
        }

        .tab.active {
          background: #ffffff;

          color: #181818;

          box-shadow:
            0 2px 8px
            rgba(0, 0, 0, 0.06);
        }

        /* =========================
           JOB GRID
        ========================= */

        .jobs-list {
          display: grid;

          grid-template-columns:
            repeat(2, 1fr);

          gap: 18px;
        }

        .job-card {
          position: relative;

          padding: 28px;

          background: #ffffff;

          border: 1px solid #e6e2de;

          border-radius: 16px;

          transition:
            transform 0.25s ease,
            border-color 0.25s ease,
            box-shadow 0.25s ease;
        }

        .job-card:hover {
          transform: translateY(-3px);

          border-color: #e6a9bd;

          box-shadow:
            0 14px 35px
            rgba(35, 25, 30, 0.06);
        }

        .job-top {
          display: flex;

          justify-content: space-between;

          align-items: flex-start;

          gap: 20px;
        }

        .job-title {
          margin: 0 0 8px;

          font-family:
            Georgia,
            "Times New Roman",
            serif;

          font-size: 24px;

          font-weight: 500;

          letter-spacing: -0.5px;
        }

        .company {
          color: #77716c;

          font-size: 13px;
        }

        .job-description {
          margin: 22px 0;

          color: #66615d;

          font-size: 14px;

          line-height: 1.65;

          display: -webkit-box;

          -webkit-line-clamp: 3;

          -webkit-box-orient: vertical;

          overflow: hidden;
        }

        .job-footer {
          display: flex;

          justify-content: space-between;

          align-items: center;

          padding-top: 20px;

          border-top: 1px solid #eeeae6;
        }

        .posted-by {
          color: #99938d;

          font-size: 12px;
        }

        .apply-btn {
          border: none;

          background: #181818;

          color: #ffffff;

          padding: 10px 22px;

          border-radius: 999px;

          font-size: 13px;

          cursor: pointer;
        }

        .apply-btn:hover {
          background: #e85b88;

          transform: translateY(-1px);
        }

        .apply-btn.applied {
          background: #efedea;

          color: #77716c;

          cursor: not-allowed;
        }

        /* =========================
           APPLICATIONS
        ========================= */

        .applications-list {
          display: flex;

          flex-direction: column;

          gap: 16px;
        }

        .application-card {
          padding: 28px;

          background: #ffffff;

          border: 1px solid #e6e2de;

          border-radius: 16px;
        }

        .application-header {
          display: flex;

          align-items: flex-start;

          justify-content: space-between;

          gap: 20px;
        }

        .application-title {
          margin: 0 0 7px;

          font-family:
            Georgia,
            "Times New Roman",
            serif;

          font-size: 24px;

          font-weight: 500;
        }

        .application-company {
          color: #77716c;

          font-size: 13px;
        }

        /* =========================
           STATUS
        ========================= */

        .status-pill {
          padding: 7px 13px;

          border-radius: 999px;

          font-size: 11px;

          font-weight: 700;

          text-transform: capitalize;
        }

        .status-shortlisted {
          background: #eaf7ef;

          color: #287748;
        }

        .status-rejected {
          background: #fff0f1;

          color: #b8444d;
        }

        .status-pending {
          background: #fff7e8;

          color: #9b6a18;
        }

        .status-default {
          background: #efedea;

          color: #77716c;
        }

        /* =========================
           AI SCORE
        ========================= */

        .ai-section {
          margin-top: 25px;

          padding-top: 23px;

          border-top: 1px solid #eeeae6;
        }

        .ai-section-title {
          margin: 0 0 17px;

          color: #77716c;

          font-size: 12px;

          font-weight: 700;

          letter-spacing: 1.2px;

          text-transform: uppercase;
        }

        .score-row {
          display: flex;

          align-items: center;

          gap: 20px;
        }

        .score-circle {
          width: 74px;

          height: 74px;

          display: flex;

          align-items: center;

          justify-content: center;

          border: 2px solid #e85b88;

          border-radius: 50%;

          font-family:
            Georgia,
            "Times New Roman",
            serif;

          font-size: 22px;
        }

        .score-info {
          flex: 1;
        }

        .score-label {
          margin: 0 0 6px;

          font-size: 14px;

          font-weight: 600;
        }

        .matched-skills {
          margin: 0;

          color: #77716c;

          font-size: 13px;

          line-height: 1.6;
        }

        .skills-label {
          color: #e85b88;

          font-weight: 600;
        }

        /* =========================
           RESUME UPLOAD
        ========================= */

        .upload-box {
          padding: 22px;

          background: #faf9f7;

          border: 1px dashed #d8d2cc;

          border-radius: 12px;
        }

        .upload-title {
          margin: 0 0 6px;

          font-size: 14px;

          font-weight: 600;
        }

        .upload-description {
          margin: 0 0 15px;

          color: #85807b;

          font-size: 13px;
        }

        .file-input {
          width: 100%;

          font-size: 13px;

          color: #66615d;
        }

        .uploading {
          display: inline-block;

          margin-top: 10px;

          color: #e85b88;

          font-size: 12px;
        }

        .scoring {
          color: #8b7b61;

          font-size: 13px;
        }

        .failed {
          color: #b8444d;

          font-size: 13px;
        }

        /* =========================
           EMPTY STATE
        ========================= */

        .empty-state {
          padding: 65px 25px;

          background: #ffffff;

          border: 1px dashed #ddd7d1;

          border-radius: 16px;

          text-align: center;
        }

        .empty-state h3 {
          margin: 0 0 9px;

          font-family:
            Georgia,
            "Times New Roman",
            serif;

          font-size: 26px;

          font-weight: 500;
        }

        .empty-state p {
          margin: 0;

          color: #85807b;

          font-size: 14px;
        }

        /* =========================
           RESPONSIVE
        ========================= */

        @media (max-width: 800px) {

          .dashboard-container {
            width: 92%;

            padding-top: 42px;
          }

          .hero-section {
            display: block;
          }

          .hero-title {
            font-size: 48px;
          }

          .stats-grid {
            grid-template-columns: 1fr;
          }

          .jobs-list {
            grid-template-columns: 1fr;
          }

          .content-header {
            display: block;
          }

          .tabs {
            margin-top: 18px;

            width: fit-content;
          }

          .skillmatch-navbar {
            padding: 0 4%;
          }

          .nav-user {
            display: none;
          }
        }

        @media (max-width: 520px) {

          .hero-title {
            font-size: 40px;

            letter-spacing: -2px;
          }

          .navbar-right {
            gap: 10px;
          }

          .brand {
            font-size: 23px;
          }

          .job-top,
          .application-header {
            display: block;
          }

          .status-pill {
            display: inline-block;

            margin-top: 14px;
          }

          .tabs {
            width: 100%;
          }

          .tab {
            flex: 1;
          }
        }

      `}</style>

      <div className="skillmatch-page">

        {/* =========================
            NAVBAR
        ========================= */}

        <nav className="skillmatch-navbar">

          <div className="brand">
            Skill<span>Match</span>
          </div>

          <div className="navbar-right">

            <span className="nav-user">
              {user?.name}
            </span>

            <button
              className="logout-btn"
              onClick={logout}
            >
              Logout
            </button>

          </div>

        </nav>

        {/* =========================
            MAIN
        ========================= */}

        <main className="dashboard-container">

          {/* HERO */}

          <section className="hero-section">

            <div>

              <p className="hero-eyebrow">
                Applicant Dashboard
              </p>

              <h1 className="hero-title">
                Find work that
                <br />
                <span>fits you.</span>
              </h1>

              <p className="hero-description">
                Explore opportunities, track your
                applications, and discover how well
                your skills match each role.
              </p>

            </div>

          </section>

          {/* MESSAGE */}

          {message && (
            <div className="message">
              {message}
            </div>
          )}

          {/* STATS */}

          <section className="stats-grid">

            <div className="stat-card">

              <span className="stat-number">
                {jobs.length}
              </span>

              <span className="stat-label">
                Open opportunities
              </span>

            </div>

            <div className="stat-card">

              <span className="stat-number">
                {myApplications.length}
              </span>

              <span className="stat-label">
                Applications submitted
              </span>

            </div>

            <div className="stat-card">

              <span className="stat-number">
                {scoredApplications.length}
              </span>

              <span className="stat-label">
                AI matches evaluated
              </span>

            </div>

          </section>

          {/* CONTENT HEADER */}

          <div className="content-header">

            <h2 className="section-title">
              {activeTab === 'jobs'
                ? 'Explore opportunities'
                : 'Your applications'}
            </h2>

            <div className="tabs">

              <button
                className={`tab ${
                  activeTab === 'jobs'
                    ? 'active'
                    : ''
                }`}
                onClick={() =>
                  setActiveTab('jobs')
                }
              >
                Browse Jobs
              </button>

              <button
                className={`tab ${
                  activeTab === 'applications'
                    ? 'active'
                    : ''
                }`}
                onClick={() =>
                  setActiveTab('applications')
                }
              >
                My Applications
              </button>

            </div>

          </div>

          {/* =========================
              BROWSE JOBS
          ========================= */}

          {activeTab === 'jobs' && (

            <>
              {jobs.length === 0 ? (

                <div className="empty-state">

                  <h3>
                    No opportunities yet
                  </h3>

                  <p>
                    Check back later for new roles.
                  </p>

                </div>

              ) : (

                <div className="jobs-list">

                  {jobs.map((job) => {

                    const applied =
                      hasApplied(job.id);

                    return (

                      <article
                        className="job-card"
                        key={job.id}
                      >

                        <div className="job-top">

                          <div>

                            <h3 className="job-title">
                              {job.title}
                            </h3>

                            <span className="company">
                              {job.employer?.name ||
                                'Company'}
                            </span>

                          </div>

                        </div>

                        <p className="job-description">
                          {job.description}
                        </p>

                        <div className="job-footer">

                          <span className="posted-by">
                            Posted by{' '}
                            {job.employer?.name ||
                              'Employer'}
                          </span>

                          <button
                            className={`apply-btn ${
                              applied
                                ? 'applied'
                                : ''
                            }`}
                            disabled={applied}
                            onClick={() =>
                              handleApply(
                                job.id
                              )
                            }
                          >
                            {applied
                              ? 'Applied'
                              : 'Apply'}
                          </button>

                        </div>

                      </article>

                    );
                  })}

                </div>

              )}
            </>

          )}

          {/* =========================
              MY APPLICATIONS
          ========================= */}

          {activeTab === 'applications' && (

            <>
              {myApplications.length === 0 ? (

                <div className="empty-state">

                  <h3>
                    No applications yet
                  </h3>

                  <p>
                    Start exploring jobs and apply
                    to opportunities that match
                    your skills.
                  </p>

                </div>

              ) : (

                <div className="applications-list">

                  {myApplications.map((app) => {

                    const statusClass =
                      app.status === 'shortlisted'
                        ? 'status-shortlisted'
                        : app.status === 'rejected'
                        ? 'status-rejected'
                        : app.status === 'pending'
                        ? 'status-pending'
                        : 'status-default';

                    return (

                      <article
                        className="application-card"
                        key={app.id}
                      >

                        <div className="application-header">

                          <div>

                            <h3 className="application-title">
                              {app.job?.title}
                            </h3>

                            <span className="application-company">
                              {app.job?.employer?.name ||
                                'Company'}
                            </span>

                          </div>

                          <span
                            className={`status-pill ${statusClass}`}
                          >
                            {app.status}
                          </span>

                        </div>

                        {/* AI FIT */}

                        <div className="ai-section">

                          <p className="ai-section-title">
                            AI Fit Analysis
                          </p>

                          {!app.resume ? (

                            <div className="upload-box">

                              <p className="upload-title">
                                Upload your resume
                              </p>

                              <p className="upload-description">
                                Upload a PDF to receive
                                an AI-powered match score
                                for this position.
                              </p>

                              <input
                                className="file-input"
                                type="file"
                                accept="application/pdf"
                                disabled={
                                  uploadingId ===
                                  app.id
                                }
                                onChange={(e) =>
                                  handleResumeUpload(
                                    app.id,
                                    e.target.files[0]
                                  )
                                }
                              />

                              {uploadingId ===
                                app.id && (

                                <span className="uploading">
                                  Uploading resume...
                                </span>

                              )}

                            </div>

                          ) : app.score?.status ===
                            'done' ? (

                            <div className="score-row">

                              <div className="score-circle">
                                {app.score.fit_score}%
                              </div>

                              <div className="score-info">

                                <p className="score-label">
                                  AI Match Score
                                </p>

                                {app.score
                                  .matched_skills
                                  ?.length > 0 && (

                                  <p className="matched-skills">

                                    <span className="skills-label">
                                      Matched skills:
                                    </span>{' '}

                                    {app.score.matched_skills.join(
                                      ', '
                                    )}

                                  </p>

                                )}

                              </div>

                            </div>

                          ) : app.score?.status ===
                            'failed' ? (

                            <p className="failed">
                              Scoring failed:{' '}
                              {app.score
                                .error_message ||
                                'Unknown error'}
                            </p>

                          ) : (

                            <p className="scoring">
                              Your resume is being
                              analyzed. AI scoring
                              is in progress...
                            </p>

                          )}

                        </div>

                      </article>

                    );

                  })}

                </div>

              )}

            </>

          )}

        </main>

      </div>
    </>
  );
};

export default ApplicantDashboard;