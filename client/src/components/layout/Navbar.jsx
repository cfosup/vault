import React, { useState } from 'react';
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
  ChevronDown,
  Menu,
  X,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { GET_COMPANIES } from '../../graphql/queries';

export const Navbar = () => {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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

  const navItems = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/expenses', label: 'Expenses', icon: Receipt },
    { to: '/income', label: 'Income', icon: TrendingUp },
    { to: '/budgets', label: 'Budgets', icon: PieChart },
    { to: '/companies', label: 'Companies', icon: Building2 },
    { to: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <>
      <header className="navbar">
        <div className="navbar-inner">
          {/* Brand */}
          <NavLink to="/" className="navbar-brand">
            <div className="brand-icon">V</div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <span>Vault</span>
                <span className="badge badge-primary" style={{ fontSize: '0.62rem', padding: '0.08rem 0.45rem' }}>
                  PRO
                </span>
              </div>
            </div>
          </NavLink>

          {/* Desktop Navigation */}
          <nav className="nav-links">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                >
                  <Icon size={15} />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
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
              className="btn btn-secondary btn-icon"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? (
                <Sun size={15} style={{ color: '#fbbf24' }} />
              ) : (
                <Moon size={15} style={{ color: '#6366f1' }} />
              )}
            </button>

            {/* User Profile Capsule */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.55rem',
                padding: '0.25rem 0.55rem 0.25rem 0.35rem',
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
                  background: 'var(--primary)',
                  color: '#fff',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: 'var(--shadow-xs)',
                  flexShrink: 0,
                }}
              >
                {getInitials(user?.name)}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                  {user?.name?.split(' ')[0] || 'User'}
                </span>
                <span style={{ fontSize: '0.67rem', color: 'var(--text-muted)' }}>
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
                  marginLeft: '0.25rem',
                  transition: 'color 0.15s ease',
                  borderRadius: 'var(--radius-xs)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--danger)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
              >
                <LogOut size={14} />
              </button>
            </div>

            {/* Mobile Hamburger Toggle */}
            <button
              className="mobile-nav-toggle"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Drawer */}
      <div className={`mobile-nav-drawer ${mobileMenuOpen ? 'open' : ''}`}>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              style={{ padding: '0.65rem 0.85rem', width: '100%' }}
            >
              <Icon size={16} />
              <span style={{ fontSize: '0.9rem' }}>{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </>
  );
};

export default Navbar;
