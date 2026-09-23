import React, { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import {
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle,
  PieChart,
  X,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  Wallet,
  Building,
  Target,
  Layers,
} from 'lucide-react';
import { GET_ALL_BUDGET_USAGES, GET_COMPANIES, GET_CATEGORIES } from '../graphql/queries';
import { CREATE_BUDGET_BUCKET, DELETE_BUDGET_BUCKET } from '../graphql/mutations';
import { useAuthStore } from '../store/authStore';
import { CategorySelect } from '../components/common/CategorySelect';

export const BudgetsPage = () => {
  const { activeCompanyId } = useAuthStore();
  const [showModal, setShowModal] = useState(false);

  // Form state
  const [companyId, setCompanyId] = useState(activeCompanyId || '');
  const [categoryId, setCategoryId] = useState('');
  const [name, setName] = useState('');
  const [limitAmount, setLimitAmount] = useState('');
  const [period, setPeriod] = useState('monthly');
  const [alertThreshold, setAlertThreshold] = useState('80');
  const [subcatAmounts, setSubcatAmounts] = useState({});
  const [showSubcatSection, setShowSubcatSection] = useState(false);
  const [expandedCards, setExpandedCards] = useState({});

  const { data: compData } = useQuery(GET_COMPANIES);
  const { data: catData } = useQuery(GET_CATEGORIES, {
    variables: { companyId: companyId || activeCompanyId || null },
  });

  const companies = compData?.companies || [];
  const categories = catData?.categories || [];
  const activeCompany = companies.find((c) => c.id === activeCompanyId);

  const { data, loading, refetch } = useQuery(GET_ALL_BUDGET_USAGES, {
    variables: { companyId: activeCompanyId || null },
  });

  const [createBucket, { loading: creating }] = useMutation(CREATE_BUDGET_BUCKET);
  const [deleteBucket] = useMutation(DELETE_BUDGET_BUCKET);

  const usages = data?.allBudgetUsages || [];

  // Summary Metrics
  const { totalBudgeted, totalUsed, overallPercent, alertsCount } = useMemo(() => {
    let budgeted = 0;
    let used = 0;
    let alerts = 0;

    for (const u of usages) {
      budgeted += u.bucket?.limitAmount || 0;
      used += u.usedAmount || 0;
      if (u.isNearLimit || u.isOverBudget) {
        alerts++;
      }
    }

    const percent = budgeted > 0 ? Math.round((used / budgeted) * 100) : 0;
    return {
      totalBudgeted: budgeted,
      totalUsed: used,
      overallPercent: percent,
      alertsCount: alerts,
    };
  }, [usages]);

  const handleCreate = async (e) => {
    e.preventDefault();
    const selectedCat = categories.find((c) => c.id === categoryId);

    const subcatBudgets = Object.entries(subcatAmounts)
      .filter(([_, amt]) => parseFloat(amt) > 0)
      .map(([subcategory, amt]) => ({
        subcategory,
        limitAmount: parseFloat(amt),
      }));

    try {
      await createBucket({
        variables: {
          input: {
            companyId: companyId || companies[0]?.id,
            categoryId,
            categoryName: selectedCat?.name || '',
            name,
            limitAmount: parseFloat(limitAmount),
            period,
            alertThreshold: parseFloat(alertThreshold),
            subcatBudgets: subcatBudgets.length > 0 ? subcatBudgets : undefined,
          },
        },
      });
      setShowModal(false);
      setName('');
      setLimitAmount('');
      setCategoryId('');
      setSubcatAmounts({});
      setShowSubcatSection(false);
      refetch();
    } catch (err) {
      alert('Error creating budget: ' + err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this budget bucket?')) return;
    try {
      await deleteBucket({ variables: { id } });
      refetch();
    } catch (err) {
      alert('Error deleting budget: ' + err.message);
    }
  };

  const getProgressColor = (percent, isOver) => {
    if (isOver || percent >= 80) return '#f43f5e';
    if (percent >= 60) return '#f59e0b';
    return '#10b981';
  };

  const toggleExpand = (id) => {
    setExpandedCards((prev) => ({ ...prev, [id]: !prev[id] }));
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
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Budget Buckets & Spending Caps</h1>
            <span className="badge badge-primary" style={{ fontSize: '0.7rem' }}>
              {usages.length} Active Buckets
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Enforce spending discipline with category-level caps and optional sub-category limit allocations
          </p>
        </div>

        <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)} style={{ padding: '0.45rem 1rem' }}>
          <Plus size={15} /> + Create Budget Bucket
        </button>
      </div>

      {/* Overall Budget Health Gauge Strip */}
      {usages.length > 0 && (
        <div className="grid-3">
          <div className="card" style={{ padding: '1.15rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: 'var(--radius)',
                background: 'var(--primary-light)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Target size={22} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                Total Allocated Cap
              </span>
              <span className="mono" style={{ fontSize: '1.45rem', fontWeight: 800 }}>
                ₹{totalBudgeted.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          <div className="card" style={{ padding: '1.15rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: 'var(--radius)',
                background: overallPercent >= 80 ? 'var(--danger-bg)' : 'var(--success-bg)',
                color: overallPercent >= 80 ? 'var(--danger)' : 'var(--success)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Wallet size={22} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                Total Utilization
              </span>
              <span className="mono" style={{ fontSize: '1.45rem', fontWeight: 800, color: overallPercent >= 80 ? 'var(--danger)' : 'var(--text-main)' }}>
                ₹{totalUsed.toLocaleString('en-IN')} ({overallPercent}%)
              </span>
            </div>
          </div>

          <div className="card" style={{ padding: '1.15rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: 'var(--radius)',
                background: alertsCount > 0 ? 'var(--warning-bg)' : 'var(--success-bg)',
                color: alertsCount > 0 ? 'var(--warning)' : 'var(--success)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ShieldAlert size={22} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                Active Overrun Warnings
              </span>
              <span style={{ fontSize: '1.25rem', fontWeight: 700, color: alertsCount > 0 ? 'var(--warning)' : 'var(--success)' }}>
                {alertsCount > 0 ? `${alertsCount} Buckets in Alert` : 'All Within Limits'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Grid of Budget Cards */}
      {usages.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '4rem 1.5rem', color: 'var(--text-muted)' }}>
          <PieChart size={48} style={{ margin: '0 auto 1rem', opacity: 0.4 }} />
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.4rem', color: 'var(--text-main)' }}>
            No Budget Buckets Configured
          </h3>
          <p style={{ fontSize: '0.875rem', maxWidth: '480px', margin: '0 auto 1.5rem', lineHeight: 1.5 }}>
            Budget buckets prevent cost overruns by setting expenditure ceilings on operational departments like Infrastructure, Marketing, or Equipment.
          </p>
          <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>
            <Plus size={14} /> Create Your First Budget
          </button>
        </div>
      ) : (
        <div className="grid-3">
          {usages.map(({ bucket, usedAmount, remainingAmount, percentUsed, isOverBudget, isNearLimit, subcatUsages }) => {
            const barColor = getProgressColor(percentUsed, isOverBudget);
            const clampedPercent = Math.min(100, percentUsed);
            const subBudgets = subcatUsages || [];
            const isExpanded = expandedCards[bucket.id];

            return (
              <div
                key={bucket.id}
                className="card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.15rem',
                  borderTop: `4px solid ${barColor}`,
                }}
              >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.2rem' }}>{bucket.name}</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      <span>{bucket.categoryName}</span>
                      <span>•</span>
                      <span style={{ textTransform: 'capitalize' }}>{bucket.period}</span>
                    </div>
                  </div>

                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleDelete(bucket.id)}
                    title="Delete Budget Bucket"
                    style={{ padding: '0.35rem 0.5rem', color: 'var(--danger)' }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                {/* Main Progress Bar */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Expenditure</span>
                    <span className="mono" style={{ fontWeight: 800, color: barColor }}>
                      {percentUsed}%
                    </span>
                  </div>

                  <div style={{ height: '8px', background: 'var(--bg-surface)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${clampedPercent}%`,
                        height: '100%',
                        background: barColor,
                        borderRadius: '4px',
                        transition: 'width 0.4s ease',
                      }}
                    />
                  </div>
                </div>

                {/* Amounts Breakdown */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '0.5rem',
                    background: 'var(--bg-surface)',
                    padding: '0.75rem',
                    borderRadius: 'var(--radius)',
                    textAlign: 'center',
                  }}
                >
                  <div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Spent</span>
                    <div className="mono" style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--danger)' }}>
                      ₹{usedAmount.toLocaleString('en-IN')}
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Limit</span>
                    <div className="mono" style={{ fontSize: '0.95rem', fontWeight: 800 }}>
                      ₹{bucket.limitAmount.toLocaleString('en-IN')}
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Left</span>
                    <div className="mono" style={{ fontSize: '0.95rem', fontWeight: 800, color: remainingAmount > 0 ? 'var(--success)' : 'var(--danger)' }}>
                      ₹{remainingAmount.toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>

                {/* Alerts */}
                {isOverBudget && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--danger)', fontSize: '0.8rem', fontWeight: 600 }}>
                    <AlertTriangle size={15} />
                    <span>Exceeded budget ceiling by ₹{(usedAmount - bucket.limitAmount).toLocaleString('en-IN')}</span>
                  </div>
                )}
                {!isOverBudget && isNearLimit && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--warning)', fontSize: '0.8rem', fontWeight: 600 }}>
                    <AlertTriangle size={15} />
                    <span>Approaching warning threshold ({bucket.alertThreshold}%)</span>
                  </div>
                )}

                {/* Sub-Category Budgets Section */}
                {subBudgets.length > 0 && (
                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                    <button
                      type="button"
                      onClick={() => toggleExpand(bucket.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        width: '100%',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-muted)',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: '0.2rem 0',
                      }}
                    >
                      <span>{subBudgets.length} Sub-category Limits</span>
                      {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </button>

                    {isExpanded && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.6rem' }}>
                        {subBudgets.map((sub, sIdx) => {
                          const subColor = getProgressColor(sub.percentUsed, sub.isOverBudget);
                          const subClamped = Math.min(100, sub.percentUsed);

                          return (
                            <div
                              key={sIdx}
                              style={{
                                background: 'var(--bg-surface)',
                                padding: '0.6rem 0.75rem',
                                borderRadius: 'var(--radius-sm)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.35rem',
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem' }}>
                                <span style={{ fontWeight: 600 }}>{sub.subcategory}</span>
                                <span className="mono" style={{ color: subColor, fontWeight: 700 }}>
                                  ₹{sub.usedAmount.toLocaleString('en-IN')} / ₹{sub.limitAmount.toLocaleString('en-IN')}
                                </span>
                              </div>
                              <div style={{ height: '4px', background: 'var(--border-color)', borderRadius: '2px', overflow: 'hidden' }}>
                                <div style={{ width: `${subClamped}%`, height: '100%', background: subColor }} />
                              </div>
                              {sub.isOverBudget && (
                                <span style={{ fontSize: '0.7rem', color: 'var(--danger)', fontWeight: 600 }}>
                                  Over sub-category budget limit!
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create Budget Modal */}
      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Create Budget Bucket</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Define spending ceiling and optional sub-category limits
                </p>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowModal(false)} style={{ padding: '0.35rem' }}>
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Budget Name</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. FY26 Cloud & DevOps Infrastructure"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Legal Entity (Company)</label>
                  <select
                    className="select"
                    value={companyId}
                    onChange={(e) => setCompanyId(e.target.value)}
                    required
                  >
                    <option value="">Select Company</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.isCoreBranch ? '(Core Branch)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Parent Category</label>
                  <CategorySelect
                    categories={categories}
                    value={categoryId}
                    onChange={(e) => {
                      setCategoryId(e.target.value);
                      setSubcatAmounts({});
                    }}
                    placeholder="Select Category"
                    required
                  />
                </div>
              </div>

              <div className="grid-3">
                <div className="form-group">
                  <label className="form-label">Limit (₹ INR)</label>
                  <input
                    type="number"
                    className="input mono"
                    placeholder="50000"
                    value={limitAmount}
                    onChange={(e) => setLimitAmount(e.target.value)}
                    min="1"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Period</label>
                  <select className="select" value={period} onChange={(e) => setPeriod(e.target.value)}>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Alert Trigger (%)</label>
                  <input
                    type="number"
                    className="input mono"
                    value={alertThreshold}
                    onChange={(e) => setAlertThreshold(e.target.value)}
                    min="1"
                    max="100"
                    required
                  />
                </div>
              </div>

              {/* Sub-category Budgets Configurator */}
              {categoryId && (
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                  <button
                    type="button"
                    onClick={() => setShowSubcatSection(!showSubcatSection)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--primary)',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    <Plus size={14} />
                    <span>{showSubcatSection ? 'Hide' : 'Configure'} Optional Sub-category Limits</span>
                  </button>

                  {showSubcatSection && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.75rem' }}>
                      {(categories.find((c) => c.id === categoryId)?.subcategories || []).map((sub, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                          <span style={{ fontSize: '0.825rem', color: 'var(--text-main)', flex: 1 }}>{sub.name}</span>
                          <input
                            type="number"
                            className="input mono"
                            style={{ width: '130px', padding: '0.4rem 0.6rem' }}
                            placeholder="₹ Limit"
                            value={subcatAmounts[sub.name] || ''}
                            onChange={(e) =>
                              setSubcatAmounts({ ...subcatAmounts, [sub.name]: e.target.value })
                            }
                            min="0"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={creating}>
                  {creating ? 'Creating...' : 'Create Bucket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BudgetsPage;
