import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../api/axios';
import { useAuth } from '../context/AuthContext';

const options = [
  { role: 'applicant', title: "I'm looking for a job", subtitle: 'Browse roles and see how well your resume fits each one.' },
  { role: 'employer', title: "I'm hiring", subtitle: 'Post jobs and review applicants ranked by AI fit score.' }
];

const ChooseRole = () => {
  const { user, login, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Not signed in -> back to login. Already has a role -> straight to the
  // dashboard, so this screen can't be revisited to change it.
  useEffect(() => {
    if (authLoading) return;
    if (!user) navigate('/login');
    else if (user.role === 'employer') navigate('/employer');
    else if (user.role === 'applicant') navigate('/applicant');
  }, [user, authLoading, navigate]);

  const choose = async (role_name) => {
    setSaving(true);
    setError('');
    try {
      const res = await API.patch('/auth/role', { role_name });
      // Replaces the stored token with the fresh one that carries the role.
      login(res.data.user, res.data.token);
      navigate(role_name === 'employer' ? '/employer' : '/applicant');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save your choice');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: '440px', margin: '60px auto', padding: '30px', border: '1px solid #ddd', borderRadius: '8px' }}>
      <h2 style={{ marginBottom: '8px', textAlign: 'center' }}>One last step</h2>
      <p style={{ marginBottom: '22px', textAlign: 'center', color: '#666', fontSize: '14px' }}>
        How will you use SkillMatch? This can't be changed later.
      </p>

      {error && <p style={{ color: 'red', marginBottom: '15px' }}>{error}</p>}

      {options.map((option) => (
        <button
          key={option.role}
          onClick={() => choose(option.role)}
          disabled={saving}
          style={{ display: 'block', width: '100%', marginBottom: '12px', padding: '16px', textAlign: 'left', background: '#fff', border: '1px solid #ddd', borderRadius: '8px', cursor: saving ? 'not-allowed' : 'pointer' }}
        >
          <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>{option.title}</div>
          <div style={{ fontSize: '13px', color: '#666' }}>{option.subtitle}</div>
        </button>
      ))}
    </div>
  );
};

export default ChooseRole;