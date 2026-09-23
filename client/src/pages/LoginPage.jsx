import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@apollo/client/react';
import { LOGIN, REGISTER } from '../graphql/mutations';
import { useAuthStore } from '../store/authStore';
import { ArrowRight, ShieldCheck, TrendingUp, Sparkles } from 'lucide-react';

export const LoginPage = () => {
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const navigate = useNavigate();
  const loginStore = useAuthStore((state) => state.login);

  const [loginMutation, { loading: loginLoading }] = useMutation(LOGIN);
  const [registerMutation, { loading: registerLoading }] = useMutation(REGISTER);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    try {
      if (isRegister) {
        if (!name || !orgName || !email || !password) {
          setErrorMsg('Please fill in all fields.');
          return;
        }
        const res = await registerMutation({
          variables: {
            input: { name, orgName, email, password },
          },
        });
        const { token, user, org } = res.data.register;
        loginStore(token, user, org);
        navigate('/');
      } else {
        if (!email || !password) {
          setErrorMsg('Email and password are required.');
          return;
        }
        const res = await loginMutation({
          variables: { email, password },
        });
        const { token, user, org } = res.data.login;
        loginStore(token, user, org);
        navigate('/');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Authentication failed');
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        background: 'radial-gradient(circle at 50% 20%, rgba(124, 58, 237, 0.12), transparent 60%), var(--bg-app)',
      }}
    >
      <div style={{ width: '100%', maxWidth: '440px' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div
            style={{
              width: '54px',
              height: '54px',
              borderRadius: 'var(--radius)',
              background: 'linear-gradient(135deg, var(--primary), #ec4899)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontWeight: 800,
              fontSize: '1.75rem',
              boxShadow: '0 8px 24px var(--primary-glow)',
              marginBottom: '1rem',
            }}
          >
            ₹
          </div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.4rem' }}>ExpenseFlow SaaS</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Multi-tenant company financial tracking, budget limits & AI insights
          </p>
        </div>

        <div className="card">
          <div
            style={{
              display: 'flex',
              borderBottom: '1px solid var(--border-color)',
              marginBottom: '1.5rem',
            }}
          >
            <button
              type="button"
              style={{
                flex: 1,
                padding: '0.75rem',
                background: 'none',
                border: 'none',
                borderBottom: !isRegister ? '2px solid var(--primary)' : '2px solid transparent',
                color: !isRegister ? 'var(--primary)' : 'var(--text-muted)',
                fontWeight: !isRegister ? 600 : 500,
                cursor: 'pointer',
                fontSize: '0.9rem',
              }}
              onClick={() => {
                setIsRegister(false);
                setErrorMsg('');
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              style={{
                flex: 1,
                padding: '0.75rem',
                background: 'none',
                border: 'none',
                borderBottom: isRegister ? '2px solid var(--primary)' : '2px solid transparent',
                color: isRegister ? 'var(--primary)' : 'var(--text-muted)',
                fontWeight: isRegister ? 600 : 500,
                cursor: 'pointer',
                fontSize: '0.9rem',
              }}
              onClick={() => {
                setIsRegister(true);
                setErrorMsg('');
              }}
            >
              Create Account
            </button>
          </div>

          {errorMsg && (
            <div
              style={{
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--danger-bg)',
                color: 'var(--danger)',
                fontSize: '0.85rem',
                marginBottom: '1.25rem',
              }}
            >
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {isRegister && (
              <>
                <div className="form-group">
                  <label className="form-label">Your Name</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. Ajay Sharma"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Organization / Company Group Name</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. Bright Digital Corp"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    required
                  />
                </div>
              </>
            )}

            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                type="email"
                className="input"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label className="form-label">Password</label>
              <input
                type="password"
                className="input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', padding: '0.75rem' }}
              disabled={loginLoading || registerLoading}
            >
              {loginLoading || registerLoading
                ? 'Processing...'
                : isRegister
                ? 'Register & Launch Workspace'
                : 'Sign In to ExpenseFlow'}
              <ArrowRight size={16} />
            </button>
          </form>

          <div
            style={{
              marginTop: '1.5rem',
              paddingTop: '1rem',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '1.5rem',
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <ShieldCheck size={14} /> End-to-end multi-tenant
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <Sparkles size={14} /> Groq AI Enabled
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
