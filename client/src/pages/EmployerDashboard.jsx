import { useState, useEffect } from 'react';
import API from '../api/axios';
import { useAuth } from '../context/AuthContext';

const EmployerDashboard = () => {
  const { user } = useAuth();

  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);

  const [form, setForm] = useState({
    title: '',
    description: '',
    location: '',
    job_type: 'Full-time',
    salary: '',
    skills: '',
  });

  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // -----------------------------
  // FETCH EMPLOYER JOBS
  // -----------------------------
  const fetchMyJobs = async () => {
    try {
      const res = await API.get('/jobs/employer/myjobs');
      setJobs(res.data);
    } catch (err) {
      console.error('Error fetching jobs:', err);
    }
  };

  useEffect(() => {
    fetchMyJobs();
  }, []);

  // -----------------------------
  // HANDLE FORM INPUT
  // -----------------------------
  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // -----------------------------
  // POST JOB
  // -----------------------------
  const handlePostJob = async (e) => {
    e.preventDefault();

    setMessage('');
    setLoading(true);

    try {
      const jobData = {
        title: form.title.trim(),
        description: form.description.trim(),
        location: form.location.trim(),
        job_type: form.job_type,
        salary: form.salary ? Number(form.salary) : null,

        // Convert:
        // "React, Node.js, PostgreSQL"
        // ->
        // ["React", "Node.js", "PostgreSQL"]
        skills: form.skills
          .split(',')
          .map((skill) => skill.trim())
          .filter(Boolean),
      };

      await API.post('/jobs', jobData);

      setMessage('Job posted successfully.');

      setForm({
        title: '',
        description: '',
        location: '',
        job_type: 'Full-time',
        salary: '',
        skills: '',
      });

      await fetchMyJobs();
    } catch (err) {
      console.error('Error posting job:', err);

      setMessage(
        err.response?.data?.message || 'Error posting job'
      );
    } finally {
      setLoading(false);
    }
  };

  // -----------------------------
  // VIEW APPLICATIONS
  // -----------------------------
  const handleViewApplications = async (jobId) => {
    try {
      const res = await API.get(`/applications/job/${jobId}`);

      setApplications(res.data);
      setSelectedJob(jobId);
    } catch (err) {
      console.error('Error fetching applications:', err);
    }
  };

  // -----------------------------
  // UPDATE APPLICATION STATUS
  // -----------------------------
  const handleStatusUpdate = async (appId, status) => {
    try {
      await API.patch(`/applications/${appId}`, {
        status,
      });

      await handleViewApplications(selectedJob);
    } catch (err) {
      console.error('Error updating application:', err);
    }
  };

  // -----------------------------
  // DELETE JOB
  // -----------------------------
  const handleDeleteJob = async (jobId) => {
    const confirmed = window.confirm(
      'Are you sure you want to delete this job?'
    );

    if (!confirmed) return;

    try {
      await API.delete(`/jobs/${jobId}`);

      if (selectedJob === jobId) {
        setSelectedJob(null);
        setApplications([]);
      }

      await fetchMyJobs();
    } catch (err) {
      console.error('Error deleting job:', err);
    }
  };

  return (
    <div style={styles.page}>

      {/* HEADER */}
      <div style={styles.header}>
        <div>
          <p style={styles.eyebrow}>EMPLOYER</p>

          <h1 style={styles.heading}>
            Welcome, {user?.name || 'Employer'}
          </h1>

          <p style={styles.subtitle}>
            Manage your job postings and review applications.
          </p>
        </div>
      </div>

      {/* ---------------- POST JOB ---------------- */}
      <section style={styles.card}>
        <div style={styles.sectionHeader}>
          <div>
            <h2 style={styles.sectionTitle}>
              Post a New Job
            </h2>

            <p style={styles.sectionSubtitle}>
              Add the details candidates will see in your job listing.
            </p>
          </div>
        </div>

        {message && (
          <div style={styles.message}>
            {message}
          </div>
        )}

        <form onSubmit={handlePostJob}>

          {/* TITLE */}
          <div style={styles.formGroup}>
            <label style={styles.label}>
              Job Title
            </label>

            <input
              type="text"
              name="title"
              placeholder="e.g. Full Stack Developer"
              value={form.title}
              onChange={handleChange}
              required
              style={styles.input}
            />
          </div>

          {/* DESCRIPTION */}
          <div style={styles.formGroup}>
            <label style={styles.label}>
              Job Description
            </label>

            <textarea
              name="description"
              placeholder="Describe the role, responsibilities and requirements..."
              value={form.description}
              onChange={handleChange}
              required
              rows={5}
              style={{
                ...styles.input,
                resize: 'vertical',
              }}
            />
          </div>

          {/* LOCATION + JOB TYPE */}
          <div style={styles.gridTwo}>

            <div style={styles.formGroup}>
              <label style={styles.label}>
                Location
              </label>

              <input
                type="text"
                name="location"
                placeholder="e.g. Gurgaon, India"
                value={form.location}
                onChange={handleChange}
                style={styles.input}
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>
                Job Type
              </label>

              <select
                name="job_type"
                value={form.job_type}
                onChange={handleChange}
                style={styles.input}
              >
                <option value="Full-time">
                  Full-time
                </option>

                <option value="Part-time">
                  Part-time
                </option>

                <option value="Internship">
                  Internship
                </option>

                <option value="Contract">
                  Contract
                </option>

                <option value="Remote">
                  Remote
                </option>
              </select>
            </div>

          </div>

          {/* SALARY + SKILLS */}
          <div style={styles.gridTwo}>

            <div style={styles.formGroup}>
              <label style={styles.label}>
                Salary
              </label>

              <input
                type="number"
                name="salary"
                placeholder="e.g. 800000"
                value={form.salary}
                onChange={handleChange}
                min="0"
                style={styles.input}
              />

              <small style={styles.helper}>
                Enter annual salary amount.
              </small>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>
                Skills
              </label>

              <input
                type="text"
                name="skills"
                placeholder="React, Node.js, PostgreSQL"
                value={form.skills}
                onChange={handleChange}
                style={styles.input}
              />

              <small style={styles.helper}>
                Separate skills using commas.
              </small>
            </div>

          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              ...styles.primaryButton,
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Posting...' : 'Post Job'}
          </button>

        </form>
      </section>

      {/* ---------------- MY JOBS ---------------- */}
      <section style={styles.section}>

        <div style={styles.sectionHeader}>
          <div>
            <h2 style={styles.sectionTitle}>
              My Posted Jobs
            </h2>

            <p style={styles.sectionSubtitle}>
              {jobs.length} {jobs.length === 1 ? 'job' : 'jobs'} posted
            </p>
          </div>
        </div>

        {jobs.length === 0 ? (
          <div style={styles.emptyState}>
            <p>No jobs posted yet.</p>
          </div>
        ) : (
          <div style={styles.jobsGrid}>

            {jobs.map((job) => (
              <div
                key={job.id}
                style={styles.jobCard}
              >

                <div style={styles.jobTop}>

                  <div>
                    <h3 style={styles.jobTitle}>
                      {job.title}
                    </h3>

                    <p style={styles.jobMeta}>
                      {job.location || 'Location not specified'}
                      {' · '}
                      {job.job_type || 'Job type not specified'}
                    </p>
                  </div>

                  <span style={styles.status}>
                    {job.status || 'active'}
                  </span>

                </div>

                <p style={styles.jobDescription}>
                  {job.description}
                </p>

                {/* SKILLS */}
                {Array.isArray(job.skills) &&
                  job.skills.length > 0 && (
                    <div style={styles.skills}>
                      {job.skills.map((skill, index) => (
                        <span
                          key={index}
                          style={styles.skill}
                        >
                          {typeof skill === 'string'
                            ? skill
                            : skill?.name || skill?.skill || ''}
                        </span>
                      ))}
                    </div>
                  )}

                {/* SALARY */}
                {job.salary && (
                  <p style={styles.salary}>
                    Salary: ₹{Number(job.salary).toLocaleString('en-IN')}
                  </p>
                )}

                <div style={styles.actions}>

                  <button
                    onClick={() =>
                      handleViewApplications(job.id)
                    }
                    style={styles.secondaryButton}
                  >
                    View Applications
                  </button>

                  <button
                    onClick={() =>
                      handleDeleteJob(job.id)
                    }
                    style={styles.deleteButton}
                  >
                    Delete
                  </button>

                </div>

              </div>
            ))}

          </div>
        )}
      </section>

      {/* ---------------- APPLICATIONS ---------------- */}
      {selectedJob && (
        <section style={styles.card}>

          <div style={styles.sectionHeader}>
            <div>
              <h2 style={styles.sectionTitle}>
                Applications
              </h2>

              <p style={styles.sectionSubtitle}>
                Applications for Job #{selectedJob}
              </p>
            </div>
          </div>

          {applications.length === 0 ? (
            <div style={styles.emptyState}>
              <p>No applications yet.</p>
            </div>
          ) : (
            <div>

              {applications.map((app) => (
                <div
                  key={app.id}
                  style={styles.applicationCard}
                >

                  <div>
                    <h3 style={styles.applicantName}>
                      {app.applicant?.name || 'Applicant'}
                    </h3>

                    <p style={styles.email}>
                      {app.applicant?.email || 'No email available'}
                    </p>
                  </div>

                  <div style={styles.applicationRight}>

                    <span style={styles.applicationStatus}>
                      {app.status || 'pending'}
                    </span>

                    <div style={styles.applicationActions}>

                      <button
                        onClick={() =>
                          handleStatusUpdate(
                            app.id,
                            'shortlisted'
                          )
                        }
                        style={styles.secondaryButton}
                      >
                        Shortlist
                      </button>

                      <button
                        onClick={() =>
                          handleStatusUpdate(
                            app.id,
                            'rejected'
                          )
                        }
                        style={styles.deleteButton}
                      >
                        Reject
                      </button>

                    </div>

                  </div>

                </div>
              ))}

            </div>
          )}

        </section>
      )}

    </div>
  );
};

