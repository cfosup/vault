import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMutation, useQuery } from '@apollo/client/react';
import { ACCEPT_INVITE } from '../graphql/mutations';
import { GET_INVITE_PREVIEW } from '../graphql/queries';
import { useAuthStore } from '../store/authStore';

export const JoinPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const token = new URLSearchParams(location.search).get('token') || '';
  const { data, error } = useQuery(GET_INVITE_PREVIEW, { variables: { token }, skip: !token });
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [acceptInvite, { loading }] = useMutation(ACCEPT_INVITE);

  const preview = data?.invitePreview;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage('');
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
          <input className="input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required placeholder="At least 8 characters" />
        </label>
        {message && <p className="form-error">{message}</p>}
        <button className="btn btn-primary" disabled={loading || !token} type="submit">
          {loading ? 'Joining...' : 'Create my login'}
        </button>
      </form>
    </div>
  );
};
