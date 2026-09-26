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
import { ConfirmModal } from '../components/common/ConfirmModal';

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

  // Delete modal state
  const [bucketToDelete, setBucketToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

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

  const confirmDelete = async () => {
    if (!bucketToDelete) return;
    setIsDeleting(true);
    try {
      await deleteBucket({ variables: { id: bucketToDelete } });
      refetch();
      setBucketToDelete(null);
    } catch (err) {
      alert('Error deleting budget: ' + err.message);
    } finally {
      setIsDeleting(false);
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <h1 style={{ fontSize: '1.65rem' }}>Budget Buckets & Spending Caps</h1>
            <span className="badge badge-primary">
              {usages.length} Active Buckets
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Enforce spending discipline with category-level caps and optional sub-category limit allocations
          </p>
        </div>

        <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>
          <Plus size={15} /> + Create Budget Bucket
        </button>
      </div>

      {/* Overall Budget Health Gauge Strip */}
      {usages.length > 0 && (
        <div className="grid-3">
          <div className="card" style={{ padding: '1.15rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
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
                width: '42px',
                height: '42px',
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
                width: '42px',
                height: '42px',
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
              <span style={{ fontSize: '1.2rem', fontWeight: 700, color: alertsCount > 0 ? 'var(--warning)' : 'var(--success)' }}>
                {alertsCount > 0 ? `${alertsCount} Buckets in Alert` : 'All Within Limits'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Grid of Budget Cards */}
      {usages.length === 0 ? (
        <div className="card empty-state" style={{ padding: '4rem 1.5rem' }}>
          <div className="empty-icon" style={{ width: '56px', height: '56px' }}>
            <PieChart size={28} />
          </div>
          <div className="empty-title" style={{ fontSize: '1.15rem' }}>
            No Budget Buckets Configured
          </div>
          <div className="empty-desc" style={{ maxWidth: '440px' }}>
            Budget buckets prevent cost overruns by setting expenditure ceilings on operational departments like Infrastructure, Marketing, or Equipment.
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)} style={{ marginTop: '0.5rem' }}>
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
                  gap: '1.1rem',
                  borderTop: `4px solid ${barColor}`,
                }}
              >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.2rem' }}>{bucket.name}</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      <span>{bucket.categoryName}</span>
                      <span>•</span>
                      <span style={{ textTransform: 'capitalize' }}>{bucket.period}</span>
                    </div>
                  </div>

                  <button
                    className="btn btn-secondary btn-icon"
                    onClick={() => setBucketToDelete(bucket.id)}
                    title="Delete Budget Bucket"
                    style={{ color: 'var(--danger)' }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                {/* Main Progress Bar */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.825rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Expenditure</span>
                    <span className="mono" style={{ fontWeight: 800, color: barColor }}>
                      {percentUsed}%
                    </span>
                  </div>

                  <div style={{ height: '7px', background: 'var(--bg-surface)', borderRadius: '4px', overflow: 'hidden' }}>
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
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Spent</span>
                    <div className="mono" style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--danger)' }}>
                      ₹{usedAmount.toLocaleString('en-IN')}
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Limit</span>
                    <div className="mono" style={{ fontSize: '0.9rem', fontWeight: 800 }}>
                      ₹{bucket.limitAmount.toLocaleString('en-IN')}
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Left</span>
                    <div className="mono" style={{ fontSize: '0.9rem', fontWeight: 800, color: remainingAmount > 0 ? 'var(--success)' : 'var(--danger)' }}>
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
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginTop: '0.65rem' }}>
                        {subBudgets.map((sub, sIdx) => {
                          const subColor = getProgressColor(sub.percentUsed, sub.isOverBudget);
                          const subClamped = Math.min(100, sub.percentUsed);

                          return (
                            <div
                              key={sIdx}
                              style={{
                                background: 'var(--bg-surface)',
                                padding: '0.65rem 0.85rem',
                                borderRadius: 'var(--radius-sm)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.35rem',
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
                                <span style={{ fontWeight: 600 }}>{sub.subcategory}</span>
                                <span className="mono" style={{ fontWeight: 700, color: subColor }}>
                                  ₹{sub.usedAmount.toLocaleString('en-IN')} / ₹{sub.limitAmount.toLocaleString('en-IN')} ({sub.percentUsed}%)
                                </span>
                              </div>

                              <div style={{ height: '4px', background: 'var(--border-color)', borderRadius: '2px', overflow: 'hidden' }}>
                                <div style={{ width: `${subClamped}%`, height: '100%', background: subColor }} />
                              </div>
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

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!bucketToDelete}
        title="Delete Budget Bucket"
        message="Are you sure you want to delete this budget bucket? Spending limits and threshold alerts for this category will be removed."
        confirmText="Delete Bucket"
        cancelText="Cancel"
        variant="danger"
        loading={isDeleting}
        onConfirm={confirmDelete}
        onCancel={() => setBucketToDelete(null)}
      />

      {/* Create Budget Modal */}
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
                  <Target size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.05rem', margin: 0 }}>Create Budget Bucket</h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Set spending thresholds to prevent budget overruns
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
                  <label className="form-label">Legal Entity</label>
                  <select
                    className="select"
                    value={companyId}
                    onChange={(e) => setCompanyId(e.target.value)}
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
                  <label className="form-label">Budget Name</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. Q1 Marketing & Acquisition"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Target Category</label>
                  <CategorySelect
                    categories={categories}
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    placeholder="Select Category to Limit"
                    required
                  />
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Limit Amount (₹)</label>
                    <input
                      type="number"
                      className="input mono"
                      placeholder="100000"
                      value={limitAmount}
                      onChange={(e) => setLimitAmount(e.target.value)}
                      min="1"
                      step="any"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Period</label>
                    <select
                      className="select"
                      value={period}
                      onChange={(e) => setPeriod(e.target.value)}
                    >
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Alert Trigger Threshold (% of limit)</label>
                  <input
                    type="number"
                    className="input mono"
                    placeholder="80"
                    value={alertThreshold}
                    onChange={(e) => setAlertThreshold(e.target.value)}
                    min="1"
                    max="100"
                  />
                </div>

                {/* Subcategory Allocation Toggle */}
                {categoryId && (
                  <div style={{ marginTop: '0.25rem' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setShowSubcatSection(!showSubcatSection)}
                    >
                      <Layers size={14} />
                      {showSubcatSection ? 'Hide Subcategory Caps' : 'Allocate Subcategory Caps'}
                    </button>

                    {showSubcatSection && (
                      <div
                        style={{
                          marginTop: '0.75rem',
                          padding: '0.85rem',
                          background: 'var(--bg-surface)',
                          borderRadius: 'var(--radius)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.65rem',
                        }}
                      >
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          Set specific expenditure limits per subcategory (optional):
                        </span>
                        {(categories.find((c) => c.id === categoryId)?.subcategories || []).map((sub, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>{sub.name}</span>
                            <input
                              type="number"
                              className="input mono"
                              style={{ width: '130px', padding: '0.35rem 0.65rem' }}
                              placeholder="₹ Limit"
                              value={subcatAmounts[sub.name] || ''}
                              onChange={(e) =>
                                setSubcatAmounts({
                                  ...subcatAmounts,
                                  [sub.name]: e.target.value,
                                })
                              }
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
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
                  {creating ? 'Creating...' : 'Create Budget'}
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
