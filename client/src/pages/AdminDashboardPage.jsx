import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import {
  Shield,
  Users,
  Building2,
  TrendingUp,
  Receipt,
  Activity,
  Search,
  RefreshCw,
  Eye,
  CheckCircle2,
  AlertCircle,
  Clock,
  Mail,
  UserCheck,
  Calendar,
  X,
  MessageSquare,
  Lock,
  LogOut,
  Terminal,
  Server,
  Zap,
  Layers,
  ArrowRight,
  ShieldAlert,
  SlidersHorizontal,
} from 'lucide-react';
import { GET_ADMIN_DASHBOARD, GET_ADMIN_ACTIVITIES, GET_ADMIN_API_METRICS, GET_ADMIN_CHATBOT_USAGE, GET_ADMIN_USER_DETAIL } from '../graphql/queries';
import { ADMIN_LOGIN, UPDATE_USER_ROLE } from '../graphql/mutations';
import { formatDisplayDate } from '../utils/dateUtils';

export const AdminDashboardPage = () => {
  // Check if Super Admin is currently logged in via dedicated admin token
  const [adminToken, setAdminToken] = useState(() => localStorage.getItem('vault_admin_token') || '');
  const [adminUser, setAdminUser] = useState(() => {
    try {
      const stored = localStorage.getItem('vault_admin_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  // Admin Login Form State
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Dashboard Active Tab & Filters
  const [activeTab, setActiveTab] = useState('users'); // 'users' | 'apimonitor' | 'chatbot' | 'activity'
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [activityFilter, setActivityFilter] = useState('all');
  const [selectedUser, setSelectedUser] = useState(null);
  const [actionNotice, setActionNotice] = useState('');

  // Admin Login Mutation
  const [adminLoginMutation, { loading: loggingIn }] = useMutation(ADMIN_LOGIN, {
    onCompleted: (res) => {
      const { token, admin } = res.adminLogin;
      localStorage.setItem('vault_admin_token', token);
      localStorage.setItem('vault_admin_user', JSON.stringify(admin));
      setAdminToken(token);
      setAdminUser(admin);
      setLoginError('');
    },
    onError: (err) => {
      setLoginError(err.message || 'Invalid Super Admin credentials.');
    },
  });

  // Admin Dashboard Query (Skip if not authenticated)
  const { data, loading, error, refetch } = useQuery(GET_ADMIN_DASHBOARD, {
    variables: { search: search || '', role: roleFilter === 'all' ? '' : roleFilter },
    skip: !adminToken,
    fetchPolicy: 'network-only',
    notifyOnNetworkStatusChange: true,
  });

  // Role update mutation
  const [updateUserRole, { loading: updatingRole }] = useMutation(UPDATE_USER_ROLE, {
    onCompleted: (res) => {
      setActionNotice(`User role updated to "${res.updateUserRole.role}" successfully.`);
      refetch();
      setTimeout(() => setActionNotice(''), 4000);
    },
    onError: (err) => {
      setActionNotice(`Failed to update role: ${err.message}`);
      setTimeout(() => setActionNotice(''), 5000);
    },
  });

  const payload = data?.adminDashboard;
  const stats = payload?.stats;
  const users = payload?.users || [];
  const { data: metricsData } = useQuery(GET_ADMIN_API_METRICS, {
    skip: !adminToken || activeTab !== 'apimonitor',
    fetchPolicy: 'network-only',
  });
  const { data: chatbotData } = useQuery(GET_ADMIN_CHATBOT_USAGE, {
    skip: !adminToken || activeTab !== 'chatbot',
    fetchPolicy: 'network-only',
  });
  const { data: activityData } = useQuery(GET_ADMIN_ACTIVITIES, {
    variables: { limit: 40 },
    skip: !adminToken || activeTab !== 'activity',
    fetchPolicy: 'network-only',
  });
  const { data: userDetailData } = useQuery(GET_ADMIN_USER_DETAIL, {
    variables: { userId: selectedUser?.id },
    skip: !adminToken || !selectedUser?.id,
    fetchPolicy: 'network-only',
  });

  const activities = activityData?.adminActivityLogs || payload?.recentActivities || [];
  const apiMetrics = metricsData?.adminApiMetrics || payload?.apiMetrics;
  const chatbotUsage = chatbotData?.adminChatbotUsage || payload?.chatbotUsage || [];
  const viewedUser = userDetailData?.adminUserDetail || selectedUser;

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    try {
      await adminLoginMutation({
        variables: { email: loginEmail.trim(), password: loginPassword },
      });
    } catch (err) {
      // Handled in onError
    }
  };

  const handleAdminLogout = () => {
    localStorage.removeItem('vault_admin_token');
    localStorage.removeItem('vault_admin_user');
    setAdminToken('');
    setAdminUser(null);
  };

  const handleRoleChange = async (userId, newRole) => {
    await updateUserRole({ variables: { userId, role: newRole } });
    if (selectedUser && selectedUser.id === userId) {
      setSelectedUser((prev) => (prev ? { ...prev, role: newRole } : null));
    }
  };

  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return 'Never';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return 'Recently';
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return formatDisplayDate(dateStr);
    } catch {
      return 'Recently';
    }
  };

  const filteredActivities = useMemo(() => {
    if (activityFilter === 'all') return activities;
    if (activityFilter === 'auth') {
      return activities.filter((a) => ['USER_LOGIN', 'USER_REGISTER'].includes(a.action));
    }
    if (activityFilter === 'finance') {
      return activities.filter((a) =>
        ['CREATE_EXPENSE', 'DELETE_EXPENSE', 'CREATE_INCOME', 'DELETE_INCOME'].includes(a.action)
      );
    }
    if (activityFilter === 'companies') {
      return activities.filter((a) => ['CREATE_COMPANY', 'UPDATE_COMPANY'].includes(a.action));
    }
    if (activityFilter === 'chat') {
      return activities.filter((a) => a.action === 'AI_CHAT_MESSAGE');
    }
    return activities;
  }, [activities, activityFilter]);

  // -------------------------------------------------------------
  // 1. SEPARATE SUPER ADMIN LOGIN SCREEN
  // -------------------------------------------------------------
  if (!adminToken) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-app)',
          padding: '1.5rem',
        }}
      >
        <div
          className="card"
          style={{
            width: '100%',
            maxWidth: '430px',
            padding: '2.5rem 2rem',
            boxShadow: 'var(--shadow-xl)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-lg, 12px)',
          }}
        >
          {/* Admin Header */}
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div
              style={{
                width: '54px',
                height: '54px',
                margin: '0 auto 1rem',
                borderRadius: '12px',
                background: 'var(--primary)',
                color: 'var(--primary-foreground)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 'var(--shadow-md)',
              }}
            >
              <Shield size={28} />
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '0 0 0.35rem' }}>
              Super Admin Portal
            </h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
              Authorized Platform Administrator Authentication
            </p>
          </div>

          {/* Error Banner */}
          {loginError && (
            <div
              style={{
                marginBottom: '1.25rem',
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--danger-bg, rgba(220, 38, 38, 0.1))',
                border: '1px solid var(--danger, #dc2626)',
                color: 'var(--danger, #dc2626)',
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <AlertCircle size={15} style={{ flexShrink: 0 }} />
              <span>{loginError}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleAdminLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Admin Email
              </label>
              <div style={{ position: 'relative' }}>
                <Mail
                  size={15}
                  style={{
                    position: 'absolute',
                    left: '0.85rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)',
                  }}
                />
                <input
                  type="email"
                  className="input-field"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="ajay@gmail.com"
                  required
                  style={{ paddingLeft: '2.5rem', width: '100%', height: '40px', fontSize: '0.9rem' }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Admin Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock
                  size={15}
                  style={{
                    position: 'absolute',
                    left: '0.85rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)',
                  }}
                />
                <input
                  type="password"
                  className="input-field"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{ paddingLeft: '2.5rem', width: '100%', height: '40px', fontSize: '0.9rem' }}
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loggingIn}
              style={{
                marginTop: '0.5rem',
                height: '42px',
                fontSize: '0.92rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
              }}
            >
              {loggingIn ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <Shield size={16} />
                  <span>Authenticate as Super Admin</span>
                </>
              )}
            </button>
          </form>

          <div
            style={{
              marginTop: '1.75rem',
              paddingTop: '1.25rem',
              borderTop: '1px solid var(--border-color)',
              textAlign: 'center',
              fontSize: '0.74rem',
              color: 'var(--text-muted)',
            }}
          >
            🔒 Confidential System Console — Customer Data & Privacy Guard Enforced
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // 2. AUTHENTICATED SUPER ADMIN MONITORING DASHBOARD
  // -------------------------------------------------------------
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-app)', display: 'flex', flexDirection: 'column' }}>
      {/* Top Super Admin Navigation Header */}
      <header
        style={{
          borderBottom: '1px solid var(--border-color)',
          background: 'var(--bg-card)',
          position: 'sticky',
          top: 0,
          zIndex: 40,
        }}
      >
        <div
          style={{
            maxWidth: '1360px',
            margin: '0 auto',
            padding: '0.85rem 1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          {/* Brand & Identity */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: 'var(--primary)',
                color: 'var(--primary-foreground)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
              }}
            >
              <Shield size={18} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontWeight: 800, fontSize: '1.05rem', letterSpacing: '-0.02em' }}>
                  Vault Super Admin
                </span>
                <span
                  style={{
                    fontSize: '0.65rem',
                    padding: '0.1rem 0.45rem',
                    borderRadius: '4px',
                    background: 'var(--primary)',
                    color: 'var(--primary-foreground)',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                  }}
                >
                  Master Console
                </span>
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                Administrator: <strong>Ajay</strong> (ajay@gmail.com) • Privacy-Preserving Observability
              </div>
            </div>
          </div>

          {/* Quick Actions & Exit */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.74rem',
                color: 'var(--success, #16a34a)',
                background: 'var(--success-bg, rgba(22, 163, 74, 0.1))',
                padding: '0.3rem 0.65rem',
                borderRadius: '16px',
                fontWeight: 600,
              }}
            >
              <div
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: 'var(--success, #16a34a)',
                }}
              />
              <span>Live Engine Connected</span>
            </div>

            <button
              className="btn btn-secondary btn-sm"
              onClick={() => refetch()}
              disabled={loading}
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem' }}
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>

            <button
              className="btn btn-outline btn-sm"
              onClick={handleAdminLogout}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                color: 'var(--danger, #dc2626)',
                borderColor: 'rgba(220, 38, 38, 0.3)',
                fontSize: '0.78rem',
              }}
            >
              <LogOut size={13} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Body */}
      <main style={{ maxWidth: '1360px', width: '100%', margin: '0 auto', padding: '1.75rem 1.5rem', flex: 1 }}>
        {/* Action Notice Toast */}
        {actionNotice && (
          <div
            className="card"
            style={{
              marginBottom: '1.25rem',
              padding: '0.75rem 1.25rem',
              background: 'var(--success-bg, rgba(22, 163, 74, 0.1))',
              borderColor: 'var(--success, #16a34a)',
              color: 'var(--text-main)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              fontSize: '0.88rem',
              fontWeight: 600,
            }}
          >
            <CheckCircle2 size={16} style={{ color: 'var(--success, #16a34a)' }} />
            <span>{actionNotice}</span>
          </div>
        )}

        {/* Platform Overview Statistics Cards (Numbers & Counts Only - Privacy Safe) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
            gap: '1rem',
            marginBottom: '1.75rem',
          }}
        >
          {/* Registered Customers */}
          <div className="card stat-card" style={{ padding: '1.15rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="stat-label" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Registered Customers
              </span>
              <Users size={15} style={{ opacity: 0.7 }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', marginTop: '0.4rem' }}>
              <span style={{ fontSize: '1.65rem', fontWeight: 800 }}>
                {stats?.totalUsers ?? '—'}
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                ({stats?.activeUsersCount || 0} active 7d)
              </span>
            </div>
            <div style={{ marginTop: '0.35rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              {stats?.totalOrganizations ?? 1} Customer Workspace{stats?.totalOrganizations !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Companies Registered */}
          <div className="card stat-card" style={{ padding: '1.15rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="stat-label" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Company Entities
              </span>
              <Building2 size={15} style={{ opacity: 0.7 }} />
            </div>
            <div style={{ marginTop: '0.4rem' }}>
              <span style={{ fontSize: '1.65rem', fontWeight: 800 }}>
                {stats?.totalCompanies ?? '—'}
              </span>
            </div>
            <div style={{ marginTop: '0.35rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Operating entities & branches
            </div>
          </div>

          {/* Incomes Registered (Count Only) */}
          <div className="card stat-card" style={{ padding: '1.15rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="stat-label" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Incomes Registered
              </span>
              <TrendingUp size={15} style={{ color: 'var(--success, #16a34a)' }} />
            </div>
            <div style={{ marginTop: '0.4rem' }}>
              <span style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--success, #16a34a)' }}>
                {stats?.totalIncomeCount ?? '—'}
              </span>
            </div>
            <div style={{ marginTop: '0.35rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Total revenue entries (Count)
            </div>
          </div>

          {/* Expenses Registered (Count Only) */}
          <div className="card stat-card" style={{ padding: '1.15rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="stat-label" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Expenses Registered
              </span>
              <Receipt size={15} style={{ color: '#2563eb' }} />
            </div>
            <div style={{ marginTop: '0.4rem' }}>
              <span style={{ fontSize: '1.65rem', fontWeight: 800, color: '#2563eb' }}>
                {stats?.totalExpenseCount ?? '—'}
              </span>
            </div>
            <div style={{ marginTop: '0.35rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Total spend vouchers (Count)
            </div>
          </div>

          {/* AI Chatbot Messages Used */}
          <div className="card stat-card" style={{ padding: '1.15rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="stat-label" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Chatbot Messages
              </span>
              <MessageSquare size={15} style={{ color: '#d97706' }} />
            </div>
            <div style={{ marginTop: '0.4rem' }}>
              <span style={{ fontSize: '1.65rem', fontWeight: 800, color: '#d97706' }}>
                {stats?.totalChatMessages ?? '—'}
              </span>
            </div>
            <div style={{ marginTop: '0.35rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Customer AI CFO queries
            </div>
          </div>

          {/* API Health / Success Rate */}
          <div className="card stat-card" style={{ padding: '1.15rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="stat-label" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                API Success Rate
              </span>
              <Server size={15} style={{ opacity: 0.7 }} />
            </div>
            <div style={{ marginTop: '0.4rem' }}>
              <span style={{ fontSize: '1.65rem', fontWeight: 800 }}>
                {apiMetrics?.overallSuccessRate ?? 100}%
              </span>
            </div>
            <div style={{ marginTop: '0.35rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              {apiMetrics?.totalCalls || 0} calls ({apiMetrics?.totalErrors || 0} errs)
            </div>
          </div>
        </div>

        {/* Tab Controls Bar */}
        <div
          className="card"
          style={{
            padding: '0.75rem 1.25rem',
            marginBottom: '1.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          {/* Tabs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              className={`btn btn-sm ${activeTab === 'users' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setActiveTab('users')}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <Users size={14} />
              <span>Customer Ledger & Counts</span>
              <span
                style={{
                  padding: '0.1rem 0.4rem',
                  borderRadius: '10px',
                  fontSize: '0.7rem',
                  background: activeTab === 'users' ? 'var(--primary-foreground)' : 'var(--bg-surface)',
                  color: activeTab === 'users' ? 'var(--primary)' : 'var(--text-muted)',
                  fontWeight: 700,
                }}
              >
                {users.length}
              </span>
            </button>

            <button
              className={`btn btn-sm ${activeTab === 'apimonitor' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setActiveTab('apimonitor')}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <Server size={14} />
              <span>API Endpoints & Errors Monitor</span>
              <span
                style={{
                  padding: '0.1rem 0.4rem',
                  borderRadius: '10px',
                  fontSize: '0.7rem',
                  background: activeTab === 'apimonitor' ? 'var(--primary-foreground)' : 'var(--bg-surface)',
                  color: activeTab === 'apimonitor' ? 'var(--primary)' : 'var(--text-muted)',
                  fontWeight: 700,
                }}
              >
                {apiMetrics?.endpoints?.length || 0}
              </span>
            </button>

            <button
              className={`btn btn-sm ${activeTab === 'chatbot' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setActiveTab('chatbot')}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <MessageSquare size={14} />
              <span>AI Chatbot Usage</span>
              <span
                style={{
                  padding: '0.1rem 0.4rem',
                  borderRadius: '10px',
                  fontSize: '0.7rem',
                  background: activeTab === 'chatbot' ? 'var(--primary-foreground)' : 'var(--bg-surface)',
                  color: activeTab === 'chatbot' ? 'var(--primary)' : 'var(--text-muted)',
                  fontWeight: 700,
                }}
              >
                {chatbotUsage.length}
              </span>
            </button>

            <button
              className={`btn btn-sm ${activeTab === 'activity' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setActiveTab('activity')}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <Activity size={14} />
              <span>Interaction Audit</span>
              <span
                style={{
                  padding: '0.1rem 0.4rem',
                  borderRadius: '10px',
                  fontSize: '0.7rem',
                  background: activeTab === 'activity' ? 'var(--primary-foreground)' : 'var(--bg-surface)',
                  color: activeTab === 'activity' ? 'var(--primary)' : 'var(--text-muted)',
                  fontWeight: 700,
                }}
              >
                {activities.length}
              </span>
            </button>
          </div>

          {/* Search bar (for Users tab) */}
          {activeTab === 'users' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', minWidth: '220px' }}>
                <Search
                  size={14}
                  style={{
                    position: 'absolute',
                    left: '0.75rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)',
                  }}
                />
                <input
                  type="text"
                  className="input-field"
                  placeholder="Search customer, email or company..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ paddingLeft: '2.2rem', paddingRight: '0.75rem', height: '34px', fontSize: '0.82rem' }}
                />
              </div>

              <select
                className="input-field"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                style={{ height: '34px', fontSize: '0.82rem', padding: '0 0.75rem' }}
              >
                <option value="all">All Roles</option>
                <option value="owner">Owners</option>
                <option value="admin">Admins</option>
                <option value="member">Members</option>
              </select>
            </div>
          )}
        </div>

        {/* Error Handling */}
        {error && (
          <div className="card" style={{ padding: '2.5rem', textAlign: 'center', borderColor: 'var(--danger)', marginBottom: '1.5rem' }}>
            <AlertCircle size={32} style={{ margin: '0 auto 0.75rem', color: 'var(--danger)' }} />
            <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.35rem' }}>Failed to Load Admin Data</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>{error.message}</div>
            <button className="btn btn-secondary btn-sm" onClick={() => refetch()}>
              Retry Query
            </button>
          </div>
        )}

        {/* -------------------------------------------------------------
            TAB 1: CUSTOMER LEDGER & COUNTS (STRICT PRIVACY: NUMBERS ONLY)
           ------------------------------------------------------------- */}
        {activeTab === 'users' && (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '0.85rem 1.25rem', textAlign: 'left', fontSize: '0.74rem', textTransform: 'uppercase' }}>
                      Customer / Workspace
                    </th>
                    <th style={{ padding: '0.85rem 1rem', textAlign: 'left', fontSize: '0.74rem', textTransform: 'uppercase' }}>
                      Companies Registered
                    </th>
                    <th style={{ padding: '0.85rem 1rem', textAlign: 'center', fontSize: '0.74rem', textTransform: 'uppercase' }}>
                      Incomes Registered (Count)
                    </th>
                    <th style={{ padding: '0.85rem 1rem', textAlign: 'center', fontSize: '0.74rem', textTransform: 'uppercase' }}>
                      Expenses Registered (Count)
                    </th>
                    <th style={{ padding: '0.85rem 1rem', textAlign: 'center', fontSize: '0.74rem', textTransform: 'uppercase' }}>
                      Total Transactions
                    </th>
                    <th style={{ padding: '0.85rem 1rem', textAlign: 'center', fontSize: '0.74rem', textTransform: 'uppercase' }}>
                      Chatbot Chats Used
                    </th>
                    <th style={{ padding: '0.85rem 1rem', textAlign: 'left', fontSize: '0.74rem', textTransform: 'uppercase' }}>
                      Last Active
                    </th>
                    <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right', fontSize: '0.74rem', textTransform: 'uppercase' }}>
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: '3.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        <Users size={30} style={{ margin: '0 auto 0.75rem', opacity: 0.4 }} />
                        <div style={{ fontWeight: 600 }}>No customer accounts found matching criteria</div>
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => (
                      <tr
                        key={u.id}
                        style={{
                          borderBottom: '1px solid var(--border-color)',
                          transition: 'background 0.15s ease',
                        }}
                      >
                        {/* Customer Info */}
                        <td style={{ padding: '1rem 1.25rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div
                              style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '50%',
                                background: 'var(--primary)',
                                color: 'var(--primary-foreground)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 700,
                                fontSize: '0.82rem',
                                flexShrink: 0,
                              }}
                            >
                              {u.name
                                ? u.name
                                    .split(' ')
                                    .map((p) => p[0])
                                    .join('')
                                    .substring(0, 2)
                                    .toUpperCase()
                                : 'CU'}
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{u.name}</div>
                              <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>{u.email}</div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', marginTop: '0.15rem' }}>
                                Workspace: <strong>{u.orgName}</strong>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Companies Managed */}
                        <td style={{ padding: '1rem 1rem' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', maxWidth: '240px' }}>
                            {u.companies && u.companies.length > 0 ? (
                              u.companies.map((c) => (
                                <span
                                  key={c.id}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.3rem',
                                    padding: '0.15rem 0.5rem',
                                    borderRadius: '4px',
                                    fontSize: '0.72rem',
                                    background: 'var(--bg-surface)',
                                    border: '1px solid var(--border-color)',
                                  }}
                                >
                                  <Building2 size={10} style={{ opacity: 0.6 }} />
                                  <span>{c.name}</span>
                                </span>
                              ))
                            ) : (
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                None created
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Count of Incomes (Strictly numbers - privacy preserved) */}
                        <td style={{ padding: '1rem 1rem', textAlign: 'center' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              padding: '0.2rem 0.6rem',
                              borderRadius: '14px',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              background: 'var(--success-bg, rgba(22, 163, 74, 0.1))',
                              color: 'var(--success, #16a34a)',
                            }}
                          >
                            <TrendingUp size={11} />
                            <span>{u.incomeCount} Incomes</span>
                          </span>
                        </td>

                        {/* Count of Expenses (Strictly numbers - privacy preserved) */}
                        <td style={{ padding: '1rem 1rem', textAlign: 'center' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              padding: '0.2rem 0.6rem',
                              borderRadius: '14px',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              background: 'rgba(37, 99, 235, 0.1)',
                              color: '#2563eb',
                            }}
                          >
                            <Receipt size={11} />
                            <span>{u.expenseCount} Expenses</span>
                          </span>
                        </td>

                        {/* Total Transactions (Number) */}
                        <td style={{ padding: '1rem 1rem', textAlign: 'center' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 800 }}>
                            {u.totalTransactionsCount || u.incomeCount + u.expenseCount}
                          </span>
                          <span style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                            vouchers
                          </span>
                        </td>

                        {/* Chatbot Chats Used */}
                        <td style={{ padding: '1rem 1rem', textAlign: 'center' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              padding: '0.2rem 0.6rem',
                              borderRadius: '14px',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              background: 'rgba(217, 119, 6, 0.1)',
                              color: '#d97706',
                            }}
                          >
                            <MessageSquare size={11} />
                            <span>{u.chatInteractionsCount || 0} Chats</span>
                          </span>
                        </td>

                        {/* Last Active */}
                        <td style={{ padding: '1rem 1rem' }}>
                          <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                            {formatTimeAgo(u.lastActiveAt)}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            {u.interactionCount} actions logged
                          </div>
                        </td>

                        {/* Action */}
                        <td style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>
                          <button
                            className="btn btn-outline btn-sm"
                            onClick={() => setSelectedUser(u)}
                            style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
                          >
                            <Eye size={12} style={{ marginRight: '0.25rem' }} />
                            <span>Inspect</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* -------------------------------------------------------------
            TAB 2: API ENDPOINTS & ERROR MONITOR (EXPLICIT REQUIREMENT!)
           ------------------------------------------------------------- */}
        {activeTab === 'apimonitor' && (
          <div className="page">
            {/* Top API Health Summary */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '1rem',
              }}
            >
              <div className="card" style={{ padding: '1.25rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Total API Invocations
                </div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '0.35rem' }}>
                  {apiMetrics?.totalCalls ?? 0}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  Total requests processed across all endpoints
                </div>
              </div>

              <div className="card" style={{ padding: '1.25rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Endpoint Error Count
                </div>
                <div
                  style={{
                    fontSize: '1.8rem',
                    fontWeight: 800,
                    marginTop: '0.35rem',
                    color: (apiMetrics?.totalErrors || 0) > 0 ? 'var(--danger, #dc2626)' : 'var(--success, #16a34a)',
                  }}
                >
                  {apiMetrics?.totalErrors ?? 0}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  Total 4xx / 5xx error responses recorded
                </div>
              </div>

              <div className="card" style={{ padding: '1.25rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Platform Reliability
                </div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '0.35rem', color: 'var(--success, #16a34a)' }}>
                  {apiMetrics?.overallSuccessRate ?? 100}%
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  Overall uptime & execution success rate
                </div>
              </div>
            </div>

            {/* Endpoints Breakdown Table */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '0.98rem', fontWeight: 700, margin: 0 }}>
                    Monitored API Endpoints & Call Volumes
                  </h3>
                  <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', margin: '0.15rem 0 0' }}>
                    Real-time invocation volume, errors, and availability per endpoint operation
                  </p>
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  {apiMetrics?.endpoints?.length || 0} active operations tracked
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-color)' }}>
                      <th style={{ padding: '0.85rem 1.25rem', textAlign: 'left', fontSize: '0.74rem', textTransform: 'uppercase' }}>
                        Endpoint / Operation
                      </th>
                      <th style={{ padding: '0.85rem 1rem', textAlign: 'left', fontSize: '0.74rem', textTransform: 'uppercase' }}>
                        Method & Path
                      </th>
                      <th style={{ padding: '0.85rem 1rem', textAlign: 'center', fontSize: '0.74rem', textTransform: 'uppercase' }}>
                        Total Calls
                      </th>
                      <th style={{ padding: '0.85rem 1rem', textAlign: 'center', fontSize: '0.74rem', textTransform: 'uppercase' }}>
                        Errors
                      </th>
                      <th style={{ padding: '0.85rem 1rem', textAlign: 'center', fontSize: '0.74rem', textTransform: 'uppercase' }}>
                        Success Rate
                      </th>
                      <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right', fontSize: '0.74rem', textTransform: 'uppercase' }}>
                        Last Called
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {!apiMetrics?.endpoints || apiMetrics.endpoints.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ padding: '3.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                          <Server size={30} style={{ margin: '0 auto 0.75rem', opacity: 0.4 }} />
                          <div style={{ fontWeight: 600 }}>API metrics initialized — waiting for calls</div>
                        </td>
                      </tr>
                    ) : (
                      apiMetrics.endpoints.map((ep, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '0.9rem 1.25rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                              <Terminal size={14} style={{ opacity: 0.6 }} />
                              <strong style={{ fontSize: '0.85rem' }}>{ep.endpoint}</strong>
                            </div>
                          </td>

                          <td style={{ padding: '0.9rem 1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <span
                                style={{
                                  fontSize: '0.68rem',
                                  padding: '0.1rem 0.35rem',
                                  borderRadius: '3px',
                                  fontWeight: 700,
                                  background: ep.method === 'POST' ? 'rgba(37, 99, 235, 0.12)' : 'rgba(22, 163, 74, 0.12)',
                                  color: ep.method === 'POST' ? '#2563eb' : '#16a34a',
                                }}
                              >
                                {ep.method}
                              </span>
                              <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                                {ep.path}
                              </span>
                            </div>
                          </td>

                          <td style={{ padding: '0.9rem 1rem', textAlign: 'center', fontWeight: 800, fontSize: '0.9rem' }}>
                            {ep.calls}
                          </td>

                          <td style={{ padding: '0.9rem 1rem', textAlign: 'center' }}>
                            <span
                              style={{
                                fontSize: '0.76rem',
                                fontWeight: 700,
                                padding: '0.15rem 0.5rem',
                                borderRadius: '12px',
                                background: ep.errors > 0 ? 'rgba(220, 38, 38, 0.1)' : 'var(--bg-surface)',
                                color: ep.errors > 0 ? 'var(--danger, #dc2626)' : 'var(--text-muted)',
                              }}
                            >
                              {ep.errors}
                            </span>
                          </td>

                          <td style={{ padding: '0.9rem 1rem', textAlign: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem' }}>
                              <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>{ep.successRate}%</span>
                            </div>
                          </td>

                          <td style={{ padding: '0.9rem 1.25rem', textAlign: 'right', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                            {formatTimeAgo(ep.lastCalledAt)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Error Logs Panel */}
            <div className="card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <ShieldAlert size={16} style={{ color: 'var(--danger, #dc2626)' }} />
                <h3 style={{ fontSize: '0.98rem', fontWeight: 700, margin: 0 }}>
                  Recent Application & API Errors Log
                </h3>
              </div>

              {!apiMetrics?.recentErrors || apiMetrics.recentErrors.length === 0 ? (
                <div
                  style={{
                    padding: '2.5rem 1rem',
                    textAlign: 'center',
                    background: 'var(--bg-surface)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px dashed var(--border-color)',
                  }}
                >
                  <CheckCircle2 size={26} style={{ margin: '0 auto 0.5rem', color: 'var(--success, #16a34a)' }} />
                  <div style={{ fontSize: '0.88rem', fontWeight: 700 }}>Zero Active Errors Detected</div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                    All incoming requests are completing successfully without uncaught exceptions
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  {apiMetrics.recentErrors.map((err) => (
                    <div
                      key={err.id}
                      style={{
                        padding: '0.85rem 1rem',
                        borderRadius: 'var(--radius-sm)',
                        background: 'rgba(220, 38, 38, 0.05)',
                        border: '1px solid rgba(220, 38, 38, 0.2)',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.75rem',
                      }}
                    >
                      <AlertCircle size={15} style={{ color: 'var(--danger, #dc2626)', marginTop: '0.15rem' }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.84rem' }}>{err.endpoint}</span>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{formatTimeAgo(err.timestamp)}</span>
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--danger, #dc2626)', marginTop: '0.2rem', fontFamily: 'var(--font-mono)' }}>
                          Status {err.statusCode}: {err.errorMessage}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* -------------------------------------------------------------
            TAB 3: CUSTOMER CHATBOT USAGE (EXPLICIT REQUIREMENT!)
           ------------------------------------------------------------- */}
        {activeTab === 'chatbot' && (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '0.98rem', fontWeight: 700, margin: 0 }}>
                  Customer AI Chatbot Engagement Monitor
                </h3>
                <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', margin: '0.15rem 0 0' }}>
                  Observability of customer queries, conversations, and interaction volumes with the Groq LLaMA 3.3 Assistant
                </p>
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                {chatbotUsage.length} customers monitored
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '0.85rem 1.25rem', textAlign: 'left', fontSize: '0.74rem', textTransform: 'uppercase' }}>
                      Customer / Workspace
                    </th>
                    <th style={{ padding: '0.85rem 1rem', textAlign: 'center', fontSize: '0.74rem', textTransform: 'uppercase' }}>
                      Chat Sessions Created
                    </th>
                    <th style={{ padding: '0.85rem 1rem', textAlign: 'center', fontSize: '0.74rem', textTransform: 'uppercase' }}>
                      Total Messages Sent
                    </th>
                    <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right', fontSize: '0.74rem', textTransform: 'uppercase' }}>
                      Last Chat Interaction
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {chatbotUsage.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ padding: '3.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        <MessageSquare size={30} style={{ margin: '0 auto 0.75rem', opacity: 0.4 }} />
                        <div style={{ fontWeight: 600 }}>No customer chat history recorded yet</div>
                      </td>
                    </tr>
                  ) : (
                    chatbotUsage.map((cb) => (
                      <tr key={cb.userId} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '1rem 1.25rem' }}>
                          <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{cb.userName}</div>
                          <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>{cb.userEmail}</div>
                        </td>

                        <td style={{ padding: '1rem 1rem', textAlign: 'center' }}>
                          <span
                            style={{
                              padding: '0.2rem 0.6rem',
                              borderRadius: '12px',
                              background: 'var(--bg-surface)',
                              fontSize: '0.8rem',
                              fontWeight: 700,
                            }}
                          >
                            {cb.sessionCount} Sessions
                          </span>
                        </td>

                        <td style={{ padding: '1rem 1rem', textAlign: 'center' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              padding: '0.2rem 0.65rem',
                              borderRadius: '14px',
                              background: 'rgba(217, 119, 6, 0.1)',
                              color: '#d97706',
                              fontSize: '0.82rem',
                              fontWeight: 800,
                            }}
                          >
                            <MessageSquare size={12} />
                            <span>{cb.totalMessagesCount} Messages</span>
                          </span>
                        </td>

                        <td style={{ padding: '1rem 1.25rem', textAlign: 'right', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {cb.lastChatAt ? formatTimeAgo(cb.lastChatAt) : 'Never used'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* -------------------------------------------------------------
            TAB 4: INTERACTION AUDIT LEDGER
           ------------------------------------------------------------- */}
        {activeTab === 'activity' && (
          <div className="card" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <h3 style={{ fontSize: '0.98rem', fontWeight: 700, margin: 0 }}>
                  Audited Interaction & Action Stream
                </h3>
                <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', margin: '0.15rem 0 0' }}>
                  Chronological action logs across customer signups, logins, transaction creations, and AI calls
                </p>
              </div>

              <select
                className="input-field"
                value={activityFilter}
                onChange={(e) => setActivityFilter(e.target.value)}
                style={{ height: '32px', fontSize: '0.8rem', padding: '0 0.65rem' }}
              >
                <option value="all">All Actions ({activities.length})</option>
                <option value="auth">Logins & Registrations</option>
                <option value="finance">Income & Expenses</option>
                <option value="companies">Company Entities</option>
                <option value="chat">AI CFO Chat</option>
              </select>
            </div>

            {filteredActivities.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-muted)' }}>
                <Activity size={32} style={{ margin: '0 auto 0.75rem', opacity: 0.4 }} />
                <div style={{ fontWeight: 600 }}>No user interaction events match this filter</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {filteredActivities.map((act) => (
                  <div
                    key={act.id}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.85rem',
                      padding: '0.75rem 1rem',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-color)',
                    }}
                  >
                    <div
                      style={{
                        width: '30px',
                        height: '30px',
                        borderRadius: '6px',
                        background: 'var(--bg-card)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        border: '1px solid var(--border-color)',
                      }}
                    >
                      <Activity size={13} />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: '0.84rem', fontWeight: 700 }}>
                          {act.userName || 'Customer User'}
                          {act.userEmail && (
                            <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 400, marginLeft: '0.35rem' }}>
                              ({act.userEmail})
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {formatTimeAgo(act.createdAt)}
                        </div>
                      </div>

                      <div style={{ fontSize: '0.8rem', color: 'var(--text-main)', marginTop: '0.2rem' }}>
                        {act.description}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* -------------------------------------------------------------
          CUSTOMER INSPECT MODAL (NUMBERS & COUNTS ONLY - PRIVACY SAFE)
         ------------------------------------------------------------- */}
      {selectedUser && (
        <div className="modal-backdrop" onClick={() => setSelectedUser(null)}>
          <div
            className="modal-content"
            style={{ maxWidth: '620px', maxHeight: '90vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: 'var(--primary)',
                    color: 'var(--primary-foreground)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                  }}
                >
                  {selectedUser.name?.[0] || 'U'}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>
                    {selectedUser.name}
                  </h3>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {selectedUser.email}
                  </div>
                </div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelectedUser(null)}>
                <X size={15} />
              </button>
            </div>

            <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Privacy Notice Banner */}
              <div
                style={{
                  padding: '0.65rem 0.85rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-color)',
                  fontSize: '0.76rem',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <Shield size={14} style={{ color: 'var(--primary)' }} />
                <span>Customer Privacy Active: Individual expense titles & vendor terms are kept private.</span>
              </div>

              {/* Counts Overview (Strictly Numbers) */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '0.75rem',
                  padding: '1rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-color)',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Incomes Registered
                  </div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--success, #16a34a)', marginTop: '0.2rem' }}>
                    {selectedUser.incomeCount}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Total revenue count</div>
                </div>

                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Expenses Registered
                  </div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#2563eb', marginTop: '0.2rem' }}>
                    {selectedUser.expenseCount}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Total vouchers count</div>
                </div>

                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Chatbot Inquiries
                  </div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#d97706', marginTop: '0.2rem' }}>
                    {selectedUser.chatInteractionsCount || 0}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>AI messages sent</div>
                </div>
              </div>

              {/* Profile Details */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.82rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.4rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Workspace:</span>
                  <span style={{ fontWeight: 700 }}>{selectedUser.orgName}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.4rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Registered Since:</span>
                  <span>{formatDisplayDate(selectedUser.createdAt)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.4rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Last Active Activity:</span>
                  <span>{formatTimeAgo(selectedUser.lastActiveAt)}</span>
                </div>
              </div>

              {/* Companies Affiliated & Their Counts */}
              <div>
                <h4 style={{ fontSize: '0.86rem', fontWeight: 700, marginBottom: '0.55rem' }}>
                  Companies Managed ({selectedUser.companies?.length || 0})
                </h4>
                {selectedUser.companies && selectedUser.companies.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                    {selectedUser.companies.map((c) => (
                      <div
                        key={c.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '0.6rem 0.85rem',
                          borderRadius: 'var(--radius-xs)',
                          background: 'var(--bg-surface)',
                          border: '1px solid var(--border-color)',
                          fontSize: '0.82rem',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                          <Building2 size={13} />
                          <strong>{c.name}</strong>
                          {c.isCoreBranch && (
                            <span style={{ fontSize: '0.65rem', color: 'var(--primary)', fontWeight: 700 }}>
                              (Core)
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <span style={{ fontSize: '0.74rem', color: 'var(--success, #16a34a)', fontWeight: 700 }}>
                            {c.incomeCount} Incomes
                          </span>
                          <span style={{ color: 'var(--border-color)' }}>•</span>
                          <span style={{ fontSize: '0.74rem', color: '#2563eb', fontWeight: 700 }}>
                            {c.expenseCount} Expenses
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    No companies configured.
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer" style={{ borderTop: '1px solid var(--border-color)', padding: '0.75rem 1.25rem' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setSelectedUser(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboardPage;
