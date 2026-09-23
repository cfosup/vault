import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useQuery } from '@apollo/client/react';
import {
  LayoutDashboard,
  Receipt,
  TrendingUp,
  PieChart,
  Building2,
  Settings,
  LogOut,
  Moon,
  Sun,
  ShieldCheck,
  ChevronDown,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { GET_COMPANIES } from '../../graphql/queries';

export const Navbar = () => {
  const navigate = useNavigate();
  const { user, org, logout, theme, toggleTheme, activeCompanyId, setActiveCompanyId } = useAuthStore();
  const { data: companyData } = useQuery(GET_COMPANIES);

  const companies = companyData?.companies || [];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getInitials = (name) => {
    if (!name) return 'EX';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  return (
    <header className="navbar">
      <div className="navbar-inner">
        {/* Brand */}
        <NavLink to="/" className="navbar-brand">
          <div className="brand-icon">₹</div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span>ExpenseFlow</span>
              <span className="badge badge-primary" style={{ fontSize: '0.62rem', padding: '0.08rem 0.4rem' }}>
                B2B PRO
              </span>
            </div>
          </div>
        </NavLink>

        {/* Segmented Navigation */}
        <nav className="nav-links">
          <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} end>
            <LayoutDashboard size={15} />
            <span>Dashboard</span>
          </NavLink>

          <NavLink to="/expenses" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Receipt size={15} />
            <span>Expenses</span>
          </NavLink>

          <NavLink to="/income" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <TrendingUp size={15} />
            <span>Income</span>
          </NavLink>

          <NavLink to="/budgets" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <PieChart size={15} />
            <span>Budgets</span>
          </NavLink>

          <NavLink to="/companies" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Building2 size={15} />
            <span>Companies</span>
          </NavLink>

          <NavLink to="/settings" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Settings size={15} />
            <span>Settings</span>
          </NavLink>
        </nav>

        {/* Actions & Profile */}
        <div className="nav-actions">
          {/* Company Switcher */}
          {companies.length > 0 && (
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <select
                className="company-select"
                value={activeCompanyId || ''}
                onChange={(e) => setActiveCompanyId(e.target.value || null)}
                title="Filter Workspace by Legal Entity"
                style={{ paddingRight: '1.8rem', appearance: 'none', WebkitAppearance: 'none' }}
              >
                <option value="">All Entities (Consolidated)</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.isCoreBranch ? '★ Core' : ''}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={13}
                style={{
                  position: 'absolute',
                  right: '10px',
                  pointerEvents: 'none',
                  color: 'var(--text-muted)',
                }}
              />
            </div>
          )}

          {/* Theme Toggle */}
          <button
            className="btn btn-secondary btn-sm"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            style={{ padding: '0.45rem', borderRadius: 'var(--radius)' }}
          >
            {theme === 'dark' ? <Sun size={15} style={{ color: '#fbbf24' }} /> : <Moon size={15} style={{ color: '#6366f1' }} />}
          </button>

          {/* User Profile Capsule */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              padding: '0.25rem 0.5rem 0.25rem 0.35rem',
              borderRadius: 'var(--radius-full)',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-color)',
            }}
          >
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: 'var(--radius-full)',
                background: 'var(--primary-gradient)',
                color: '#fff',
                fontSize: '0.72rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {getInitials(user?.name)}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                {user?.name?.split(' ')[0]}
              </span>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                {org?.name || 'Workspace'}
              </span>
            </div>

            <button
              onClick={handleLogout}
              title="Sign Out"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: '0.2rem',
                marginLeft: '0.2rem',
                transition: 'color 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--danger)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
