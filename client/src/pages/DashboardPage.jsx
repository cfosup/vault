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
  Sparkles,
  CreditCard,
  Layers,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Zap,
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
} from '../graphql/queries';

// High-contrast, executive palette for categories
const CATEGORY_COLORS = [
  '#6366f1', // Indigo
  '#38bdf8', // Sky
  '#f43f5e', // Rose
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#8b5cf6', // Violet
  '#d946ef', // Fuchsia
  '#14b8a6', // Teal
  '#ec4899', // Pink
  '#84cc16', // Lime
  '#64748b', // Slate
];

export const DashboardPage = () => {
  const { activeCompanyId, setActiveCompanyId, token, user } = useAuthStore();
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
    if (datePreset === 'last_6') {
      const start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
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
    variables: { filter: filterInput, limit: 5 },
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
    variables: { filter: { companyId: activeCompanyId || null }, limit: 6 },
    fetchPolicy: 'cache-and-network',
  });

  const {
    data: companySpendData,
    loading: companySpendLoading,
    refetch: refetchCompanySpend,
  } = useQuery(GET_COMPANY_SPEND_BREAKDOWN, {
    variables: { filter: filterInput },
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
    totalExpenses: 0,
    totalIncome: 0,
    netBalance: 0,
    expenseCount: 0,
    incomeCount: 0,
    topCategory: 'N/A',
    topVendor: 'N/A',
  };

  const categoryBreakdown = catData?.categoryBreakdown || [];
  const incomeVsExpense = trendData?.incomeVsExpenseTrend || [];
  const topVendors = vendorData?.topVendors || [];
  const pmBreakdown = pmData?.paymentMethodBreakdown || [];
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
          text: `Positive operating cash flow with a healthy ${margin}% margin. Net retained: ₹${summary.netBalance.toLocaleString('en-IN')}`,
        });
      } else {
        list.push({
          type: 'warning',
          text: `Operating at a cash deficit. Expenses exceed top-line revenue by ₹${Math.abs(summary.netBalance).toLocaleString('en-IN')}`,
        });
      }
    }
    if (categoryBreakdown.length > 0) {
      const top = categoryBreakdown[0];
      list.push({
        type: 'info',
        text: `Largest cost center is "${top.categoryName}" accounting for ${top.percentage}% of all expenditures (₹${top.amount.toLocaleString('en-IN')})`,
      });
    }
    if (companySpend.length > 1) {
      const topComp = companySpend[0];
      list.push({
        type: 'info',
        text: `Primary operational entity is "${topComp.companyName}" with ₹${topComp.expenses.toLocaleString('en-IN')} outlaid`,
      });
    }
    return list;
  }, [summary, categoryBreakdown, companySpend]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Hero Header & Filter Bar */}
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
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Financial Intelligence</h1>
            <span className="badge badge-primary" style={{ fontSize: '0.7rem' }}>
              {activeCompany ? activeCompany.name : 'All Entities Consolidated'}
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Multi-entity treasury overview, cash burn rate, and chart of accounts distribution
          </p>
        </div>

        {/* Toolbar Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* Timeframe Pill Segment */}
          <div
            style={{
              display: 'flex',
              background: 'var(--bg-app)',
              padding: '0.25rem',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border-color)',
              gap: '0.2rem',
            }}
          >
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
                  color: datePreset === preset.id ? '#fff' : 'var(--text-muted)',
                  padding: '0.35rem 0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <button
            className="btn btn-secondary btn-sm"
            onClick={handleRefreshAll}
            title="Refresh Live Data"
            style={{ padding: '0.5rem' }}
          >
            <RefreshCw size={14} className={sumLoading ? 'animate-spin' : ''} />
          </button>

          <button className="btn btn-primary btn-sm" onClick={() => handleExport('expenses')}>
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      {/* Smart Business Insights Strip */}
      {insights.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '0.85rem' }}>
          {insights.map((ins, i) => (
            <div
              key={i}
              className="card"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.85rem 1.25rem',
                fontSize: '0.835rem',
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
                <Sparkles size={14} />
              </div>
              <span style={{ color: 'var(--text-main)', lineHeight: 1.45, fontWeight: 500 }}>{ins.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* Executive KPI Cards (4 Halo Cards) */}
      <div className="grid-4">
        {/* Outflow / Expenses */}
        <div className="card kpi-card halo-card halo-rose">
          <div className="kpi-header">
            <span className="kpi-label">Total Outflow</span>
            <div className="kpi-icon-wrap" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>
              <TrendingDown size={19} />
            </div>
          </div>
          <div className="kpi-value mono" style={{ color: 'var(--danger)' }}>
            ₹{summary.totalExpenses.toLocaleString('en-IN')}
          </div>
          <div className="kpi-footer">
            <span>{summary.expenseCount} disbursements</span>
            <span className="badge badge-danger">Debit Outlay</span>
          </div>
        </div>

        {/* Inflow / Revenue */}
        <div className="card kpi-card halo-card halo-emerald">
          <div className="kpi-header">
            <span className="kpi-label">Total Inflow</span>
            <div className="kpi-icon-wrap" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}>
              <TrendingUp size={19} />
            </div>
          </div>
          <div className="kpi-value mono" style={{ color: 'var(--success)' }}>
            ₹{summary.totalIncome.toLocaleString('en-IN')}
          </div>
          <div className="kpi-footer">
            <span>{summary.incomeCount} revenue receipts</span>
            <span className="badge badge-success">Credit Inflow</span>
          </div>
        </div>

        {/* Net Operating Balance */}
        <div className="card kpi-card halo-card halo-purple">
          <div className="kpi-header">
            <span className="kpi-label">Net Operating Balance</span>
            <div className="kpi-icon-wrap" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
              <Wallet size={19} />
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

        {/* Cost Driver / Dominant Entity */}
        <div className="card kpi-card halo-card halo-amber">
          <div className="kpi-header">
            <span className="kpi-label">
              {!activeCompanyId && companySpend.length > 0 ? 'Lead Spending Entity' : 'Lead Expense Category'}
            </span>
            <div className="kpi-icon-wrap" style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}>
              {!activeCompanyId && companySpend.length > 0 ? <Building2 size={19} /> : <Receipt size={19} />}
            </div>
          </div>
          <div
            style={{
              fontSize: '1.25rem',
              fontWeight: 800,
              fontFamily: 'Plus Jakarta Sans',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              color: 'var(--text-main)',
              marginTop: '0.25rem',
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
            <span className="badge badge-warning">Top Cost Driver</span>
          </div>
        </div>
      </div>

      {/* Multi-Company Entity Breakdown Grid */}
      {(!activeCompanyId || companySpend.length > 0) && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Building2 size={18} style={{ color: 'var(--primary)' }} />
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Entity Financial Breakdown</h2>
              <span className="badge badge-neutral">{companySpend.length} Legal Entities</span>
            </div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Click an entity card to filter the entire workspace
            </span>
          </div>

          {companySpend.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              No entity financial records recorded for this timeframe.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: '1.5rem' }}>
              {/* Grouped Bar Chart of Entities */}
              <div style={{ minHeight: '260px', height: '260px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={companySpend} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
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
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '0.8rem', paddingTop: '8px' }} />
                    <Bar dataKey="income" name="Inflow" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expenses" name="Outflow" fill="#f43f5e" radius={[4, 4, 0, 0]} />
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
                        gap: '0.4rem',
                        background: isSelected ? 'var(--primary-light)' : 'var(--bg-surface)',
                        border: isSelected ? '1.5px solid var(--primary)' : '1px solid var(--border-color)',
                        padding: '0.8rem 1rem',
                        borderRadius: 'var(--radius)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{comp.companyName}</span>
                          {isCore && (
                            <span className="badge badge-success" style={{ fontSize: '0.62rem', padding: '0.08rem 0.35rem' }}>
                              Core
                            </span>
                          )}
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
                        <div style={{ width: `${comp.percentage}%`, height: '100%', background: 'var(--primary-gradient)' }} />
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
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Cash Flow Trend</h2>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>6-month revenue vs expenditure area</span>
            </div>
            {activeCompany && <span className="badge badge-neutral">{activeCompany.name}</span>}
          </div>

          {incomeVsExpense.length === 0 ? (
            <div style={{ height: '260px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              No historical trend records found.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={incomeVsExpense} margin={{ top: 15, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={12} tickLine={false} />
                <YAxis
                  stroke="var(--text-muted)"
                  fontSize={12}
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
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '0.8rem' }} />
                <Area type="monotone" dataKey="income" name="Inflow" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#incomeGrad)" />
                <Area type="monotone" dataKey="expenses" name="Outflow" stroke="#f43f5e" strokeWidth={2} fillOpacity={1} fill="url(#expenseGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Category Breakdown Donut */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minHeight: '360px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Expenditure by Category</h2>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Proportional allocation across chart of accounts</span>
            </div>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {categoryBreakdown.length} Accounts Active
            </span>
          </div>

          {categoryBreakdown.length === 0 ? (
            <div style={{ height: '260px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              No categorized expenses in this timeframe.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: '1.25rem', alignItems: 'center' }}>
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
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Spend</span>
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
                          width: '10px',
                          height: '10px',
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

      {/* Lower Row: Top Vendors & Recent Activity */}
      <div className="grid-2">
        {/* Top Vendors */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Top Payees & Vendors</h2>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Ranked by expenditure volume</span>
          </div>

          {topVendors.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              No vendor payment records found.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {topVendors.map((v, i) => {
                const maxAmt = topVendors[0]?.amount || 1;
                const barWidth = Math.min(100, Math.round((v.amount / maxAmt) * 100));

                return (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.875rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div
                          style={{
                            width: '26px',
                            height: '26px',
                            borderRadius: 'var(--radius-sm)',
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border-color)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            color: 'var(--primary)',
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
                      <div style={{ width: `${barWidth}%`, height: '100%', background: 'var(--primary-gradient)' }} />
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
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Recent Ledger Activity</h2>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Latest disbursements</span>
          </div>

          {recentTransactions.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              No transactions recorded yet.
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
                      }}
                    >
                      <Receipt size={16} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                        {tx.vendor || tx.categoryName}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {tx.categoryName} {tx.subcategory ? `• ${tx.subcategory}` : ''}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                    <span className="mono" style={{ fontWeight: 700, color: 'var(--danger)', fontSize: '0.9rem' }}>
                      -₹{tx.amount.toLocaleString('en-IN')}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {new Date(tx.date).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
