import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@apollo/client/react';
import { LOGIN, REGISTER } from '../graphql/mutations';
import { useAuthStore } from '../store/authStore';
import {
  ArrowRight,
  ShieldCheck,
  TrendingUp,
  Lock,
  Mail,
  User,
  Building,
  AlertCircle,
} from 'lucide-react';

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

  const isSubmitting = loginLoading || registerLoading;

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1.25rem',
        backgroundColor: 'var(--bg-app)',
      }}
    >
      <div style={{ width: '100%', maxWidth: '440px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Brand Header */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div
            className="brand-icon"
            style={{
              width: '48px',
              height: '48px',
              borderRadius: 'var(--radius)',
              fontSize: '1.6rem',
              boxShadow: 'var(--shadow-sm)',
              marginBottom: '0.85rem',
            }}
          >
            V
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.35rem' }}>
            Vault
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', maxWidth: '340px', lineHeight: 1.45 }}>
            Enterprise multi-entity financial intelligence, proactive budget caps & real-time ledgers
          </p>
        </div>

        {/* Auth Card */}
        <div className="card" style={{ padding: '2rem' }}>
          {/* Segmented Tab Switcher */}
          <div
            style={{
              display: 'flex',
              background: 'var(--bg-surface)',
              padding: '0.3rem',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border-color)',
              marginBottom: '1.5rem',
              gap: '0.25rem',
            }}
          >
            <button
              type="button"
              style={{
                flex: 1,
                padding: '0.55rem',
                background: !isRegister ? 'var(--primary)' : 'transparent',
                border: 'none',
                color: !isRegister ? 'var(--primary-foreground)' : 'var(--text-muted)',
                fontWeight: 600,
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                fontSize: '0.85rem',
                transition: 'all 0.15s ease',
                boxShadow: !isRegister ? 'var(--shadow-xs)' : 'none',
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
                padding: '0.55rem',
                background: isRegister ? 'var(--primary)' : 'transparent',
                border: 'none',
                color: isRegister ? 'var(--primary-foreground)' : 'var(--text-muted)',
                fontWeight: 600,
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                fontSize: '0.85rem',
                transition: 'all 0.15s ease',
                boxShadow: isRegister ? 'var(--shadow-xs)' : 'none',
              }}
              onClick={() => {
                setIsRegister(true);
                setErrorMsg('');
              }}
            >
              Create Account
            </button>
          </div>

          {/* Error Banner */}
          {errorMsg && (
            <div
              style={{
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--danger-bg)',
                border: '1px solid var(--danger-border)',
                color: 'var(--danger)',
                fontSize: '0.825rem',
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {isRegister && (
              <>
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <div className="input-with-icon">
                    <span className="input-icon"><User size={15} /></span>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g. John Doe"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Organization Name</label>
                  <div className="input-with-icon">
                    <span className="input-icon"><Building size={15} /></span>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g. Acme Holdings Inc."
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </>
            )}

            <div className="form-group">
              <label className="form-label">Email Address</label>
              <div className="input-with-icon">
                <span className="input-icon"><Mail size={15} /></span>
                <input
                  type="email"
                  className="input"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <div className="input-with-icon">
                <span className="input-icon"><Lock size={15} /></span>
                <input
                  type="password"
                  className="input"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
              style={{
                width: '100%',
                padding: '0.65rem',
                fontSize: '0.875rem',
                marginTop: '0.35rem',
              }}
            >
              {isSubmitting ? (
                'Processing...'
              ) : isRegister ? (
                <>
                  Create Account <ArrowRight size={15} />
                </>
              ) : (
                <>
                  Sign In <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>

          {/* Security Banner */}
          <div
            style={{
              marginTop: '1.25rem',
              paddingTop: '1rem',
              borderTop: '1px solid var(--border-color)',
              textAlign: 'center',
              fontSize: '0.78rem',
              color: 'var(--text-subtle)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1.25rem' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <ShieldCheck size={13} style={{ color: 'var(--success)' }} /> 256-bit Encrypted
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <TrendingUp size={13} style={{ color: 'var(--primary)' }} /> Real-Time Ledgers
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
