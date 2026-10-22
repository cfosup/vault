import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMutation } from '@apollo/client/react';
import { LOGIN, REGISTER, FIREBASE_OAUTH } from '../graphql/mutations';
import { signInWithGoogle } from '../config/firebase';
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
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const isExpired = searchParams.get('expired') === 'true';
  const loginStore = useAuthStore((state) => state.login);

  const [loginMutation, { loading: loginLoading }] = useMutation(LOGIN);
  const [registerMutation, { loading: registerLoading }] = useMutation(REGISTER);
  const [firebaseOAuthMutation, { loading: oauthLoading }] = useMutation(FIREBASE_OAUTH);

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

  const handleGoogleSignIn = async () => {
    setErrorMsg('');
    try {
      const fbData = await signInWithGoogle();
      const res = await firebaseOAuthMutation({
        variables: {
          input: {
            idToken: fbData.idToken,
            uid: fbData.uid,
            email: fbData.email,
            name: fbData.displayName,
            avatarUrl: fbData.photoURL,
            orgName: orgName || undefined,
          },
        },
      });
      const { token, user, org } = res.data.firebaseOAuth;
      loginStore(token, user, org);
      navigate('/');
    } catch (err) {
      console.error('Firebase OAuth Error:', err);
      if (err.code === 'auth/popup-closed-by-user') {
        setErrorMsg('Google sign-in popup was cancelled.');
      } else if (err.code === 'auth/configuration-not-found' || err.message?.includes('configuration-not-found')) {
        setErrorMsg(
          'Google Provider is not enabled in Firebase Console (vault-cbf53). Go to Firebase Console → Authentication → Sign-in method → Enable "Google" and save.'
        );
      } else if (err.code === 'auth/unauthorized-domain' || err.message?.includes('unauthorized-domain')) {
        setErrorMsg(
          'Domain not authorized. Go to Firebase Console → Authentication → Settings → Authorized domains and add your domain.'
        );
      } else {
        setErrorMsg(err.message || 'Google OAuth authentication failed');
      }
    }
  };

  const isSubmitting = loginLoading || registerLoading || oauthLoading;

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

          {/* Google OAuth Button */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isSubmitting}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.75rem',
              padding: '0.65rem 1rem',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-main)',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease',
              marginBottom: '1.25rem',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-surface-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bg-surface)')}
          >
            {oauthLoading ? (
              <span>Authenticating with Google...</span>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>{isRegister ? 'Sign up with Google' : 'Continue with Google'}</span>
              </>
            )}
          </button>

          {/* Divider */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              margin: '0 0 1.25rem 0',
              color: 'var(--text-subtle)',
              fontSize: '0.75rem',
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }} />
            <span style={{ padding: '0 0.75rem' }}>or continue with email</span>
            <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }} />
          </div>

          {/* Session Expired Banner */}
          {isExpired && !errorMsg && (
            <div
              style={{
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--warning-bg)',
                border: '1px solid var(--warning-border)',
                color: 'var(--warning)',
                fontSize: '0.825rem',
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>Your session has expired. Please sign in again to continue.</span>
            </div>
          )}

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