/* =========================================
   STYLES
========================================= */

const styles = {
  page: {
    minHeight: '100vh',
    background: '#f6f8fb',
    padding: '40px 24px 80px',
    color: '#172033',
  },

  header: {
    maxWidth: '1100px',
    margin: '0 auto 32px',
  },

  eyebrow: {
    fontSize: '12px',
    fontWeight: '700',
    letterSpacing: '1.5px',
    color: '#2563eb',
    margin: '0 0 8px',
  },

  heading: {
    margin: 0,
    fontSize: '32px',
    fontWeight: '600',
    letterSpacing: '-0.6px',
  },

  subtitle: {
    margin: '8px 0 0',
    color: '#687386',
    fontSize: '15px',
  },

  card: {
    maxWidth: '1100px',
    margin: '0 auto 32px',
    background: '#ffffff',
    border: '1px solid #e2e7ef',
    borderRadius: '14px',
    padding: '28px',
    boxShadow: '0 4px 18px rgba(20,40,80,0.04)',
  },

  section: {
    maxWidth: '1100px',
    margin: '0 auto 32px',
  },

  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '22px',
  },

  sectionTitle: {
    margin: 0,
    fontSize: '21px',
    fontWeight: '600',
    color: '#172033',
  },

  sectionSubtitle: {
    margin: '5px 0 0',
    color: '#7a8495',
    fontSize: '14px',
  },

  formGroup: {
    marginBottom: '18px',
  },

  label: {
    display: 'block',
    marginBottom: '7px',
    fontSize: '13px',
    fontWeight: '600',
    color: '#303b4f',
  },

  input: {
    width: '100%',
    padding: '12px 13px',
    boxSizing: 'border-box',
    border: '1px solid #dce2ea',
    borderRadius: '8px',
    outline: 'none',
    background: '#ffffff',
    color: '#172033',
    fontSize: '14px',
    fontFamily: 'inherit',
  },

  helper: {
    display: 'block',
    marginTop: '5px',
    color: '#8a94a5',
    fontSize: '12px',
  },

  gridTwo: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '18px',
  },

  primaryButton: {
    padding: '11px 20px',
    background: '#2563eb',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
  },

  secondaryButton: {
    padding: '9px 14px',
    background: '#2563eb',
    color: '#ffffff',
    border: 'none',
    borderRadius: '7px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500',
  },

  deleteButton: {
    padding: '9px 14px',
    background: '#ffffff',
    color: '#dc2626',
    border: '1px solid #fecaca',
    borderRadius: '7px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500',
  },

  message: {
    background: '#eff6ff',
    border: '1px solid #dbeafe',
    color: '#1d4ed8',
    padding: '11px 13px',
    borderRadius: '7px',
    marginBottom: '18px',
    fontSize: '14px',
  },

  jobsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: '18px',
  },

  jobCard: {
    background: '#ffffff',
    border: '1px solid #e2e7ef',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 3px 14px rgba(20,40,80,0.03)',
  },

  jobTop: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '15px',
    alignItems: 'flex-start',
  },

  jobTitle: {
    margin: 0,
    fontSize: '18px',
    fontWeight: '600',
    color: '#172033',
  },

  jobMeta: {
    margin: '6px 0 0',
    color: '#737e90',
    fontSize: '13px',
  },

  status: {
    padding: '5px 9px',
    background: '#eff6ff',
    color: '#2563eb',
    borderRadius: '20px',
    fontSize: '11px',
    fontWeight: '600',
    textTransform: 'capitalize',
  },

  jobDescription: {
    margin: '16px 0',
    color: '#596477',
    fontSize: '14px',
    lineHeight: '1.6',
  },

  skills: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '7px',
    marginBottom: '12px',
  },

  skill: {
    background: '#f1f5f9',
    color: '#475569',
    padding: '5px 9px',
    borderRadius: '6px',
    fontSize: '12px',
  },

  salary: {
    margin: '10px 0',
    color: '#344054',
    fontSize: '13px',
    fontWeight: '500',
  },

  actions: {
    display: 'flex',
    gap: '9px',
    marginTop: '18px',
  },

  emptyState: {
    background: '#ffffff',
    border: '1px solid #e2e7ef',
    borderRadius: '12px',
    padding: '30px',
    textAlign: 'center',
    color: '#7a8495',
  },

  applicationCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '20px',
    padding: '18px 0',
    borderBottom: '1px solid #edf0f4',
  },

  applicantName: {
    margin: 0,
    fontSize: '15px',
    fontWeight: '600',
  },

  email: {
    margin: '5px 0 0',
    color: '#7a8495',
    fontSize: '13px',
  },

  applicationRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
  },

  applicationStatus: {
    fontSize: '12px',
    color: '#596477',
    textTransform: 'capitalize',
  },

  applicationActions: {
    display: 'flex',
    gap: '8px',
  },
};

export default EmployerDashboard;