import React, { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import {
  Plus,
  Trash2,
  Download,
  Search,
  Check,
  X,
  TrendingUp,
  Zap,
  TableProperties,
  Building,
  DollarSign,
  ArrowRight,
} from 'lucide-react';
import { GET_INCOMES, GET_COMPANIES } from '../graphql/queries';
import { CREATE_INCOMES, DELETE_INCOME } from '../graphql/mutations';
import { useAuthStore } from '../store/authStore';

export const IncomePage = () => {
  const { activeCompanyId, token } = useAuthStore();
  const [showForm, setShowForm] = useState(false);
  const [entryMode, setEntryMode] = useState('quick'); // 'quick' | 'batch'
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // Quick Single-Entry Form State
  const [quickDate, setQuickDate] = useState(new Date().toISOString().split('T')[0]);
  const [quickCompanyId, setQuickCompanyId] = useState(activeCompanyId || '');
  const [quickSource, setQuickSource] = useState('');
  const [quickAmount, setQuickAmount] = useState('');
  const [quickNotes, setQuickNotes] = useState('');

  // Batch rows state
  const [rows, setRows] = useState([
    {
      companyId: activeCompanyId || '',
      date: new Date().toISOString().split('T')[0],
      source: '',
      amount: '',
      notes: '',
    },
  ]);

  const { data: compData } = useQuery(GET_COMPANIES);
  const companies = compData?.companies || [];
  const activeCompany = companies.find((c) => c.id === activeCompanyId);

  const { data, loading, refetch } = useQuery(GET_INCOMES, {
    variables: {
      filter: {
        companyId: activeCompanyId || null,
        search: search || null,
      },
      page,
      limit: 15,
    },
  });

  const [createIncomes, { loading: saving }] = useMutation(CREATE_INCOMES);
  const [deleteIncome] = useMutation(DELETE_INCOME);

  const incomes = data?.incomes?.incomes || [];
  const totalPages = data?.incomes?.totalPages || 1;
  const totalCount = data?.incomes?.totalCount || 0;

  // Summary Metrics
  const totalInflow = useMemo(() => {
    return incomes.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  }, [incomes]);

  const avgInflow = useMemo(() => {
    if (!incomes.length) return 0;
    return Math.round(totalInflow / incomes.length);
  }, [incomes, totalInflow]);

  // Quick Form Submit
  const handleQuickSubmit = async (e, addAnother = false) => {
    if (e) e.preventDefault();
    if (!quickCompanyId || !quickSource || !quickAmount) {
      alert('Please fill Company, Source, and Amount.');
      return;
    }

    const input = {
      companyId: quickCompanyId,
      date: quickDate,
      source: quickSource,
      amount: parseFloat(quickAmount) || 0,
      notes: quickNotes,
    };

    try {
      await createIncomes({ variables: { inputs: [input] } });
      refetch();
      if (addAnother) {
        setQuickAmount('');
        setQuickSource('');
        setQuickNotes('');
      } else {
        setShowForm(false);
        setQuickAmount('');
        setQuickSource('');
        setQuickNotes('');
      }
    } catch (err) {
      alert('Error saving revenue: ' + err.message);
    }
  };

  // Batch Form Handlers
  const handleAddRow = () => {
    setRows([
      ...rows,
      {
        companyId: activeCompanyId || (companies[0]?.id || ''),
        date: new Date().toISOString().split('T')[0],
        source: '',
        amount: '',
        notes: '',
      },
    ]);
  };

  const handleRemoveRow = (index) => {
    if (rows.length === 1) return;
    setRows(rows.filter((_, i) => i !== index));
  };

  const handleRowChange = (index, field, value) => {
    const updated = [...rows];
    updated[index][field] = value;
    setRows(updated);
  };

  const runningTotal = rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

  const handleSubmitBatch = async (e) => {
    e.preventDefault();
    const inputs = rows.map((r) => ({
      companyId: r.companyId || companies[0]?.id,
      date: r.date,
      source: r.source,
      amount: parseFloat(r.amount) || 0,
      notes: r.notes,
    }));

    for (const item of inputs) {
      if (!item.companyId || !item.source || !item.amount) {
        alert('Please ensure Company, Source, and Amount are filled for all rows.');
        return;
      }
    }

    try {
      await createIncomes({ variables: { inputs } });
      setShowForm(false);
      setRows([
        {
          companyId: activeCompanyId || companies[0]?.id || '',
          date: new Date().toISOString().split('T')[0],
          source: '',
          amount: '',
          notes: '',
        },
      ]);
      refetch();
    } catch (err) {
      alert('Error saving incomes: ' + err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this income record?')) return;
    try {
      await deleteIncome({ variables: { id } });
      refetch();
    } catch (err) {
      alert('Error deleting: ' + err.message);
    }
  };

  const handleExport = () => {
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
    let url = `${baseUrl}/export/income?token=${token}`;
    if (activeCompanyId) url += `&companyId=${activeCompanyId}`;
    window.open(url, '_blank');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Top Header Card */}
      <div
        className="card"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1.25rem',
          padding: '1.5rem 1.75rem',
          background: 'linear-gradient(135deg, var(--bg-card) 0%, var(--bg-surface) 100%)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Revenue & Inflow Ledger</h1>
            <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>
              {totalCount} Total Receipts
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Record client subscriptions, retainer contracts, operational revenues, and multi-entity receipts
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button className="btn btn-secondary btn-sm" onClick={handleExport}>
            <Download size={14} /> Export CSV
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setShowForm(!showForm)}
            style={{ padding: '0.45rem 1rem' }}
          >
            {showForm ? <X size={15} /> : <Plus size={15} />}
            {showForm ? 'Close Entry Form' : '+ Record Revenue'}
          </button>
        </div>
      </div>

      {/* Financial Metrics Summary Strip */}
      <div className="grid-3">
        <div className="card" style={{ padding: '1.1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: 'var(--radius)',
              background: 'var(--success-bg)',
              color: 'var(--success)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <TrendingUp size={22} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Page Total Inflow
            </span>
            <span className="mono" style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--success)' }}>
              ₹{totalInflow.toLocaleString('en-IN')}
            </span>
          </div>
        </div>

        <div className="card" style={{ padding: '1.1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: 'var(--radius)',
              background: 'var(--primary-light)',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <DollarSign size={22} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Average Revenue Ticket
            </span>
            <span className="mono" style={{ fontSize: '1.45rem', fontWeight: 800 }}>
              ₹{avgInflow.toLocaleString('en-IN')}
            </span>
          </div>
        </div>

        <div className="card" style={{ padding: '1.1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: 'var(--radius)',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Building size={22} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Entity Filter
            </span>
            <span style={{ fontSize: '1.1rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {activeCompany ? activeCompany.name : 'All Consolidated'}
            </span>
          </div>
        </div>
      </div>

      {/* Dual-Mode Income Entry Composer */}
      {showForm && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', border: '1.5px solid var(--success)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Record Cash Receipt / Revenue</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Allocate customer payments and capital injections to the legal operating division.
              </p>
            </div>

            <div style={{ display: 'flex', background: 'var(--bg-surface)', padding: '0.25rem', borderRadius: 'var(--radius)', gap: '0.25rem' }}>
              <button
                type="button"
                onClick={() => setEntryMode('quick')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.35rem 0.8rem',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: entryMode === 'quick' ? 'var(--success)' : 'transparent',
                  color: entryMode === 'quick' ? '#fff' : 'var(--text-muted)',
                  transition: 'all 0.15s ease',
                }}
              >
                <Zap size={14} /> Quick Entry Card
              </button>
              <button
                type="button"
                onClick={() => setEntryMode('batch')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.35rem 0.8rem',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: entryMode === 'batch' ? 'var(--success)' : 'transparent',
                  color: entryMode === 'batch' ? '#fff' : 'var(--text-muted)',
                  transition: 'all 0.15s ease',
                }}
              >
                <TableProperties size={14} /> Batch Spreadsheet Grid
              </button>
            </div>
          </div>

          {/* Quick Mode */}
          {entryMode === 'quick' && (
            <form onSubmit={(e) => handleQuickSubmit(e, false)} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="grid-3">
                <div className="form-group">
                  <label className="form-label">Receipt Date</label>
                  <input
                    type="date"
                    className="input"
                    value={quickDate}
                    onChange={(e) => setQuickDate(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Legal Entity (Company) *</label>
                  <select
                    className="select"
                    value={quickCompanyId}
                    onChange={(e) => setQuickCompanyId(e.target.value)}
                    required
                  >
                    <option value="">Select Company</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.isCoreBranch ? '★ Core' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Amount (₹ INR) *</label>
                  <input
                    type="number"
                    className="input mono"
                    placeholder="0.00"
                    value={quickAmount}
                    onChange={(e) => setQuickAmount(e.target.value)}
                    min="0"
                    step="any"
                    required
                    style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--success)' }}
                  />
                </div>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Income Source / Client *</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. Enterprise Client SaaS Retainer, Stripe Payout"
                    value={quickSource}
                    onChange={(e) => setQuickSource(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Notes / Reference No.</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. Invoice #INV-2026-081"
                    value={quickNotes}
                    onChange={(e) => setQuickNotes(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={(e) => handleQuickSubmit(e, true)}
                  disabled={saving}
                >
                  Save & Add Another
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving} style={{ background: 'var(--success)' }}>
                  <Check size={16} /> {saving ? 'Recording...' : 'Record Inflow'}
                </button>
              </div>
            </form>
          )}

          {/* Batch Mode */}
          {entryMode === 'batch' && (
            <form onSubmit={handleSubmitBatch} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Total Batch Inflow: <strong className="mono" style={{ color: 'var(--success)', fontSize: '1.15rem' }}>₹{runningTotal.toLocaleString('en-IN')}</strong>
                </span>
                <button type="button" className="btn btn-secondary btn-sm" onClick={handleAddRow}>
                  <Plus size={14} /> Add Row
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {rows.map((row, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '130px 180px 1fr 140px 1fr 40px',
                      gap: '0.65rem',
                      alignItems: 'center',
                      background: 'var(--bg-surface)',
                      padding: '0.65rem 0.85rem',
                      borderRadius: 'var(--radius)',
                      border: '1px solid var(--border-color)',
                    }}
                  >
                    <input
                      type="date"
                      className="input"
                      value={row.date}
                      onChange={(e) => handleRowChange(idx, 'date', e.target.value)}
                      required
                    />

                    <select
                      className="select"
                      value={row.companyId}
                      onChange={(e) => handleRowChange(idx, 'companyId', e.target.value)}
                      required
                    >
                      <option value="">Select Company</option>
                      {companies.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.isCoreBranch ? '★ Core' : ''}
                        </option>
                      ))}
                    </select>

                    <input
                      type="text"
                      className="input"
                      placeholder="Income Source / Client"
                      value={row.source}
                      onChange={(e) => handleRowChange(idx, 'source', e.target.value)}
                      required
                    />

                    <input
                      type="number"
                      className="input mono"
                      placeholder="₹ Amount"
                      value={row.amount}
                      onChange={(e) => handleRowChange(idx, 'amount', e.target.value)}
                      min="0"
                      step="any"
                      required
                    />

                    <input
                      type="text"
                      className="input"
                      placeholder="Notes (Optional)"
                      value={row.notes}
                      onChange={(e) => handleRowChange(idx, 'notes', e.target.value)}
                    />

                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleRemoveRow(idx)}
                      disabled={rows.length === 1}
                      style={{ padding: '0.4rem', color: 'var(--danger)' }}
                      title="Delete row"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={handleAddRow}>
                  <Plus size={14} /> Add Row
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving} style={{ background: 'var(--success)' }}>
                  <Check size={16} /> {saving ? 'Saving...' : `Save ${rows.length} Income(s)`}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Filters Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ position: 'relative', width: '100%', maxWidth: '360px' }}>
          <Search size={15} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="input"
            style={{ paddingLeft: '36px' }}
            placeholder="Search income source, client, notes..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Showing <strong>{incomes.length}</strong> of <strong>{totalCount}</strong> receipts
        </span>
      </div>

      {/* Incomes Table */}
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Company</th>
              <th>Income Source</th>
              <th>Reference / Notes</th>
              <th>Amount</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {incomes.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-muted)' }}>
                  <DollarSign size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.4 }} />
                  <p style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.25rem' }}>No income records found</p>
                  <p style={{ fontSize: '0.85rem' }}>Click "+ Record Revenue" above to log your first receipt</p>
                </td>
              </tr>
            ) : (
              incomes.map((inc) => {
                const comp = companies.find((c) => c.id === inc.companyId);

                return (
                  <tr key={inc.id}>
                    <td className="mono" style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                      {new Date(inc.date).toLocaleDateString()}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{comp?.name || '—'}</span>
                        {comp?.isCoreBranch && (
                          <span className="badge badge-success" style={{ fontSize: '0.62rem', padding: '0.08rem 0.35rem' }}>
                            Core
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ fontWeight: 600, color: 'var(--text-main)' }}>{inc.source}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.825rem' }}>{inc.notes || '—'}</td>
                    <td>
                      <span className="mono" style={{ fontWeight: 800, color: 'var(--success)', fontSize: '0.95rem' }}>
                        +₹{Number(inc.amount).toLocaleString('en-IN')}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleDelete(inc.id)}
                        title="Delete Income Record"
                        style={{ padding: '0.32rem 0.5rem', color: 'var(--danger)' }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', alignItems: 'center' }}>
          <button
            className="btn btn-secondary btn-sm"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            Prev
          </button>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Page <strong>{page}</strong> of <strong>{totalPages}</strong>
          </span>
          <button
            className="btn btn-secondary btn-sm"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default IncomePage;
