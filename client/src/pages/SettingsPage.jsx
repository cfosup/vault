import React, { useState } from 'react';

import { useQuery, useMutation, useLazyQuery } from '@apollo/client/react';
import {
  CreditCard,
  Plus,
  Pencil,
  Trash2,
  User,
  Building,
  X,
  Download,
  FileSpreadsheet,
  CheckCircle,
  Sliders,
  Landmark,
  Wallet,
  Smartphone,
} from 'lucide-react';
import { GET_PAYMENT_METHOD, GET_ME, GET_MY_ACTIVITY } from '../graphql/queries';
import { usePaymentMethods } from '../hooks/usePaymentMethods';
import { CREATE_PAYMENT_METHOD, UPDATE_PAYMENT_METHOD, DELETE_PAYMENT_METHOD } from '../graphql/mutations';
import { useAuthStore } from '../store/authStore';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { OrgAccessPanel } from '../components/settings/OrgAccessPanel';

export const SettingsPage = () => {
  const { user, org, token, activeCompanyId } = useAuthStore();
  const canWrite = !user?.role || ['owner', 'admin', 'superadmin'].includes(user.role);
  const [showModal, setShowModal] = useState(false);
  const [editingPaymentId, setEditingPaymentId] = useState(null);
  const [name, setName] = useState('');
  const [type, setType] = useState('bank');
  const [accountNumber, setAccountNumber] = useState('');

  // Delete modal state
  const [pmToDelete, setPmToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { paymentMethods, refetch } = usePaymentMethods();
  const { data: meData } = useQuery(GET_ME);
  const account = meData?.me || user;
  const moduleOnly = account?.accessScope === 'modules';
  const canManagePayments = canWrite || moduleOnly;
  const { data: activityData } = useQuery(GET_MY_ACTIVITY, {
    variables: { limit: 20 },
    skip: moduleOnly,
  });
  const [createPaymentMethod, { loading: creating }] = useMutation(CREATE_PAYMENT_METHOD);
  const [updatePaymentMethod] = useMutation(UPDATE_PAYMENT_METHOD);
  const [deletePaymentMethod] = useMutation(DELETE_PAYMENT_METHOD);
  const [loadPaymentMethod] = useLazyQuery(GET_PAYMENT_METHOD, { fetchPolicy: 'network-only' });
  const activityLogs = activityData?.myActivityLogs || [];

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const input = { name, type, accountNumber };
      if (editingPaymentId) {
        await updatePaymentMethod({ variables: { id: editingPaymentId, input } });
      } else {
        await createPaymentMethod({ variables: { input } });
      }
      setEditingPaymentId(null);
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
    <div className="page">
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
          <h1 style={{ fontSize: '1.65rem' }}>Settings</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            {moduleOnly ? 'Your account and the payment accounts you can use.' : 'People, company details, payment accounts, and exports.'}
          </p>
        </div>
      </div>

      {/* Profiles Grid */}
      <div className="grid-2">
        {!moduleOnly && (
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
              <h3 style={{ fontSize: '1.1rem' }}>Organization</h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                The workspace this account belongs to
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
              <span style={{ color: 'var(--text-muted)' }}>Categories</span>
              <span className="badge badge-neutral">Built in</span>
            </div>
          </div>
        </div>
        )}

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
                Who is signed in
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Full Name</span>
              <strong>{account?.name || 'Administrator'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Email Address</span>
              <strong>{account?.email || 'admin@vault.local'}</strong>
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
                {account?.role || 'Admin'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div className="settings-icon">
              <CreditCard size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem' }}>Payment accounts</h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Cards, bank accounts, cash, and UPI you pay from.
              </span>
            </div>
          </div>
          {canManagePayments && (
            <button className="btn btn-primary btn-sm" onClick={() => { setEditingPaymentId(null); setName(''); setAccountNumber(''); setType('bank'); setShowModal(true); }}>
              <Plus size={14} /> Add account
            </button>
          )}
        </div>

        {paymentMethods.length === 0 ? (
          <div className="empty-state" style={{ padding: '1.5rem 1rem' }}>
            <div className="empty-icon"><CreditCard size={22} /></div>
            <div className="empty-title">No payment accounts yet</div>
            <div className="empty-desc">Add the card or account you want to pick when recording an expense.</div>
          </div>
        ) : (
          <div className="payment-grid">
            {paymentMethods.map((pm) => (
              <div key={pm.id} className="payment-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <div className="settings-icon">{getPaymentIcon(pm.type)}</div>
                    <div>
                      <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>{pm.name}</h4>
                      <span className="badge badge-neutral" style={{ textTransform: 'uppercase', fontSize: '0.65rem', marginTop: '0.2rem' }}>{pm.type}</span>
                      {pm.createdByName && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>Added by {pm.createdByName}</div>
                      )}
                    </div>
                  </div>
                  {canManagePayments && (
                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                      <button
                        className="btn btn-secondary btn-icon"
                        title="Edit payment account"
                        onClick={async () => {
                          const res = await loadPaymentMethod({ variables: { id: pm.id } });
                          const record = res.data?.paymentMethod || pm;
                          setEditingPaymentId(record.id);
                          setName(record.name || '');
                          setType(record.type || 'bank');
                          setAccountNumber(record.accountNumber || '');
                          setShowModal(true);
                        }}
                      >
                        <Pencil size={13} />
                      </button>
                      <button className="btn btn-secondary btn-icon" onClick={() => setPmToDelete(pm.id)} title="Remove account" style={{ color: 'var(--danger)' }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>
                {pm.accountNumber && (
                  <div className="payment-number">
                    <span>Account</span>
                    <strong className="mono">•••• {pm.accountNumber.slice(-4)}</strong>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {!moduleOnly && <OrgAccessPanel />}

      {!moduleOnly && (
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
            <h3 style={{ fontSize: '1.1rem' }}>Money defaults</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Currency, financial year, and the budget alert
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
              Amounts are shown in rupees
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
            <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Financial year</span>
            <strong style={{ fontSize: '1rem' }}>April 1 – March 31</strong>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              The year used for reports
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
            <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Budget alert</span>
            <strong style={{ fontSize: '1rem', color: 'var(--warning)' }}>80%</strong>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              The owner is emailed once a budget crosses this
            </span>
          </div>
        </div>
      </div>
      )}

      {!moduleOnly && (
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
            <h3 style={{ fontSize: '1.1rem' }}>Downloads</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Save a spreadsheet of expenses, income, or categories
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
                <strong style={{ fontSize: '0.925rem' }}>Expenses</strong>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                Date, company, category, vendor, and amount.
              </p>
            </div>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => handleExport('expenses')}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              <Download size={14} /> Download expenses
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
                <strong style={{ fontSize: '0.925rem' }}>Income</strong>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                Who paid you, the company, and the amount.
              </p>
            </div>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => handleExport('income')}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              <Download size={14} /> Download income
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
                <strong style={{ fontSize: '0.925rem' }}>Categories</strong>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                Categories and subcategories for every company.
              </p>
            </div>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => handleExport('categories')}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              <Download size={14} /> Download categories
            </button>
          </div>
        </div>
      </div>
      )}

      {!moduleOnly && (
      <div className="card activity-log">
        <div>
          <h3>Activity</h3>
          <p>The latest changes in this organization.</p>
        </div>
        {activityLogs.length === 0 ? (
          <p className="field-hint">No activity has been recorded yet.</p>
        ) : (
          <div className="activity-list">
            {activityLogs.map((log) => (
              <div key={log.id} className="activity-row">
                <span>{log.description}{log.companyName ? ` · ${log.companyName}` : ''}</span>
                <time>{new Date(log.createdAt).toLocaleString()}</time>
              </div>
            ))}
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
                  <h3 style={{ fontSize: '1.05rem', margin: 0 }}>{editingPaymentId ? 'Edit account' : 'Add account'}</h3>
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
