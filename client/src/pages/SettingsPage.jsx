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
} from 'lucide-react';
import { GET_PAYMENT_METHODS } from '../graphql/queries';
import { CREATE_PAYMENT_METHOD, DELETE_PAYMENT_METHOD } from '../graphql/mutations';
import { useAuthStore } from '../store/authStore';

export const SettingsPage = () => {
  const { user, org, token, activeCompanyId } = useAuthStore();
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState('bank');
  const [accountNumber, setAccountNumber] = useState('');

  const { data, loading, refetch } = useQuery(GET_PAYMENT_METHODS);
  const [createPaymentMethod, { loading: creating }] = useMutation(CREATE_PAYMENT_METHOD);
  const [deletePaymentMethod] = useMutation(DELETE_PAYMENT_METHOD);

  const paymentMethods = data?.paymentMethods || [];

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

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this payment method?')) return;
    try {
      await deletePaymentMethod({ variables: { id } });
      refetch();
    } catch (err) {
      alert('Error deleting: ' + err.message);
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
        return <CreditCard size={18} style={{ color: '#3b82f6' }} />;
      case 'cash':
        return <Wallet size={18} style={{ color: 'var(--success)' }} />;
      case 'upi':
        return <Smartphone size={18} style={{ color: '#8b5cf6' }} />;
      default:
        return <CreditCard size={18} style={{ color: 'var(--text-muted)' }} />;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>Workspace Settings</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Configure organization profile, payment accounts, financial preferences, and data exports
        </p>
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
                Multi-entity B2B workspace details
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.875rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Organization Name</span>
              <strong>{org?.name || 'My Enterprise'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Workspace Slug</span>
              <span className="mono" style={{ background: 'var(--bg-surface)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                {org?.slug || 'expenseflow-hq'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Subscription Plan</span>
              <span className="badge badge-success" style={{ textTransform: 'uppercase' }}>
                {org?.plan || 'Enterprise'} Tier
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-muted)' }}>CORE BRIGHT Architecture</span>
              <span className="badge badge-neutral">10 Standard Sections</span>
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
                Authenticated administrator session
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.875rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Full Name</span>
              <strong>{user?.name || 'Administrator'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Email Address</span>
              <strong>{user?.email || 'admin@expenseflow.local'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Security Role</span>
              <span className="badge badge-neutral" style={{ textTransform: 'capitalize' }}>
                {user?.role || 'Admin'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-muted)' }}>Authentication</span>
              <span style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem' }}>
                <CheckCircle size={14} /> Active JWT Session
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
            <h3 style={{ fontSize: '1.1rem' }}>Accounting & Hierarchy Standards</h3>
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
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Reporting Currency</span>
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
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Fiscal Year Schedule</span>
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
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Budget Overrun Threshold</span>
            <strong style={{ fontSize: '1rem', color: 'var(--warning)' }}>80% Warning Trigger</strong>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              Triggers visual amber badge when spend exceeds 80%
            </span>
          </div>
        </div>
      </div>

      {/* Accounting & Audit Data Export Hub */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
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
                Download CSV ledgers for external audit, tax filings, and Tally / QuickBooks reconciliation
              </span>
            </div>
          </div>
        </div>

        <div className="grid-3">
          {/* Expenses Export */}
          <div
            style={{
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius)',
              padding: '1.2rem',
              background: 'var(--bg-surface)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '1rem',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Download size={16} style={{ color: 'var(--danger)' }} />
                <strong style={{ fontSize: '0.95rem' }}>Expense Ledger CSV</strong>
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
              padding: '1.2rem',
              background: 'var(--bg-surface)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '1rem',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Download size={16} style={{ color: 'var(--success)' }} />
                <strong style={{ fontSize: '0.95rem' }}>Revenue / Income CSV</strong>
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
              padding: '1.2rem',
              background: 'var(--bg-surface)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '1rem',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Download size={16} style={{ color: 'var(--primary)' }} />
                <strong style={{ fontSize: '0.95rem' }}>Chart of Accounts CSV</strong>
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
          <div
            style={{
              padding: '2.5rem',
              textAlign: 'center',
              border: '1px dashed var(--border-color)',
              borderRadius: 'var(--radius)',
              color: 'var(--text-muted)',
            }}
          >
            <CreditCard size={32} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
            <p style={{ fontSize: '0.9rem' }}>No payment methods configured yet.</p>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setShowModal(true)}
              style={{ marginTop: '0.75rem' }}
            >
              <Plus size={13} /> Add First Account
            </button>
          </div>
        ) : (
          <div className="grid-3">
            {paymentMethods.map((pm) => (
              <div
                key={pm.id}
                style={{
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius)',
                  padding: '1.1rem',
                  background: 'var(--bg-surface)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.6rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {getPaymentIcon(pm.type)}
                    <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{pm.name}</span>
                  </div>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleDelete(pm.id)}
                    title="Delete Payment Method"
                    style={{ padding: '0.3rem', color: 'var(--danger)' }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  <span className="badge badge-neutral" style={{ textTransform: 'capitalize', fontSize: '0.7rem' }}>
                    {pm.type}
                  </span>
                  {pm.accountNumber && (
                    <span className="mono" style={{ fontSize: '0.8rem' }}>
                      A/c ending in •••• {pm.accountNumber}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Payment Method Modal */}
      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.2rem' }}>Add Payment Account</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowModal(false)} style={{ padding: '0.35rem' }}>
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label className="form-label">Account / Method Name</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. HDFC Current A/c or ICICI Corporate Card"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Type</label>
                  <select
                    className="select"
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                  >
                    <option value="bank">Bank Account</option>
                    <option value="card">Credit / Debit Card</option>
                    <option value="cash">Petty Cash</option>
                    <option value="upi">UPI / Virtual VPA</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Last 4 Digits (Optional)</label>
                  <input
                    type="text"
                    className="input mono"
                    placeholder="9988"
                    maxLength="4"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={creating}>
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
