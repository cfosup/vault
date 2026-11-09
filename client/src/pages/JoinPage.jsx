import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMutation, useQuery } from '@apollo/client/react';
import { ACCEPT_INVITE } from '../graphql/mutations';
import { GET_INVITE_PREVIEW } from '../graphql/queries';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { passwordProblem } from '../utils/password';

export const JoinPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const token = new URLSearchParams(location.search).get('token') || '';
  const { data, error } = useQuery(GET_INVITE_PREVIEW, { variables: { token }, skip: !token });
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showRepeat, setShowRepeat] = useState(false);
  const [message, setMessage] = useState('');
  const [acceptInvite, { loading }] = useMutation(ACCEPT_INVITE);

  const preview = data?.invitePreview;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage('');
    const problem = passwordProblem(password);
    if (problem) {
      setMessage(problem);
      return;
    }
    if (password !== repeatPassword) {
      setMessage('Passwords do not match.');
      return;
    }
    try {
      const res = await acceptInvite({ variables: { input: { token, name, password } } });
      const payload = res.data.acceptInvite;
      login(payload.token, payload.user, payload.org);
      navigate('/');
    } catch (err) {
      setMessage(err.message || 'This invite could not be accepted.');
    }
  };

  return (
    <div className="auth-screen">
      <form className="card auth-card" onSubmit={handleSubmit}>
        <div className="brand-icon" style={{ width: 44, height: 44, fontSize: '1.35rem' }}>V</div>
        <h1>Join {preview?.orgName || 'Vault'}</h1>
        <p>Create your login for this organization. You will see only what you were invited to.</p>
        {!token && <p className="field-hint">This invite link is missing its token. Ask for a new invite.</p>}
        {error && <p className="form-error">{error.message}</p>}
        {preview && (
          <p className="field-hint">
            {preview.email} · {preview.accessSummary}. Expires {new Date(preview.expiresAt).toLocaleDateString()}.
          </p>
        )}
        <label className="form-group">
          <span className="form-label">Your name</span>
          <input className="input" value={name} onChange={(event) => setName(event.target.value)} required />
        </label>
        <label className="form-group">
          <span className="form-label">Password</span>
          <div className="input-with-icon">
            <span className="input-icon"><Lock size={15} /></span>
            <input className="input" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} required placeholder="At least 8 characters, a number, and a special character" style={{ paddingRight: '2.5rem' }} />
            <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'} style={{ position: 'absolute', right: '0.65rem', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}>
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </label>
        <label className="form-group">
          <span className="form-label">Repeat password</span>
          <div className="input-with-icon">
            <span className="input-icon"><Lock size={15} /></span>
            <input className="input" type={showRepeat ? 'text' : 'password'} value={repeatPassword} onChange={(event) => setRepeatPassword(event.target.value)} required placeholder="Repeat password" style={{ paddingRight: '2.5rem' }} />
            <button type="button" onClick={() => setShowRepeat((value) => !value)} aria-label={showRepeat ? 'Hide password' : 'Show password'} style={{ position: 'absolute', right: '0.65rem', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}>
              {showRepeat ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </label>
        {message && <p className="form-error">{message}</p>}
        <button className="btn btn-primary" disabled={loading || !token} type="submit">
          {loading ? 'Joining...' : 'Create my login'}
        </button>
      </form>
    </div>
  );
};
