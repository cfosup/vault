import React, { useState } from 'react';

import { useQuery, useMutation } from '@apollo/client/react';
import {
  CreditCard,
  Plus,
  Trash2,
  Shield,
  User,
  Building,
  X,
  Download,
  FileSpreadsheet,
  CheckCircle,
  Globe,
  Sliders,
  DollarSign,
  Landmark,
  Wallet,
  Smartphone,
  AlertTriangle,
  RotateCcw,
  Mail,
  Send,
  Bell,
  Check,
  Sparkles,
} from 'lucide-react';
import { GET_PAYMENT_METHODS } from '../graphql/queries';
import { CREATE_PAYMENT_METHOD, DELETE_PAYMENT_METHOD, SEND_TEST_EMAIL } from '../graphql/mutations';
import { useAuthStore } from '../store/authStore';
import { ConfirmModal } from '../components/common/ConfirmModal';

export const SettingsPage = () => {
  const { user, org, token, activeCompanyId } = useAuthStore();
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState('bank');
  const [accountNumber, setAccountNumber] = useState('');

  // Delete modal state
  const [pmToDelete, setPmToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Database reset state
  const [resettingDb, setResettingDb] = useState(false);
  const [resetMsg, setResetMsg] = useState('');

  // Resend Email Test state
  const [testEmailStatus, setTestEmailStatus] = useState(null);
  const [sendTestEmailMutation, { loading: sendingTestEmail }] = useMutation(SEND_TEST_EMAIL);

  const { data, loading, refetch } = useQuery(GET_PAYMENT_METHODS);
  const [createPaymentMethod, { loading: creating }] = useMutation(CREATE_PAYMENT_METHOD);
  const [deletePaymentMethod] = useMutation(DELETE_PAYMENT_METHOD);

  const paymentMethods = data?.paymentMethods || [];

  const handleResetDatabase = async () => {
    if (!window.confirm('WARNING: Are you sure you want to completely clear the database? This will delete all financial entries, companies, and users, returning Vault to a fresh project state.')) {
      return;
    }
    setResettingDb(true);
    setResetMsg('');
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const res = await fetch(`${apiUrl}/api/admin/reset-database`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const result = await res.json();
      if (result.success) {
        setResetMsg('Database successfully reset to a clean slate! Redirecting to login...');
        setTimeout(() => {
          useAuthStore.getState().logout();
          window.location.href = '/login';
        }, 1500);
      } else {
        alert('Error: ' + result.error);
      }
    } catch (err) {
      alert('Failed to connect to reset endpoint: ' + err.message);
    } finally {
      setResettingDb(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await createPaymentMethod({
        variables: {
          input: {
            name,
            type,
            accountNumber,
          },
        },
      });
      setShowModal(false);
      setName('');
      setAccountNumber('');
      refetch();
    } catch (err) {
      alert('Error creating payment method: ' + err.message);
    }
  };

  const confirmDeletePM = async () => {
    if (!pmToDelete) return;
    setIsDeleting(true);
    try {
      await deletePaymentMethod({ variables: { id: pmToDelete } });
      refetch();
      setPmToDelete(null);
    } catch (err) {
      alert('Error deleting: ' + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSendTestEmail = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const targetEmail = user?.email;
    if (!targetEmail || !targetEmail.includes('@')) {
      setTestEmailStatus({ success: false, message: 'No valid account email found for the logged-in user.' });
      return;
    }
    setTestEmailStatus(null);
    try {
      const res = await sendTestEmailMutation({
        variables: { email: targetEmail }
      });
      const result = res.data?.sendTestEmail;
      if (result?.success) {
        setTestEmailStatus({
          success: true,
          message: result.message || `Test notification email successfully sent to ${targetEmail}!`
        });
      } else {
        const rawMsg = result?.message || 'Failed to dispatch email';
        const formattedMsg = rawMsg.includes('own email address')
          ? 'Notice: Resend default sandbox domain (onboarding@resend.dev) delivers to your account owner inbox. Add a verified custom domain at resend.com/domains to send to any address without restriction or spam filtering.'
          : rawMsg;
        setTestEmailStatus({
          success: false,
          message: formattedMsg
        });
      }
    } catch (err) {
      const rawMsg = err.message || 'Error sending email';
      const formattedMsg = rawMsg.includes('own email address')
        ? 'Notice: Resend default sandbox domain (onboarding@resend.dev) delivers to your account owner inbox. Add a verified custom domain at resend.com/domains to send to any address without restriction or spam filtering.'
        : rawMsg;
      setTestEmailStatus({
        success: false,
        message: formattedMsg
      });
    }
  };

  const handleExport = (endpoint) => {
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
    let url = `${baseUrl}/export/${endpoint}?token=${token}`;
    if (activeCompanyId && endpoint !== 'categories') {
      url += `&companyId=${activeCompanyId}`;
    }
    window.open(url, '_blank');
  };

  const getPaymentIcon = (pmType) => {
    switch (pmType) {
      case 'bank':
        return <Landmark size={18} style={{ color: 'var(--primary)' }} />;
      case 'card':
        return <CreditCard size={18} style={{ color: '#38bdf8' }} />;
      case 'cash':
        return <Wallet size={18} style={{ color: 'var(--success)' }} />;
      case 'upi':
        return <Smartphone size={18} style={{ color: '#8b5cf6' }} />;
      default:
        return <CreditCard size={18} style={{ color: 'var(--text-muted)' }} />;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Header Card */}
      <div
        className="card"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1.25rem',
          padding: '1.35rem 1.65rem',
          background: 'var(--bg-card)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <h1 style={{ fontSize: '1.65rem' }}>Workspace Settings & Controls</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Configure organization profile, payment accounts, financial preferences, and data exports
          </p>
        </div>
      </div>

      {/* Profiles Grid */}
      <div className="grid-2">
        {/* Organization Info */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--primary-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary)',
              }}
            >
              <Building size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem' }}>Organization Profile</h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Workspace details & subscription
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Organization Name</span>
              <strong>{org?.name || 'My Enterprise'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Subscription Plan</span>
              <span className="badge badge-primary" style={{ textTransform: 'uppercase', fontWeight: 600 }}>
                Beta
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-muted)' }}>Accounting Framework</span>
              <span className="badge badge-neutral">CORE BRIGHT (10 Sections)</span>
            </div>
          </div>
        </div>

        {/* User Account */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--primary-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary)',
              }}
            >
              <User size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem' }}>Your Account</h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Personal account details & permissions
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Full Name</span>
              <strong>{user?.name || 'Administrator'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Email Address</span>
              <strong>{user?.email || 'admin@vault.local'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-muted)' }}>Account Status</span>
              <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <CheckCircle size={12} /> Active
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-muted)' }}>Role</span>
              <span className="badge badge-neutral" style={{ textTransform: 'capitalize' }}>
                {user?.role || 'Admin'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Accounting & Financial Preferences */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--primary-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--primary)',
            }}
          >
            <Sliders size={20} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.1rem' }}>Accounting & Financial Defaults</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Core Chart of Accounts defaults and financial reporting rules
            </span>
          </div>
        </div>

        <div className="grid-3" style={{ fontSize: '0.85rem' }}>
          <div
            style={{
              padding: '1rem',
              borderRadius: 'var(--radius)',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.4rem',
            }}
          >
            <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Reporting Currency</span>
            <strong style={{ fontSize: '1rem' }}>₹ INR (Indian Rupee)</strong>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              Default currency token across multi-entity ledgers
            </span>
          </div>

          <div
            style={{
              padding: '1rem',
              borderRadius: 'var(--radius)',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.4rem',
            }}
          >
            <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Fiscal Year Schedule</span>
            <strong style={{ fontSize: '1rem' }}>April 1 – March 31</strong>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              Standard Indian financial year reporting cycle
            </span>
          </div>

          <div
            style={{
              padding: '1rem',
              borderRadius: 'var(--radius)',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.4rem',
            }}
          >
            <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Budget Overrun Threshold</span>
            <strong style={{ fontSize: '1rem', color: 'var(--warning)' }}>80% Warning Trigger</strong>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              Triggers visual amber badge when spend exceeds 80%
            </span>
          </div>
        </div>
      </div>

      {/* Accounting & Audit Data Export Hub */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--success-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--success)',
            }}
          >
            <FileSpreadsheet size={20} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.1rem' }}>Accounting & Audit Export Hub</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Download CSV ledgers for external audit, tax filings, and ERP reconciliation
            </span>
          </div>
        </div>

        <div className="grid-3">
          {/* Expenses Export */}
          <div
            style={{
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius)',
              padding: '1.15rem',
              background: 'var(--bg-surface)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '1rem',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Download size={16} style={{ color: 'var(--danger)' }} />
                <strong style={{ fontSize: '0.925rem' }}>Expense Ledger CSV</strong>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                Itemized expense disbursements with date, company name, section, category, subcategory, vendor, and payment method.
              </p>
            </div>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => handleExport('expenses')}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              <Download size={14} /> Download Expenses CSV
            </button>
          </div>

          {/* Income Export */}
          <div
            style={{
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius)',
              padding: '1.15rem',
              background: 'var(--bg-surface)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '1rem',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Download size={16} style={{ color: 'var(--success)' }} />
                <strong style={{ fontSize: '0.925rem' }}>Revenue / Income CSV</strong>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                Inflow receipts, operational revenue, investments, and customer payments organized by company and source.
              </p>
            </div>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => handleExport('income')}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              <Download size={14} /> Download Income CSV
            </button>
          </div>

          {/* Chart of Accounts Export */}
          <div
            style={{
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius)',
              padding: '1.15rem',
              background: 'var(--bg-surface)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '1rem',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Download size={16} style={{ color: 'var(--primary)' }} />
                <strong style={{ fontSize: '0.925rem' }}>Chart of Accounts CSV</strong>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                Master hierarchy export containing Section Letters, Section Labels, Categories, and Subcategories across all companies.
              </p>
            </div>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => handleExport('categories')}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              <Download size={14} /> Download Hierarchy CSV
            </button>
          </div>
        </div>
      </div>

      {/* Payment Methods Section */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--primary-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary)',
              }}
            >
              <CreditCard size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem' }}>Configured Payment Accounts</h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Bank accounts, corporate cards, petty cash funds, and UPI handles
              </span>
            </div>
          </div>

          <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>
            <Plus size={14} /> + Add Payment Method
          </button>
        </div>

        {paymentMethods.length === 0 ? (
          <div className="empty-state" style={{ padding: '2.5rem 1rem' }}>
            <div className="empty-icon"><CreditCard size={24} /></div>
            <div className="empty-title">No payment methods configured</div>
            <div className="empty-desc">Add bank accounts, cards, or digital wallets to tag your expenditures.</div>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '1rem',
            }}
          >
            {paymentMethods.map((pm) => (
              <div
                key={pm.id}
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius)',
                  padding: '1.15rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  position: 'relative',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <div
                      style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {getPaymentIcon(pm.type)}
                    </div>
                    <div>
                      <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>{pm.name}</h4>
                      <span className="badge badge-neutral" style={{ textTransform: 'uppercase', fontSize: '0.65rem', marginTop: '0.15rem' }}>
                        {pm.type}
                      </span>
                    </div>
                  </div>

                  <button
                    className="btn btn-secondary btn-icon"
                    onClick={() => setPmToDelete(pm.id)}
                    title="Delete Account"
                    style={{ color: 'var(--danger)' }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                {pm.accountNumber && (
                  <div
                    style={{
                      background: 'var(--bg-card)',
                      padding: '0.45rem 0.65rem',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.8rem',
                      color: 'var(--text-muted)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span>Account Number</span>
                    <strong className="mono" style={{ color: 'var(--text-main)' }}>
                      •••• {pm.accountNumber.slice(-4)}
                    </strong>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Customer Email & Communication Infrastructure (Resend) */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: 'var(--radius-md)',
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(168, 85, 247, 0.15))',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                color: '#a855f7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Mail size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 600, margin: 0 }}>Customer Alerts & Email (Resend)</h3>
                <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.7rem' }}>
                  <Check size={11} /> Connected
                </span>
              </div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Powered by Resend API • Automatic customer onboarding, budget threshold warnings & disbursement alerts
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
          <div style={{ padding: '0.85rem 1rem', background: 'var(--bg-card-subtle, rgba(255,255,255,0.02))', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', fontWeight: 600, fontSize: '0.85rem' }}>
              <Sparkles size={14} style={{ color: 'var(--primary)' }} />
              <span>Welcome & Onboarding</span>
            </div>
            <p style={{ margin: 0, fontSize: '0.775rem', color: 'var(--text-muted)' }}>
              Automatically sent to customers upon registration or Google OAuth sign-in with quick-start steps.
            </p>
          </div>

          <div style={{ padding: '0.85rem 1rem', background: 'var(--bg-card-subtle, rgba(255,255,255,0.02))', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', fontWeight: 600, fontSize: '0.85rem' }}>
              <Bell size={14} style={{ color: 'var(--warning)' }} />
              <span>Budget Cap Alerts</span>
            </div>
            <p style={{ margin: 0, fontSize: '0.775rem', color: 'var(--text-muted)' }}>
              Dispatched automatically when any expense pushes category spending to 100% or above its budget limit.
            </p>
          </div>

          <div style={{ padding: '0.85rem 1rem', background: 'var(--bg-card-subtle, rgba(255,255,255,0.02))', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', fontWeight: 600, fontSize: '0.85rem' }}>
              <Send size={14} style={{ color: '#38bdf8' }} />
              <span>Disbursement Notices</span>
            </div>
            <p style={{ margin: 0, fontSize: '0.775rem', color: 'var(--text-muted)' }}>
              Instant notifications whenever multi-income linked disbursements or material expenses occur.
            </p>
          </div>
        </div>

        {/* Simple Notification Test to Logged-in User */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>Notification Recipient:</span>
            <strong style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>{user?.email || 'Logged-in Account'}</strong>
          </div>

          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleSendTestEmail}
            disabled={sendingTestEmail}
            style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0 1.15rem' }}
          >
            <Send size={14} />
            {sendingTestEmail ? 'Sending...' : 'Send Test Notification'}
          </button>
        </div>

          {testEmailStatus && (
            <div
              style={{
                marginTop: '0.5rem',
                padding: '0.65rem 0.85rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.825rem',
                background: testEmailStatus.success ? 'var(--success-bg)' : 'var(--danger-bg)',
                color: testEmailStatus.success ? 'var(--success)' : 'var(--danger)',
                border: `1px solid ${testEmailStatus.success ? 'color-mix(in srgb, var(--success) 30%, transparent)' : 'color-mix(in srgb, var(--danger) 30%, transparent)'}`,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              {testEmailStatus.success ? <CheckCircle size={15} /> : <AlertTriangle size={15} />}
              <span>{testEmailStatus.message}</span>
            </div>
          )}
        </div>

      {/* Danger Zone: Developer Reset (Local Development Only) */}
      {import.meta.env.DEV && (
        <div
          className="card"
          style={{
            border: '1px solid color-mix(in srgb, var(--destructive) 40%, transparent)',
            backgroundColor: 'color-mix(in srgb, var(--destructive) 4%, transparent)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--danger-bg)',
                color: 'var(--danger)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AlertTriangle size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem', color: 'var(--danger)' }}>Danger Zone: Reset Database</h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Wipe all transactions, companies, and user accounts to start completely fresh as a new project
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: '580px' }}>
              This action will clear all expenses, revenues, budget caps, payment methods, and user records. Core default categories will be safely reseeded.
            </p>
            <button
              type="button"
              className="btn btn-danger"
              onClick={handleResetDatabase}
              disabled={resettingDb}
              style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}
            >
              <RotateCcw size={15} />
              {resettingDb ? 'Resetting...' : 'Reset Complete Database'}
            </button>
          </div>

          {resetMsg && (
            <div style={{ padding: '0.55rem 0.85rem', borderRadius: 'var(--radius-sm)', background: 'var(--success-bg)', color: 'var(--success)', fontSize: '0.825rem' }}>
              {resetMsg}
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!pmToDelete}
        title="Delete Payment Account"
        message="Are you sure you want to remove this payment method? It will no longer be available for tagging new disbursements."
        confirmText="Delete Account"
        cancelText="Cancel"
        variant="danger"
        loading={isDeleting}
        onConfirm={confirmDeletePM}
        onCancel={() => setPmToDelete(null)}
      />

      {/* Add Payment Method Modal */}
      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--primary-light)',
                    color: 'var(--primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <CreditCard size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.05rem', margin: 0 }}>Add Payment Method</h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Add a bank account, corporate card, or digital wallet
                  </span>
                </div>
              </div>
              <button
                className="btn btn-ghost btn-icon"
                onClick={() => setShowModal(false)}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreate}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div className="form-group">
                  <label className="form-label">Payment Account Name *</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. HDFC Current Account, Brex Corporate Card"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Account Type</label>
                  <select
                    className="select"
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                  >
                    <option value="bank">Bank Account</option>
                    <option value="card">Credit / Debit Card</option>
                    <option value="upi">UPI / Digital Wallet</option>
                    <option value="cash">Petty Cash</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Account / Identifier Number (Optional)</label>
                  <input
                    type="text"
                    className="input mono"
                    placeholder="e.g. 50200012345678 or Last 4 digits"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={creating}>
                  {creating ? 'Saving...' : 'Add Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;
