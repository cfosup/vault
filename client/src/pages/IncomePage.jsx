import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useLazyQuery } from '@apollo/client/react';
import {
  Plus,
  Pencil,
  RotateCcw,
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
  AlertCircle,
} from 'lucide-react';
import { GET_INCOMES, GET_INCOME, GET_EXPENSES_BY_INCOME, GET_COMPANIES } from '../graphql/queries';
import { CREATE_INCOMES, UPDATE_INCOME, DELETE_INCOME, RESTORE_INCOME } from '../graphql/mutations';
import { canWriteModule, canDeleteKind } from '../utils/access';
import { useAuthStore } from '../store/authStore';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { CountUp, RollingAmount } from '../components/common/CountUp';
import { formatDisplayDate } from '../utils/dateUtils';

export const IncomePage = () => {
  const { activeCompanyId, token, user } = useAuthStore();
  const canWrite = canWriteModule(user, 'income');
  const canDelete = canDeleteKind(user, 'income');
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
  const [makeRecurring, setMakeRecurring] = useState(false);

  // Delete Confirmation Modal State
  const [incomeToDelete, setIncomeToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);
  const [editingIncomeId, setEditingIncomeId] = useState(null);
  const [expandedIncomeId, setExpandedIncomeId] = useState(null);
  const [linkedExpenses, setLinkedExpenses] = useState([]);

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
        includeDeleted: showDeleted,
      },
      page,
      limit: 15,
    },
  });

  const [createIncomes, { loading: saving }] = useMutation(CREATE_INCOMES);
  const [updateIncome] = useMutation(UPDATE_INCOME);
  const [deleteIncome] = useMutation(DELETE_INCOME);
  const [restoreIncome] = useMutation(RESTORE_INCOME);
  const [loadIncome] = useLazyQuery(GET_INCOME, { fetchPolicy: 'network-only' });
  const [loadLinked] = useLazyQuery(GET_EXPENSES_BY_INCOME, { fetchPolicy: 'network-only' });

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
  const blankIncomeFields = () => {
    setEditingIncomeId(null);
    setMakeRecurring(false);
    setQuickDate(new Date().toISOString().split('T')[0]);
    setQuickSource('');
    setQuickAmount('');
    setQuickNotes('');
    setQuickCompanyId(activeCompanyId || companies[0]?.id || '');
  };

  const openFreshIncome = () => {
    setEntryMode('quick');
    blankIncomeFields();
    setShowForm(true);
  };

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
      makeRecurring: makeRecurring && !editingIncomeId,
    };

    try {
      if (editingIncomeId) {
        await updateIncome({ variables: { id: editingIncomeId, input } });
      } else {
        await createIncomes({ variables: { inputs: [input] } });
      }
      refetch();
      if (addAnother) {
        blankIncomeFields();
      } else {
        setShowForm(false);
        blankIncomeFields();
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

  const confirmDeleteIncome = async () => {
    if (!incomeToDelete) return;
    setIsDeleting(true);
    try {
      await deleteIncome({ variables: { id: incomeToDelete } });
      refetch();
      setIncomeToDelete(null);
    } catch (err) {
      alert('Error deleting: ' + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExport = () => {
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
    let url = `${baseUrl}/export/income?token=${token}`;
    if (activeCompanyId) url += `&companyId=${activeCompanyId}`;
    window.open(url, '_blank');
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <h1 style={{ fontSize: '1.65rem' }}>Income</h1>
            <span className="badge badge-success">
              {totalCount} recorded
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Add money coming in, then review it by company or export it.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => { setShowDeleted((v) => !v); setPage(1); }}>
            {showDeleted ? 'Show active' : 'Show deleted'}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={handleExport}>
            <Download size={14} /> Export CSV
          </button>
          {canWrite && (
          <button
            className="btn btn-primary btn-sm"
            onClick={() => {
              if (showForm) {
                setShowForm(false);
                blankIncomeFields();
                return;
              }
              openFreshIncome();
            }}
          >
            {showForm ? <X size={15} /> : <Plus size={15} />}
            {showForm ? 'Close' : 'Add income'}
          </button>
          )}
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
              Received on this page
            </span>
            {loading ? (
              <RollingAmount />
            ) : (
              <CountUp value={totalInflow} className="mono" style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--success)' }} />
            )}
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
              Average amount
            </span>
            {loading ? (
              <RollingAmount />
            ) : (
              <CountUp value={avgInflow} className="mono" style={{ fontSize: '1.45rem', fontWeight: 800 }} />
            )}
          </div>
        </div>

        <div className="card" style={{ padding: '1.1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: 'var(--radius)',
              background: 'var(--info-bg)',
              color: 'var(--info)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Building size={22} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Company
            </span>
            <span style={{ fontSize: '1.1rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {activeCompany ? activeCompany.name : 'All companies'}
            </span>
          </div>
        </div>
      </div>

      {/* Entry Form */}
      {showForm && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', border: '1.5px solid var(--primary)' }}>
          {/* Form Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', paddingBottom: '0.85rem', borderBottom: '1px solid var(--border-color)' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem' }}>{editingIncomeId ? 'Edit income' : 'New income'}</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {editingIncomeId ? 'Update this receipt.' : 'This starts blank. Add who paid you and how much.'}
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
                  background: entryMode === 'quick' ? 'var(--primary)' : 'transparent',
                  color: entryMode === 'quick' ? 'var(--primary-foreground)' : 'var(--text-muted)',
                  transition: 'all 0.15s ease',
                }}
              >
                <Zap size={14} /> One receipt
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
                  background: entryMode === 'batch' ? 'var(--primary)' : 'transparent',
                  color: entryMode === 'batch' ? 'var(--primary-foreground)' : 'var(--text-muted)',
                  transition: 'all 0.15s ease',
                }}
              >
                <TableProperties size={14} /> Several at once
              </button>
            </div>
          </div>

          {/* Quick Single Entry */}
          {entryMode === 'quick' && (
            <form onSubmit={(e) => handleQuickSubmit(e, false)} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="grid-3">
                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input
                    type="date"
                    className="input"
                    value={quickDate}
                    onChange={(e) => setQuickDate(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Company</label>
                  <select
                    className="select"
                    value={quickCompanyId}
                    onChange={(e) => setQuickCompanyId(e.target.value)}
                    required
                  >
                    <option value="">Select Company</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Amount</label>
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
                  <label className="form-label">Who paid you</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. Acme Corp Retainer, Seed Round, Consulting Fee"
                    value={quickSource}
                    onChange={(e) => setQuickSource(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Note</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. Milestone 2 deliverable payment"
                    value={quickNotes}
                    onChange={(e) => setQuickNotes(e.target.value)}
                  />
                </div>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.85rem' }}>
                <input type="checkbox" checked={makeRecurring} onChange={(event) => setMakeRecurring(event.target.checked)} disabled={!!editingIncomeId} />
                Repeat this income every month on this date
              </label>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={(e) => handleQuickSubmit(e, true)}
                  disabled={saving}
                >
                  Save & Add Another
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  <Check size={16} /> {saving ? 'Saving...' : editingIncomeId ? 'Save changes' : 'Save income'}
                </button>
              </div>
            </form>
          )}

          {/* Batch Grid Entry */}
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

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
                {rows.map((row, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '140px 180px 220px 140px 1fr 40px',
                      gap: '0.6rem',
                      alignItems: 'center',
                      background: 'var(--bg-surface)',
                      padding: '0.65rem 0.85rem',
                      borderRadius: 'var(--radius)',
                      border: '1px solid var(--border-color)',
                      minWidth: '820px',
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
                      <option value="">Company</option>
                      {companies.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>

                    <input
                      type="text"
                      className="input"
                      placeholder="Source / Client"
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
                      placeholder="Notes (optional)"
                      value={row.notes}
                      onChange={(e) => handleRowChange(idx, 'notes', e.target.value)}
                    />

                    <button
                      type="button"
                      className="btn btn-secondary btn-icon"
                      onClick={() => handleRemoveRow(idx)}
                      disabled={rows.length === 1}
                      style={{ color: 'var(--danger)' }}
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
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  <Check size={16} /> {saving ? 'Saving...' : `Save ${rows.length} income`}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Search Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ position: 'relative', width: '100%', maxWidth: '360px' }}>
          <Search size={15} style={{ position: 'absolute', left: '12px', top: '11px', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="input"
            style={{ paddingLeft: '36px' }}
            placeholder="Search source or notes..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <span style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
          Showing <strong>{incomes.length}</strong> of <strong>{totalCount}</strong> receipts
        </span>
      </div>

      {/* Revenue Table */}
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Company</th>
              <th>Source / Client</th>
              <th>Invoice Notes</th>
              <th>Amount</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 4 }, (_, index) => (
                <tr key={`loading-${index}`}>
                  <td colSpan="4"><span className="field-hint">Loading income</span></td>
                  <td><RollingAmount prefix="+₹" /></td>
                  <td />
                </tr>
              ))
            ) : incomes.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-muted)' }}>
                  <div className="empty-state">
                    <div className="empty-icon"><TrendingUp size={24} /></div>
                    <div className="empty-title">No revenue records found</div>
                    <div className="empty-desc">Use Add income to record the first payment you received.</div>
                  </div>
                </td>
              </tr>
            ) : (
              incomes.map((inc) => {
                const comp = companies.find((c) => c.id === inc.companyId);

                return (
                  <React.Fragment key={inc.id}>
                  <tr>
                    <td className="mono" style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                      {formatDisplayDate(inc.date)}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{comp?.name || '—'}</span>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{inc.source}</span>
                    </td>
                    <td style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
                      {inc.notes || '—'}
                    </td>
                    <td>
                      <CountUp
                        value={inc.amount}
                        prefix="+₹"
                        duration={650}
                        className="mono"
                        style={{ fontWeight: 800, color: 'var(--success)', fontSize: '0.95rem' }}
                      />
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn btn-secondary btn-icon"
                        title="Linked expenses"
                        onClick={async () => {
                          if (expandedIncomeId === inc.id) {
                            setExpandedIncomeId(null);
                            return;
                          }
                          const res = await loadLinked({ variables: { incomeId: inc.id } });
                          setLinkedExpenses(res.data?.expensesByIncome || []);
                          setExpandedIncomeId(inc.id);
                        }}
                      >
                        <DollarSign size={13} />
                      </button>
                      {canWrite && showDeleted && (
                        <button
                          className="btn btn-secondary btn-icon"
                          title="Restore income"
                          onClick={async () => {
                            await restoreIncome({ variables: { id: inc.id } });
                            refetch();
                          }}
                        >
                          <RotateCcw size={13} />
                        </button>
                      )}
                      {canWrite && !showDeleted && (
                      <button
                        className="btn btn-secondary btn-icon"
                        title="Edit income"
                        onClick={async () => {
                          const res = await loadIncome({ variables: { id: inc.id } });
                          const record = res.data?.income || inc;
                          setEditingIncomeId(record.id);
                          setQuickDate((record.date || '').slice(0, 10));
                          setQuickCompanyId(record.companyId || '');
                          setQuickSource(record.source || '');
                          setQuickAmount(String(record.amount ?? ''));
                          setQuickNotes(record.notes || '');
                          setShowForm(true);
                          setEntryMode('quick');
                        }}
                      >
                        <Pencil size={13} />
                      </button>
                      )}
                      {canDelete && !showDeleted && (
                      <button
                        className="btn btn-secondary btn-icon"
                        onClick={() => setIncomeToDelete(inc.id)}
                        title="Delete Income Record"
                        style={{ color: 'var(--danger)' }}
                      >
                        <Trash2 size={13} />
                      </button>
                      )}
                    </td>
                  </tr>
                  {expandedIncomeId === inc.id && (
                    <tr>
                      <td colSpan={6} style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {linkedExpenses.length === 0
                          ? 'No expenses are linked to this receipt.'
                          : linkedExpenses.map((exp) => `${exp.vendor || exp.categoryName}: ₹${Number(exp.amount).toLocaleString('en-IN')}`).join(' · ')}
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
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

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!incomeToDelete}
        title="Delete Revenue Record"
        message="Are you sure you want to permanently delete this revenue receipt from the ledger? This action cannot be undone."
        confirmText="Delete Revenue"
        cancelText="Keep"
        variant="danger"
        loading={isDeleting}
        onConfirm={confirmDeleteIncome}
        onCancel={() => setIncomeToDelete(null)}
      />
    </div>
  );
};

export default IncomePage;
