import React, { useState, useMemo } from 'react';
import { useQuery } from '@apollo/client/react';
import {
  TrendingDown,
  TrendingUp,
  Wallet,
  Receipt,
  Building2,
  Download,
  RefreshCw,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Info,
  CreditCard,
  Layers,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Zap,
  ChevronDown,
  ChevronUp,
  DollarSign,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from 'recharts';
import { useAuthStore } from '../store/authStore';
import { formatDisplayDate } from '../utils/dateUtils';
import {
  GET_DASHBOARD_SUMMARY,
  GET_CATEGORY_BREAKDOWN,
  GET_MONTHLY_TREND,
  GET_INCOME_EXPENSE_TREND,
  GET_TOP_VENDORS,
  GET_PAYMENT_METHOD_BREAKDOWN,
  GET_EXPENSES,
  GET_COMPANIES,
  GET_COMPANY_SPEND_BREAKDOWN,
  GET_COMPANY_INCOME_USAGE,
} from '../graphql/queries';

// Generic corporate data visualization palette (standard finance, no neon AI violet/fuchsia)
const CATEGORY_COLORS = [
  '#2563eb', // Corporate Blue
  '#0284c7', // Sky / Cyan
  '#16a34a', // Forest Green
  '#d97706', // Amber
  '#dc2626', // Crimson Red
  '#475569', // Slate Gray
  '#0d9488', // Teal
  '#ea580c', // Orange
  '#334155', // Deep Slate
  '#64748b', // Steel Gray
];

// Section Component for Company Income Usage & Expense Linking Breakdown
const CompanyIncomeUsageSection = ({ companies, initialCompanyId }) => {
  const [selectedCompanyId, setSelectedCompanyId] = useState(
    initialCompanyId || companies[0]?.id || ''
  );
  const [expandedEntryId, setExpandedEntryId] = useState(null);

  React.useEffect(() => {
    if (initialCompanyId && !selectedCompanyId) {
      setSelectedCompanyId(initialCompanyId);
    }
  }, [initialCompanyId, selectedCompanyId]);

  const { data, loading, error, refetch } = useQuery(GET_COMPANY_INCOME_USAGE, {
    variables: { companyId: selectedCompanyId },
    skip: !selectedCompanyId,
    fetchPolicy: 'cache-and-network',
  });

  const report = data?.companyIncomeUsage;

  const toggleExpand = (entryId) => {
    setExpandedEntryId((prev) => (prev === entryId ? null : entryId));
  };

  if (companies.length === 0) {
    return (
      <div className="card" style={{ padding: '3.5rem 1rem', textAlign: 'center' }}>
        <div className="empty-state">
          <div className="empty-icon"><Building2 size={24} /></div>
          <div className="empty-title">No companies found</div>
          <div className="empty-desc">Create a corporate branch or entity to track income usage.</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Control Bar: Company Selector & Refresh */}
      <div
        className="card"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          padding: '1rem 1.25rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>
            Select Entity:
          </span>
          <select
            className="select"
            value={selectedCompanyId}
            onChange={(e) => {
              setSelectedCompanyId(e.target.value);
              setExpandedEntryId(null);
            }}
            style={{ minWidth: '220px', fontWeight: 600 }}
          >
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {report && (
            <span className="badge badge-primary" style={{ fontSize: '0.75rem' }}>
              {report.companyName}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => refetch()}
            disabled={loading}
            title="Refresh Income Usage"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {loading && !report ? (
        <div className="card" style={{ padding: '3.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 0.75rem auto' }} />
          <div>Loading Company Income Usage metrics...</div>
        </div>
      ) : error ? (
        <div className="card" style={{ padding: '2rem', borderLeft: '4px solid var(--danger)', color: 'var(--danger)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
            <AlertCircle size={18} /> Error Loading Income Usage Data
          </div>
          <div style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>{error.message}</div>
        </div>
      ) : report ? (
        <>
          {/* Company-Level Overview KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            {/* Card 1: Total Income */}
            <div className="card glass-card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Total Income Received
                </span>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--success-bg)',
                    color: 'var(--success)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Wallet size={16} />
                </div>
              </div>
              <div className="mono" style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)' }}>
                ₹{Number(report.totalIncome).toLocaleString('en-IN')}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                {report.incomeCount} revenue entries recorded
              </div>
            </div>

            {/* Card 2: Total Utilized */}
            <div className="card glass-card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Total Amount Utilized
                </span>
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
                  <Receipt size={16} />
                </div>
              </div>
              <div className="mono" style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)' }}>
                ₹{Number(report.totalUtilized).toLocaleString('en-IN')}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                {report.utilizationPercentage.toFixed(1)}% of total received income
              </div>
            </div>

            {/* Card 3: Remaining Balance */}
            <div className="card glass-card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Remaining Balance
                </span>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--success-bg)',
                    color: 'var(--success)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <CheckCircle2 size={16} />
                </div>
              </div>
              <div className="mono" style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--success)' }}>
                ₹{Number(report.remainingBalance).toLocaleString('en-IN')}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                MAX(Income − Utilized, 0)
              </div>
            </div>

            {/* Card 4: Total Excess Spending */}
            <div className="card glass-card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Total Excess Spending
                </span>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: 'var(--radius-sm)',
                    background: report.totalExcessSpending > 0 ? 'var(--danger-bg)' : 'var(--bg-surface)',
                    color: report.totalExcessSpending > 0 ? 'var(--danger)' : 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <AlertCircle size={16} />
                </div>
              </div>
              <div
                className="mono"
                style={{
                  fontSize: '1.5rem',
                  fontWeight: 800,
                  color: report.totalExcessSpending > 0 ? 'var(--danger)' : 'var(--text-muted)',
                }}
              >
                ₹{Number(report.totalExcessSpending).toLocaleString('en-IN')}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                {report.totalExcessSpending > 0 ? 'Disbursements exceed allocated income' : 'No excess spending'}
              </div>
            </div>
          </div>

          {/* Unlinked Disbursements Context Banner */}
          {report.unlinkedExpenseCount > 0 && (
            <div
              className="card"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.75rem',
                padding: '0.85rem 1.15rem',
                borderLeft: '4px solid var(--border-color)',
                background: 'var(--bg-surface)',
                fontSize: '0.825rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Info size={16} style={{ color: 'var(--text-muted)' }} />
                <span>
                  <strong>{report.unlinkedExpenseCount} unlinked disbursement(s)</strong> totaling{' '}
                  <strong className="mono">₹{Number(report.unlinkedExpensesTotal).toLocaleString('en-IN')}</strong> exist for this company. Unlinked expenses are isolated and do not count against income entries.
                </span>
              </div>
            </div>
          )}

          {/* Income-Entry-Level Breakdown Table */}
          <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
                  Income Entry Breakdown
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Detailed utilization, balances, and linked disbursements for {report.companyName}
                </span>
              </div>
              <span className="badge badge-neutral" style={{ fontSize: '0.75rem' }}>
                {report.incomeEntries.length} Income Entries
              </span>
            </div>

            {report.incomeEntries.length === 0 ? (
              <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <div className="empty-state">
                  <div className="empty-icon"><Wallet size={24} /></div>
                  <div className="empty-title">No income entries recorded</div>
                  <div className="empty-desc">Record income for this company in the Income page to begin tracking utilization.</div>
                </div>
              </div>
            ) : (
              <div className="table-container">
                <table className="table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>Income Name / Source</th>
                      <th>Date</th>
                      <th>Original Amount</th>
                      <th>Total Utilized</th>
                      <th>Remaining Balance</th>
                      <th>Excess Spending</th>
                      <th>Utilization %</th>
                      <th style={{ textAlign: 'right' }}>Linked Expenses</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.incomeEntries.map((entry) => {
                      const isExpanded = expandedEntryId === entry.id;
                      const hasLinked = entry.linkedExpenses && entry.linkedExpenses.length > 0;

                      return (
                        <React.Fragment key={entry.id}>
                          <tr>
                            <td>
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.875rem' }}>
                                  {entry.source}
                                </span>
                                {entry.notes && (
                                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                    {entry.notes}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="mono" style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
                              {formatDisplayDate(entry.date)}
                            </td>
                            <td>
                              <span className="mono" style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.9rem' }}>
                                ₹{Number(entry.amount).toLocaleString('en-IN')}
                              </span>
                            </td>
                            <td>
                              <span className="mono" style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '0.9rem' }}>
                                ₹{Number(entry.totalUtilized).toLocaleString('en-IN')}
                              </span>
                            </td>
                            <td>
                              <span className="mono" style={{ fontWeight: 700, color: 'var(--success)', fontSize: '0.9rem' }}>
                                ₹{Number(entry.remainingBalance).toLocaleString('en-IN')}
                              </span>
                            </td>
                            <td>
                              <span
                                className="mono"
                                style={{
                                  fontWeight: 700,
                                  color: entry.excessSpending > 0 ? 'var(--danger)' : 'var(--text-muted)',
                                  fontSize: '0.9rem',
                                }}
                              >
                                {entry.excessSpending > 0
                                  ? `₹${Number(entry.excessSpending).toLocaleString('en-IN')}`
                                  : '₹0'}
                              </span>
                            </td>
                            <td style={{ minWidth: '120px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span
                                  className="mono"
                                  style={{
                                    fontSize: '0.825rem',
                                    fontWeight: 700,
                                    color:
                                      entry.utilizationPercentage > 100
                                        ? 'var(--danger)'
                                        : entry.utilizationPercentage > 80
                                        ? '#d97706'
                                        : 'var(--success)',
                                  }}
                                >
                                  {entry.utilizationPercentage.toFixed(1)}%
                                </span>
                              </div>
                              <div
                                style={{
                                  width: '100%',
                                  height: '6px',
                                  background: 'var(--bg-surface)',
                                  borderRadius: 'var(--radius-full)',
                                  overflow: 'hidden',
                                  marginTop: '4px',
                                  boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.1)',
                                }}
                              >
                                <div
                                  style={{
                                    width: `${Math.min(entry.utilizationPercentage, 100)}%`,
                                    height: '100%',
                                    background:
                                      entry.utilizationPercentage > 100
                                        ? 'linear-gradient(90deg, #ef4444 0%, #dc2626 100%)'
                                        : entry.utilizationPercentage > 80
                                        ? 'linear-gradient(90deg, #f59e0b 0%, #d97706 100%)'
                                        : 'linear-gradient(90deg, #10b981 0%, #059669 100%)',
                                    borderRadius: 'var(--radius-full)',
                                    transition: 'width 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                                    boxShadow: '0 0 4px rgba(0,0,0,0.15)',
                                  }}
                                />
                              </div>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => toggleExpand(entry.id)}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem' }}
                              >
                                {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                {entry.linkedExpenseCount} Expense(s)
                              </button>
                            </td>
                          </tr>

                          {/* Expanded Associated Expenses Sub-Table */}
                          {isExpanded && (
                            <tr>
                              <td colSpan="8" style={{ padding: '0.75rem 1rem', background: 'var(--bg-surface)' }}>
                                <div
                                  style={{
                                    border: '1px solid var(--border-color)',
                                    borderRadius: 'var(--radius)',
                                    padding: '0.85rem',
                                    background: 'var(--bg-card)',
                                  }}
                                >
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)' }}>
                                      Expenses Linked to "{entry.source}" ({entry.linkedExpenseCount})
                                    </span>
                                    <span className="mono" style={{ fontSize: '0.78rem', color: 'var(--primary)', fontWeight: 600 }}>
                                      Total Outlaid: ₹{Number(entry.totalUtilized).toLocaleString('en-IN')}
                                    </span>
                                  </div>

                                  {!hasLinked ? (
                                    <div style={{ padding: '1.25rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                      No expenses are currently linked to this income entry. To link an expense, choose this entry in the "Linked Revenue" selector on the Expenses page.
                                    </div>
                                  ) : (
                                    <table className="table" style={{ fontSize: '0.8rem', width: '100%' }}>
                                      <thead>
                                        <tr>
                                          <th>Date</th>
                                          <th>Payee / Vendor</th>
                                          <th>Category</th>
                                          <th>Subcategory</th>
                                          <th>Notes</th>
                                          <th style={{ textAlign: 'right' }}>Amount</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {entry.linkedExpenses.map((exp) => (
                                          <tr key={exp.id}>
                                            <td className="mono" style={{ color: 'var(--text-muted)' }}>
                                              {formatDisplayDate(exp.date)}
                                            </td>
                                            <td style={{ fontWeight: 600 }}>{exp.vendor || '—'}</td>
                                            <td>{exp.categoryName}</td>
                                            <td>
                                              {exp.subcategory ? (
                                                <span className="badge badge-neutral" style={{ fontSize: '0.68rem' }}>
                                                  {exp.subcategory}
                                                </span>
                                              ) : (
                                                '—'
                                              )}
                                            </td>
                                            <td style={{ color: 'var(--text-muted)' }}>{exp.notes || '—'}</td>
                                            <td style={{ textAlign: 'right' }}>
                                              <span className="mono" style={{ fontWeight: 700, color: 'var(--danger)' }}>
                                                -₹{Number(exp.amount).toLocaleString('en-IN')}
                                              </span>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
};

export const DashboardPage = () => {
  const { activeCompanyId, setActiveCompanyId, token, user } = useAuthStore();
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'income_usage'
  const [datePreset, setDatePreset] = useState('this_month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  // Calculate dates based on preset
  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    if (datePreset === 'this_month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { startDate: start.toISOString() };
    }
    if (datePreset === 'last_month') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      return { startDate: start.toISOString(), endDate: end.toISOString() };
    }
    if (datePreset === 'last_3') {
      const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      return { startDate: start.toISOString() };
    }
    if (datePreset === 'ytd') {
      const start = new Date(now.getFullYear(), 0, 1);
      return { startDate: start.toISOString() };
    }
    if (datePreset === 'custom' && (customStart || customEnd)) {
      return {
        startDate: customStart ? new Date(customStart).toISOString() : undefined,
        endDate: customEnd ? new Date(`${customEnd}T23:59:59`).toISOString() : undefined,
      };
    }
    return {};
  }, [datePreset, customStart, customEnd]);

  const filterInput = useMemo(() => {
    const filter = {};
    if (activeCompanyId) filter.companyId = activeCompanyId;
    if (startDate) filter.startDate = startDate;
    if (endDate) filter.endDate = endDate;
    return filter;
  }, [activeCompanyId, startDate, endDate]);

  // Queries
  const { data: compData } = useQuery(GET_COMPANIES);
  const companies = compData?.companies || [];
  const activeCompany = companies.find((c) => c.id === activeCompanyId);

  const {
    data: summaryData,
    loading: sumLoading,
    refetch: refetchSummary,
  } = useQuery(GET_DASHBOARD_SUMMARY, {
    variables: { filter: filterInput },
    fetchPolicy: 'cache-and-network',
  });

  const {
    data: catData,
    loading: catLoading,
    refetch: refetchCats,
  } = useQuery(GET_CATEGORY_BREAKDOWN, {
    variables: { filter: filterInput },
    fetchPolicy: 'cache-and-network',
  });

  const {
    data: trendData,
    loading: trendLoading,
    refetch: refetchTrend,
  } = useQuery(GET_INCOME_EXPENSE_TREND, {
    variables: { months: 6, companyId: activeCompanyId || null },
    fetchPolicy: 'cache-and-network',
  });

  const {
    data: vendorData,
    loading: vendorLoading,
    refetch: refetchVendors,
  } = useQuery(GET_TOP_VENDORS, {
    variables: { limit: 5, companyId: activeCompanyId || null },
    fetchPolicy: 'cache-and-network',
  });

  const {
    data: pmData,
    loading: pmLoading,
    refetch: refetchPM,
  } = useQuery(GET_PAYMENT_METHOD_BREAKDOWN, {
    variables: { filter: filterInput },
    fetchPolicy: 'cache-and-network',
  });

  const {
    data: recentData,
    loading: recentLoading,
    refetch: refetchRecent,
  } = useQuery(GET_EXPENSES, {
    variables: {
      filter: { companyId: activeCompanyId || null },
      page: 1,
      limit: 5,
    },
    fetchPolicy: 'cache-and-network',
  });

  const {
    data: companySpendData,
    loading: companySpendLoading,
    refetch: refetchCompanySpend,
  } = useQuery(GET_COMPANY_SPEND_BREAKDOWN, {
    variables: { filter: { startDate, endDate } },
    fetchPolicy: 'cache-and-network',
  });

  const handleRefreshAll = () => {
    refetchSummary();
    refetchCats();
    refetchTrend();
    refetchVendors();
    refetchPM();
    refetchRecent();
    refetchCompanySpend();
  };

  const summary = summaryData?.dashboardSummary || {
    totalIncome: 0,
    totalExpenses: 0,
    netBalance: 0,
    topCategory: null,
    topVendor: null,
    expenseCount: 0,
    incomeCount: 0,
  };

  const categoryBreakdown = catData?.categoryBreakdown || [];
  const incomeVsExpense = trendData?.incomeVsExpenseTrend || [];
  const topVendors = vendorData?.topVendors || [];
  const recentTransactions = recentData?.expenses?.expenses || [];
  const companySpend = companySpendData?.companySpendBreakdown || [];

  // Export CSV
  const handleExport = (type = 'expenses') => {
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
    let url = `${baseUrl}/export/${type}?token=${token}`;
    if (activeCompanyId) url += `&companyId=${activeCompanyId}`;
    if (startDate) url += `&startDate=${startDate}`;
    if (endDate) url += `&endDate=${endDate}`;
    window.open(url, '_blank');
  };

  // Smart financial insight generator
  const insights = useMemo(() => {
    const list = [];
    if (summary.totalIncome > 0 && summary.totalExpenses > 0) {
      const margin = ((summary.netBalance / summary.totalIncome) * 100).toFixed(1);
      if (summary.netBalance >= 0) {
        list.push({
          type: 'positive',
          text: `Positive operating cash flow with a ${margin}% margin. Net retained capital: ₹${summary.netBalance.toLocaleString('en-IN')}`,
        });
      } else {
        list.push({
          type: 'warning',
          text: `Operating at a cash deficit. Total disbursements exceed incoming revenue by ₹${Math.abs(summary.netBalance).toLocaleString('en-IN')}`,
        });
      }
    }
    if (categoryBreakdown.length > 0) {
      const top = categoryBreakdown[0];
      list.push({
        type: 'info',
        text: `Primary cost center: "${top.categoryName}" accounts for ${top.percentage}% of total expenses (₹${top.amount.toLocaleString('en-IN')})`,
      });
    }
    if (companySpend.length > 1) {
      const topComp = companySpend[0];
      list.push({
        type: 'info',
        text: `Dominant operational branch: "${topComp.companyName}" with ₹${topComp.expenses.toLocaleString('en-IN')} outlaid`,
      });
    }
    return list;
  }, [summary, categoryBreakdown, companySpend]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Hero Header & Filter Bar */}
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
            <h1 style={{ fontSize: '1.65rem', fontWeight: 800 }}>Financial Intelligence</h1>
            <span className="badge badge-primary">
              {activeCompany ? activeCompany.name : 'All Consolidated'}
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Multi-entity treasury overview, cash burn rate, and chart of accounts distribution
          </p>
        </div>

        {/* Toolbar Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          {/* Timeframe Pill Segment */}
          <div className="timeframe-pill-container">
            {[
              { id: 'this_month', label: 'This Month' },
              { id: 'last_month', label: 'Last Month' },
              { id: 'last_3', label: 'Quarter' },
              { id: 'ytd', label: 'YTD' },
              { id: 'all', label: 'All Time' },
            ].map((preset) => (
              <button
                key={preset.id}
                onClick={() => setDatePreset(preset.id)}
                style={{
                  border: 'none',
                  background: datePreset === preset.id ? 'var(--primary)' : 'transparent',
                  color: datePreset === preset.id ? 'var(--primary-foreground)' : 'var(--text-muted)',
                  padding: '0.35rem 0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.785rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: 'none',
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <button
            className="btn btn-secondary btn-icon"
            onClick={handleRefreshAll}
            title="Refresh Live Data"
          >
            <RefreshCw size={14} className={sumLoading ? 'animate-spin' : ''} />
          </button>

          <button className="btn btn-primary btn-sm" onClick={() => handleExport('expenses')}>
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      {/* Dashboard Section Switcher */}
      <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center' }}>
        <button
          type="button"
          className={`btn ${activeTab === 'overview' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('overview')}
          style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 600, fontSize: '0.85rem' }}
        >
          <Layers size={15} /> Executive Overview
        </button>
        <button
          type="button"
          className={`btn ${activeTab === 'income_usage' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('income_usage')}
          style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 600, fontSize: '0.85rem' }}
        >
          <TrendingUp size={15} /> Company Income Usage
        </button>
      </div>

      {activeTab === 'income_usage' ? (
        <CompanyIncomeUsageSection companies={companies} initialCompanyId={activeCompanyId} />
      ) : (
        <>
          {/* Smart Business Insights Strip */}
      {insights.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.85rem' }}>
          {insights.map((ins, i) => (
            <div
              key={i}
              className="card"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.85rem 1.15rem',
                fontSize: '0.825rem',
                borderLeft: `4px solid ${
                  ins.type === 'positive'
                    ? 'var(--success)'
                    : ins.type === 'warning'
                    ? 'var(--danger)'
                    : 'var(--primary)'
                }`,
              }}
            >
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: 'var(--radius-full)',
                  background:
                    ins.type === 'positive'
                      ? 'var(--success-bg)'
                      : ins.type === 'warning'
                      ? 'var(--danger-bg)'
                      : 'var(--primary-light)',
                  color:
                    ins.type === 'positive'
                      ? 'var(--success)'
                      : ins.type === 'warning'
                      ? 'var(--danger)'
                      : 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Info size={14} />
              </div>
              <span style={{ color: 'var(--text-main)', lineHeight: 1.45, fontWeight: 500 }}>
                {ins.text}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Executive KPI Cards */}
      <div className="grid-4">
        {/* Outflow / Expenses */}
        <div className="card kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Total Outflow</span>
            <div className="kpi-icon-wrap" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>
              <TrendingDown size={18} />
            </div>
          </div>
          <div className="kpi-value mono" style={{ color: 'var(--danger)' }}>
            ₹{summary.totalExpenses.toLocaleString('en-IN')}
          </div>
          <div className="kpi-footer">
            <span>{summary.expenseCount} disbursements</span>
            <span className="badge badge-danger">Outlay</span>
          </div>
        </div>

        {/* Inflow / Revenue */}
        <div className="card kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Total Inflow</span>
            <div className="kpi-icon-wrap" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}>
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="kpi-value mono" style={{ color: 'var(--success)' }}>
            ₹{summary.totalIncome.toLocaleString('en-IN')}
          </div>
          <div className="kpi-footer">
            <span>{summary.incomeCount} receipts</span>
            <span className="badge badge-success">Inflow</span>
          </div>
        </div>

        {/* Net Operating Balance */}
        <div className="card kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Net Operating Balance</span>
            <div className="kpi-icon-wrap" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
              <Wallet size={18} />
            </div>
          </div>
          <div
            className="kpi-value mono"
            style={{ color: summary.netBalance >= 0 ? 'var(--primary)' : 'var(--danger)' }}
          >
            ₹{summary.netBalance.toLocaleString('en-IN')}
          </div>
          <div className="kpi-footer">
            <span>{summary.netBalance >= 0 ? 'Cash Surplus' : 'Net Deficit'}</span>
            <span className={`badge ${summary.netBalance >= 0 ? 'badge-primary' : 'badge-danger'}`}>
              {summary.totalIncome > 0
                ? `${((summary.netBalance / summary.totalIncome) * 100).toFixed(0)}% Margin`
                : '—'}
            </span>
          </div>
        </div>

        {/* Dominant Cost Driver */}
        <div className="card kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">
              {!activeCompanyId && companySpend.length > 0 ? 'Lead Spending Branch' : 'Top Spend Category'}
            </span>
            <div className="kpi-icon-wrap" style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}>
              {!activeCompanyId && companySpend.length > 0 ? <Building2 size={18} /> : <Receipt size={18} />}
            </div>
          </div>
          <div
            style={{
              fontSize: '1.2rem',
              fontWeight: 700,
              fontFamily: 'inherit',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              color: 'var(--text-main)',
              marginTop: '0.2rem',
            }}
            title={!activeCompanyId && companySpend[0] ? companySpend[0].companyName : summary.topCategory || 'N/A'}
          >
            {!activeCompanyId && companySpend[0] ? companySpend[0].companyName : summary.topCategory || 'N/A'}
          </div>
          <div className="kpi-footer">
            <span>
              {!activeCompanyId && companySpend[0]
                ? `₹${companySpend[0].expenses.toLocaleString('en-IN')} (${companySpend[0].percentage}%)`
                : summary.topVendor
                ? `Vendor: ${summary.topVendor}`
                : 'No activity'}
            </span>
            <span className="badge badge-warning">Top Driver</span>
          </div>
        </div>
      </div>

      {/* Multi-Company Entity Breakdown Grid */}
      {(!activeCompanyId || companySpend.length > 0) && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Building2 size={18} style={{ color: 'var(--primary)' }} />
              <h2 style={{ fontSize: '1.15rem' }}>Legal Entity Financial Breakdown</h2>
              <span className="badge badge-neutral">{companySpend.length} Entities</span>
            </div>
            <span style={{ fontSize: '0.785rem', color: 'var(--text-muted)' }}>
              Click any entity card to focus workspace
            </span>
          </div>

          {companySpend.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon"><Building2 size={24} /></div>
              <div className="empty-title">No entity records found</div>
              <div className="empty-desc">No disbursements recorded for companies during this timeframe.</div>
            </div>
          ) : (
            <div className="dashboard-entity-grid">
              {/* Grouped Bar Chart of Entities */}
              <div style={{ minHeight: '260px', height: '260px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={companySpend} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                    <XAxis
                      dataKey="companyName"
                      stroke="var(--text-muted)"
                      fontSize={11}
                      tickLine={false}
                      interval={0}
                      tickFormatter={(val) => (val.length > 12 ? `${val.substring(0, 10)}…` : val)}
                    />
                    <YAxis
                      stroke="var(--text-muted)"
                      fontSize={11}
                      tickLine={false}
                      tickFormatter={(v) => (v >= 1000 ? `₹${(v / 1000).toFixed(0)}k` : `₹${v}`)}
                    />
                    <Tooltip
                      formatter={(val) => `₹${Number(val).toLocaleString('en-IN')}`}
                      contentStyle={{
                        background: 'var(--bg-card)',
                        borderColor: 'var(--border-color)',
                        borderRadius: '10px',
                        boxShadow: 'var(--shadow-lg)',
                        color: 'var(--text-main)',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '0.8rem', paddingTop: '8px' }} />
                    <Bar dataKey="income" name="Inflow" fill="#16a34a" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="expenses" name="Outflow" fill="#dc2626" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Entity Cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', overflowY: 'auto', maxHeight: '260px' }}>
                {companySpend.map((comp) => {
                  const isSelected = activeCompanyId === comp.companyId;
                  const isCore = companies.find((c) => c.id === comp.companyId)?.isCoreBranch;

                  return (
                    <div
                      key={comp.companyId}
                      onClick={() => setActiveCompanyId(isSelected ? null : comp.companyId)}
                      className="card-interactive"
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.45rem',
                        background: isSelected ? 'var(--primary-light)' : 'var(--bg-surface)',
                        border: isSelected ? '1.5px solid var(--primary)' : '1px solid var(--border-color)',
                        padding: '0.75rem 0.95rem',
                        borderRadius: 'var(--radius)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>{comp.companyName}</span>
                        </div>
                        <span className={`badge ${comp.netBalance >= 0 ? 'badge-success' : 'badge-danger'}`}>
                          Net: {comp.netBalance >= 0 ? '+' : ''}₹{comp.netBalance.toLocaleString('en-IN')}
                        </span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        <span>
                          Outflow: <strong className="mono" style={{ color: 'var(--danger)' }}>₹{comp.expenses.toLocaleString('en-IN')}</strong>
                        </span>
                        <span>{comp.percentage}% share</span>
                      </div>

                      <div style={{ height: '4px', background: 'var(--border-color)', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ width: `${comp.percentage}%`, height: '100%', background: 'var(--primary)' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Charts Row: Cash Flow Area Trend & Category Donut */}
      <div className="grid-2">
        {/* 6-Month Cash Flow Momentum (Area Chart) */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minHeight: '360px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '1.15rem' }}>Cash Flow Trend</h2>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>6-month revenue vs expenditure area</span>
            </div>
            {activeCompany && <span className="badge badge-neutral">{activeCompany.name}</span>}
          </div>

          {incomeVsExpense.length === 0 ? (
            <div className="empty-state" style={{ height: '260px' }}>
              <div className="empty-icon"><AreaChart size={24} /></div>
              <div className="empty-title">No trend data</div>
              <div className="empty-desc">No historical records available for the 6-month window.</div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={incomeVsExpense} margin={{ top: 15, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#16a34a" stopOpacity={0.12} />
                    <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#dc2626" stopOpacity={0.12} />
                    <stop offset="95%" stopColor="#dc2626" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                <YAxis
                  stroke="var(--text-muted)"
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={(v) => (v >= 1000 ? `₹${(v / 1000).toFixed(0)}k` : `₹${v}`)}
                />
                <Tooltip
                  formatter={(val) => `₹${Number(val).toLocaleString('en-IN')}`}
                  contentStyle={{
                    background: 'var(--bg-card)',
                    borderColor: 'var(--border-color)',
                    borderRadius: '8px',
                    boxShadow: 'var(--shadow-md)',
                    color: 'var(--text-main)',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '0.8rem' }} />
                <Area type="monotone" dataKey="income" name="Inflow" stroke="#16a34a" strokeWidth={2} fillOpacity={1} fill="url(#incomeGrad)" />
                <Area type="monotone" dataKey="expenses" name="Outflow" stroke="#dc2626" strokeWidth={2} fillOpacity={1} fill="url(#expenseGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Category Breakdown Donut */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minHeight: '360px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '1.15rem' }}>Spend by Category</h2>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Proportional allocation across chart of accounts</span>
            </div>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {categoryBreakdown.length} Accounts
            </span>
          </div>

          {categoryBreakdown.length === 0 ? (
            <div className="empty-state" style={{ height: '260px' }}>
              <div className="empty-icon"><Receipt size={24} /></div>
              <div className="empty-title">No categorized expenses</div>
              <div className="empty-desc">No expense records categorized during this timeframe.</div>
            </div>
          ) : (
            <div className="dashboard-donut-grid">
              <div style={{ height: '230px', width: '100%', position: 'relative' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryBreakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={3}
                      dataKey="amount"
                    >
                      {categoryBreakdown.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} stroke="var(--bg-card)" strokeWidth={2} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => `₹${Number(value).toLocaleString('en-IN')}`}
                      contentStyle={{
                        background: 'var(--bg-card)',
                        borderColor: 'var(--border-color)',
                        borderRadius: '10px',
                        boxShadow: 'var(--shadow-md)',
                        color: 'var(--text-main)',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Donut Center Readout */}
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    textAlign: 'center',
                    pointerEvents: 'none',
                  }}
                >
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Spend</span>
                  <div className="mono" style={{ fontSize: '0.95rem', fontWeight: 800 }}>
                    ₹{(summary.totalExpenses / 1000).toFixed(1)}k
                  </div>
                </div>
              </div>

              {/* Legend List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '230px', overflowY: 'auto' }}>
                {categoryBreakdown.map((cat, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', overflow: 'hidden' }}>
                      <span
                        style={{
                          width: '9px',
                          height: '9px',
                          borderRadius: '3px',
                          background: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px' }} title={cat.categoryName}>
                        {cat.categoryName}
                      </span>
                    </div>
                    <span className="mono" style={{ fontWeight: 600, color: 'var(--text-muted)', flexShrink: 0 }}>
                      ₹{cat.amount.toLocaleString('en-IN')} ({cat.percentage}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Lower Row: Top Payees & Recent Activity */}
      <div className="grid-2">
        {/* Top Vendors */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '1.15rem' }}>Top Payees & Vendors</h2>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Ranked by expenditure volume</span>
          </div>

          {topVendors.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon"><Receipt size={24} /></div>
              <div className="empty-title">No vendor records</div>
              <div className="empty-desc">No vendors recorded for this company or date range.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {topVendors.map((v, i) => {
                const maxAmt = topVendors[0]?.amount || 1;
                const barWidth = Math.min(100, Math.round((v.amount / maxAmt) * 100));

                return (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                        <div
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: 'var(--radius-sm)',
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border-color)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            color: 'var(--primary)',
                            flexShrink: 0,
                          }}
                        >
                          {v.vendor.substring(0, 2).toUpperCase()}
                        </div>
                        <span style={{ fontWeight: 600 }}>{v.vendor}</span>
                      </div>
                      <span className="mono" style={{ fontWeight: 700, color: 'var(--danger)' }}>
                        ₹{v.amount.toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div style={{ height: '4px', background: 'var(--bg-surface)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ width: `${barWidth}%`, height: '100%', background: 'var(--primary)' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Transaction Stream */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '1.15rem' }}>Recent Ledger Activity</h2>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Latest disbursements</span>
          </div>

          {recentTransactions.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon"><Receipt size={24} /></div>
              <div className="empty-title">No recent activity</div>
              <div className="empty-desc">No transactions recorded yet.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {recentTransactions.map((tx) => (
                <div
                  key={tx.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.65rem 0.85rem',
                    background: 'var(--bg-surface)',
                    borderRadius: 'var(--radius)',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--danger-bg)',
                        color: 'var(--danger)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Receipt size={16} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                        {tx.vendor || tx.categoryName}
                      </span>
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                        {tx.categoryName} {tx.subcategory ? `• ${tx.subcategory}` : ''}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                    <span className="mono" style={{ fontWeight: 700, color: 'var(--danger)', fontSize: '0.875rem' }}>
                      -₹{tx.amount.toLocaleString('en-IN')}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {formatDisplayDate(tx.date)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
        </>
      )}
    </div>
  );
};

export default DashboardPage;
