import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import {
  Plus,
  Trash2,
  Download,
  Search,
  Check,
  X,
  FolderPlus,
  Zap,
  TableProperties,
  Receipt,
  Building,
  TrendingUp,
} from 'lucide-react';
import { GET_EXPENSES, GET_COMPANIES, GET_CATEGORIES, GET_PAYMENT_METHODS } from '../graphql/queries';
import { CREATE_EXPENSES, DELETE_EXPENSE, CREATE_CATEGORY, ADD_SUBCATEGORY } from '../graphql/mutations';
import { useAuthStore } from '../store/authStore';
import { CategorySelect } from '../components/common/CategorySelect';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { client } from '../graphql/client';

const CORE_SECTIONS = [
  { group: 'C', groupLabel: 'C — Compliance' },
  { group: 'O', groupLabel: 'O — Operations' },
  { group: 'R', groupLabel: 'R — Risk & Reserves' },
  { group: 'E', groupLabel: 'E — Equipment & Systems' },
  { group: 'B', groupLabel: 'B — Brand & Culture' },
  { group: 'I', groupLabel: 'I — Incentives & Hospitality' },
  { group: 'G', groupLabel: 'G — Growth' },
  { group: 'H', groupLabel: 'H — Human Resources' },
  { group: 'T', groupLabel: 'T — Tours & Events' },
];

export const ExpensesPage = () => {
  const { activeCompanyId, token } = useAuthStore();
  const [showForm, setShowForm] = useState(false);
  const [entryMode, setEntryMode] = useState('quick'); // 'quick' | 'batch'
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // Cache of categories per company ID { [companyId]: [Category] }
  const [companyCategories, setCompanyCategories] = useState({});

  // Quick Single-Entry Form State
  const [quickDate, setQuickDate] = useState(new Date().toISOString().split('T')[0]);
  const [quickCompanyId, setQuickCompanyId] = useState(activeCompanyId || '');
  const [quickCategoryId, setQuickCategoryId] = useState('');
  const [quickCategoryName, setQuickCategoryName] = useState('');
  const [quickSubcategory, setQuickSubcategory] = useState('');
  const [quickVendor, setQuickVendor] = useState('');
  const [quickAmount, setQuickAmount] = useState('');
  const [quickPaymentMethodId, setQuickPaymentMethodId] = useState('');
  const [quickNotes, setQuickNotes] = useState('');

  // Delete Confirmation Modal State
  const [expenseToDelete, setExpenseToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Quick Add Category Modal state
  const [showAddCatModal, setShowAddCatModal] = useState(false);
  const [targetRowIdx, setTargetRowIdx] = useState(null); // null means quick form
  const [catCompanyId, setCatCompanyId] = useState('');
  const [catSection, setCatSection] = useState('O');
  const [catCustomGroup, setCatCustomGroup] = useState('');
  const [catCustomLabel, setCatCustomLabel] = useState('');
  const [catName, setCatName] = useState('');
  const [catInitialSub, setCatInitialSub] = useState('');
  const [isSubmittingCat, setIsSubmittingCat] = useState(false);

  // Quick Add Sub-category Modal state
  const [showAddSubModal, setShowAddSubModal] = useState(false);
  const [subTargetRowIdx, setSubTargetRowIdx] = useState(null); // null means quick form
  const [subTargetCatId, setSubTargetCatId] = useState('');
  const [subTargetCatName, setSubTargetCatName] = useState('');
  const [newSubName, setNewSubName] = useState('');
  const [isSubmittingSub, setIsSubmittingSub] = useState(false);

  // Batch rows state
  const [rows, setRows] = useState([
    {
      companyId: activeCompanyId || '',
      date: new Date().toISOString().split('T')[0],
      categoryId: '',
      categoryName: '',
      subcategory: '',
      amount: '',
      vendor: '',
      paymentMethodId: '',
      paymentMethodName: '',
      notes: '',
    },
  ]);

  const { data: compData } = useQuery(GET_COMPANIES);
  const { data: catData, refetch: refetchCategories } = useQuery(GET_CATEGORIES, {
    variables: { companyId: activeCompanyId || null },
  });
  const { data: pmData } = useQuery(GET_PAYMENT_METHODS);

  const companies = compData?.companies || [];
  const activeCompany = companies.find((c) => c.id === activeCompanyId);
  const defaultCategories = catData?.categories || [];
  const paymentMethods = pmData?.paymentMethods || [];

  const { data, loading, refetch } = useQuery(GET_EXPENSES, {
    variables: {
      filter: {
        companyId: activeCompanyId || null,
        search: search || null,
      },
      page,
      limit: 15,
    },
  });

  const [createExpenses, { loading: saving }] = useMutation(CREATE_EXPENSES);
  const [deleteExpense] = useMutation(DELETE_EXPENSE);
  const [createCategory] = useMutation(CREATE_CATEGORY);
  const [addSubcategory] = useMutation(ADD_SUBCATEGORY);

  const expenses = data?.expenses?.expenses || [];
  const totalPages = data?.expenses?.totalPages || 1;
  const totalCount = data?.expenses?.totalCount || 0;

  // Sync activeCompanyId with quickCompanyId
  useEffect(() => {
    if (activeCompanyId) {
      setQuickCompanyId(activeCompanyId);
      setRows((prev) =>
        prev.map((r, i) => (i === 0 && !r.companyId ? { ...r, companyId: activeCompanyId } : r))
      );
    }
  }, [activeCompanyId]);

  // Load categories for a specific company
  const loadCategoriesForCompany = async (cId) => {
    if (!cId || companyCategories[cId]) return;
    try {
      const res = await client.query({
        query: GET_CATEGORIES,
        variables: { companyId: cId },
        fetchPolicy: 'cache-first',
      });
      if (res.data?.categories) {
        setCompanyCategories((prev) => ({
          ...prev,
          [cId]: res.data.categories,
        }));
      }
    } catch (err) {
      console.error('Error fetching categories for company:', err);
    }
  };

  const getCategoriesForRow = (rowCompanyId) => {
    const targetComp = rowCompanyId || activeCompanyId;
    if (targetComp && companyCategories[targetComp]) {
      return companyCategories[targetComp];
    }
    return defaultCategories;
  };

  // Metrics
  const totalFilteredAmount = useMemo(() => {
    return expenses.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  }, [expenses]);

  const avgTicketSize = useMemo(() => {
    if (!expenses.length) return 0;
    return Math.round(totalFilteredAmount / expenses.length);
  }, [expenses, totalFilteredAmount]);

  // Quick Single Submit
  const handleQuickSubmit = async (e, addAnother = false) => {
    if (e) e.preventDefault();

    if (!quickCompanyId || !quickCategoryId || !quickAmount) {
      alert('Please fill Company, Category, and Amount.');
      return;
    }

    const pm = paymentMethods.find((p) => p.id === quickPaymentMethodId);

    const input = {
      companyId: quickCompanyId,
      date: quickDate,
      categoryId: quickCategoryId,
      categoryName: quickCategoryName,
      subcategory: quickSubcategory,
      amount: parseFloat(quickAmount) || 0,
      vendor: quickVendor,
      paymentMethodId: quickPaymentMethodId || null,
      paymentMethodName: pm?.name || '',
      notes: quickNotes,
    };

    try {
      await createExpenses({ variables: { inputs: [input] } });
      refetch();
      if (addAnother) {
        setQuickAmount('');
        setQuickVendor('');
        setQuickNotes('');
      } else {
        setShowForm(false);
        setQuickAmount('');
        setQuickVendor('');
        setQuickNotes('');
      }
    } catch (err) {
      alert('Error saving expense: ' + err.message);
    }
  };

  // Batch Handlers
  const handleAddRow = () => {
    setRows([
      ...rows,
      {
        companyId: activeCompanyId || companies[0]?.id || '',
        date: new Date().toISOString().split('T')[0],
        categoryId: '',
        categoryName: '',
        subcategory: '',
        amount: '',
        vendor: '',
        paymentMethodId: '',
        paymentMethodName: '',
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

    if (field === 'companyId') {
      updated[index].categoryId = '';
      updated[index].categoryName = '';
      updated[index].subcategory = '';
      if (value) loadCategoriesForCompany(value);
    } else if (field === 'categoryId') {
      const availableCats = getCategoriesForRow(updated[index].companyId);
      const selectedCat = availableCats.find((c) => c.id === value);
      updated[index].categoryName = selectedCat?.name || '';
      updated[index].subcategory = '';
    } else if (field === 'paymentMethodId') {
      const selectedPm = paymentMethods.find((p) => p.id === value);
      updated[index].paymentMethodName = selectedPm?.name || '';
    }

    setRows(updated);
  };

  const runningTotal = rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

  const handleSubmitBatch = async (e) => {
    e.preventDefault();
    const inputs = rows.map((r) => ({
      companyId: r.companyId || companies[0]?.id,
      date: r.date,
      categoryId: r.categoryId,
      categoryName: r.categoryName,
      subcategory: r.subcategory,
      amount: parseFloat(r.amount) || 0,
      vendor: r.vendor,
      paymentMethodId: r.paymentMethodId || null,
      paymentMethodName: r.paymentMethodName,
      notes: r.notes,
    }));

    for (const item of inputs) {
      if (!item.companyId || !item.categoryId || !item.amount) {
        alert('Please ensure Company, Category, and Amount are filled for all rows.');
        return;
      }
    }

    try {
      await createExpenses({ variables: { inputs } });
      setShowForm(false);
      setRows([
        {
          companyId: activeCompanyId || companies[0]?.id || '',
          date: new Date().toISOString().split('T')[0],
          categoryId: '',
          categoryName: '',
          subcategory: '',
          amount: '',
          vendor: '',
          paymentMethodId: '',
          paymentMethodName: '',
          notes: '',
        },
      ]);
      refetch();
    } catch (err) {
      alert('Error saving expenses: ' + err.message);
    }
  };

  // Category in-flight creation
  const handleOpenAddCategory = (rowIndex = null) => {
    const targetComp =
      rowIndex !== null
        ? rows[rowIndex]?.companyId || activeCompanyId || companies[0]?.id || ''
        : quickCompanyId || activeCompanyId || companies[0]?.id || '';

    setTargetRowIdx(rowIndex);
    setCatCompanyId(targetComp);
    setCatSection('O');
    setCatCustomGroup('');
    setCatCustomLabel('');
    setCatName('');
    setCatInitialSub('');
    setShowAddCatModal(true);
  };

  const handleSaveCategory = async (e) => {
    e.preventDefault();
    if (!catName.trim()) {
      alert('Please enter a category name');
      return;
    }

    let group = catSection;
    let groupLabel = '';
    if (catSection === 'CUSTOM') {
      group = (catCustomGroup || 'O').trim().toUpperCase();
      groupLabel = catCustomLabel.trim() || `${group} — Custom`;
    } else {
      const matched = CORE_SECTIONS.find((s) => s.group === catSection);
      groupLabel = matched?.groupLabel || `${group} — Other`;
    }

    setIsSubmittingCat(true);
    try {
      const subcategoriesInput = catInitialSub.trim()
        ? [{ name: catInitialSub.trim(), items: [], isCustom: true }]
        : [];

      const res = await createCategory({
        variables: {
          input: {
            companyId: catCompanyId || null,
            name: catName.trim(),
            group,
            groupLabel,
            subcategories: subcategoriesInput,
          },
        },
      });

      const newCat = res.data?.createCategory;

      if (newCat) {
        if (catCompanyId) {
          setCompanyCategories((prev) => {
            const existing = prev[catCompanyId] || defaultCategories;
            return {
              ...prev,
              [catCompanyId]: [...existing, newCat],
            };
          });
        }
        await refetchCategories();

        if (targetRowIdx !== null && rows[targetRowIdx]) {
          const updated = [...rows];
          updated[targetRowIdx].categoryId = newCat.id;
          updated[targetRowIdx].categoryName = newCat.name;
          if (catInitialSub.trim()) {
            updated[targetRowIdx].subcategory = catInitialSub.trim();
          }
          setRows(updated);
        } else {
          setQuickCategoryId(newCat.id);
          setQuickCategoryName(newCat.name);
          if (catInitialSub.trim()) {
            setQuickSubcategory(catInitialSub.trim());
          }
        }
      }

      setShowAddCatModal(false);
    } catch (err) {
      alert('Error creating category: ' + err.message);
    } finally {
      setIsSubmittingCat(false);
    }
  };

  // Sub-category in-flight creation
  const handleOpenAddSubcat = (rowIndex = null, categoryId) => {
    if (!categoryId) {
      alert('Please select a Category before adding a sub-category.');
      return;
    }
    const comp = rowIndex !== null ? rows[rowIndex]?.companyId : quickCompanyId;
    const cat = getCategoriesForRow(comp).find((c) => c.id === categoryId);

    setSubTargetRowIdx(rowIndex);
    setSubTargetCatId(categoryId);
    setSubTargetCatName(cat?.name || 'Selected Category');
    setNewSubName('');
    setShowAddSubModal(true);
  };

  const handleSaveSubcategory = async (e) => {
    e.preventDefault();
    if (!newSubName.trim()) {
      alert('Please enter a sub-category name.');
      return;
    }

    setIsSubmittingSub(true);
    try {
      const res = await addSubcategory({
        variables: {
          categoryId: subTargetCatId,
          subcategoryName: newSubName.trim(),
        },
      });

      const updatedCat = res.data?.addSubcategory;
      if (updatedCat) {
        setCompanyCategories((prev) => {
          const updated = { ...prev };
          for (const cId of Object.keys(updated)) {
            updated[cId] = updated[cId].map((c) =>
              c.id === updatedCat.id ? { ...c, subcategories: updatedCat.subcategories } : c
            );
          }
          return updated;
        });

        await refetchCategories();

        if (subTargetRowIdx !== null && rows[subTargetRowIdx]) {
          const updated = [...rows];
          updated[subTargetRowIdx].subcategory = newSubName.trim();
          setRows(updated);
        } else {
          setQuickSubcategory(newSubName.trim());
        }
      }

      setShowAddSubModal(false);
    } catch (err) {
      alert('Error adding sub-category: ' + err.message);
    } finally {
      setIsSubmittingSub(false);
    }
  };

  const confirmDeleteExpense = async () => {
    if (!expenseToDelete) return;
    setIsDeleting(true);
    try {
      await deleteExpense({ variables: { id: expenseToDelete } });
      refetch();
      setExpenseToDelete(null);
    } catch (err) {
      alert('Error deleting: ' + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExport = () => {
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
    let url = `${baseUrl}/export/expenses?token=${token}`;
    if (activeCompanyId) url += `&companyId=${activeCompanyId}`;
    window.open(url, '_blank');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Header & Overview Strip */}
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
            <h1 style={{ fontSize: '1.65rem' }}>Disbursements & Expenses</h1>
            <span className="badge badge-danger">
              {totalCount} Total Recorded
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Record payments with in-flight chart of accounts creation, multi-entity tagging, and CSV export
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <button className="btn btn-secondary btn-sm" onClick={handleExport}>
            <Download size={14} /> Export CSV
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setShowForm(!showForm)}
          >
            {showForm ? <X size={15} /> : <Plus size={15} />}
            {showForm ? 'Close Entry Form' : '+ Record Expense'}
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
              background: 'var(--danger-bg)',
              color: 'var(--danger)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Receipt size={22} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Page Total Spend
            </span>
            <span className="mono" style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--danger)' }}>
              ₹{totalFilteredAmount.toLocaleString('en-IN')}
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
            <TrendingUp size={22} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Average Ticket Size
            </span>
            <span className="mono" style={{ fontSize: '1.45rem', fontWeight: 800 }}>
              ₹{avgTicketSize.toLocaleString('en-IN')}
            </span>
          </div>
        </div>

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
            <Building size={22} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Active Entity Filter
            </span>
            <span style={{ fontSize: '1.1rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {activeCompany ? activeCompany.name : 'All Consolidated'}
            </span>
          </div>
        </div>
      </div>

      {/* Dual-Mode Expense Entry Composer */}
      {showForm && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', border: '1.5px solid var(--primary)' }}>
          {/* Mode Switcher */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', paddingBottom: '0.85rem', borderBottom: '1px solid var(--border-color)' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem' }}>Record Operational Expense</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Categories are scoped to the selected company. Add categories or subcategories in-flight anytime.
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
                  background: entryMode === 'batch' ? 'var(--primary)' : 'transparent',
                  color: entryMode === 'batch' ? '#fff' : 'var(--text-muted)',
                  transition: 'all 0.15s ease',
                }}
              >
                <TableProperties size={14} /> Batch Spreadsheet Grid
              </button>
            </div>
          </div>

          {/* MODE 1: QUICK ENTRY CARD */}
          {entryMode === 'quick' && (
            <form onSubmit={(e) => handleQuickSubmit(e, false)} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="grid-3">
                {/* Date */}
                <div className="form-group">
                  <label className="form-label">Disbursement Date</label>
                  <input
                    type="date"
                    className="input"
                    value={quickDate}
                    onChange={(e) => setQuickDate(e.target.value)}
                    required
                  />
                </div>

                {/* Company */}
                <div className="form-group">
                  <label className="form-label">Legal Entity (Company)</label>
                  <select
                    className="select"
                    value={quickCompanyId}
                    onChange={(e) => {
                      setQuickCompanyId(e.target.value);
                      setQuickCategoryId('');
                      setQuickCategoryName('');
                      setQuickSubcategory('');
                      if (e.target.value) loadCategoriesForCompany(e.target.value);
                    }}
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

                {/* Amount */}
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
                    style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--danger)' }}
                  />
                </div>
              </div>

              <div className="grid-3">
                {/* Category with In-Flight option */}
                <div className="form-group">
                  <label className="form-label">Category (CORE BRIGHT Section) *</label>
                  <CategorySelect
                    categories={getCategoriesForRow(quickCompanyId)}
                    value={quickCategoryId}
                    onChange={(e) => {
                      const selected = getCategoriesForRow(quickCompanyId).find((c) => c.id === e.target.value);
                      setQuickCategoryId(e.target.value);
                      setQuickCategoryName(selected?.name || '');
                      setQuickSubcategory('');
                    }}
                    placeholder="— Select Category —"
                    includeAddNew={true}
                    onAddNew={() => handleOpenAddCategory(null)}
                    required
                  />
                </div>

                {/* Subcategory */}
                <div className="form-group">
                  <label className="form-label">Subcategory (Optional)</label>
                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    <select
                      className="select"
                      value={quickSubcategory}
                      onChange={(e) => {
                        if (e.target.value === '__ADD_NEW_SUBCAT__') {
                          handleOpenAddSubcat(null, quickCategoryId);
                          return;
                        }
                        setQuickSubcategory(e.target.value);
                      }}
                      style={{ flex: 1 }}
                    >
                      <option value="">Subcategory (Opt)</option>
                      {quickCategoryId && (
                        <option value="__ADD_NEW_SUBCAT__" style={{ fontWeight: 'bold', color: 'var(--primary)' }}>
                          + Add Sub-category...
                        </option>
                      )}
                      {(getCategoriesForRow(quickCompanyId).find((c) => c.id === quickCategoryId)?.subcategories || []).map((s, i) => (
                        <option key={i} value={s.name}>
                          {s.name}
                        </option>
                      ))}
                    </select>

                    {quickCategoryId && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-icon"
                        title="Add sub-category"
                        onClick={() => handleOpenAddSubcat(null, quickCategoryId)}
                      >
                        <Plus size={14} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Vendor */}
                <div className="form-group">
                  <label className="form-label">Payee / Vendor Name</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. AWS, Microsoft, Office Supplies"
                    value={quickVendor}
                    onChange={(e) => setQuickVendor(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid-2">
                {/* Payment Method */}
                <div className="form-group">
                  <label className="form-label">Payment Account</label>
                  <select
                    className="select"
                    value={quickPaymentMethodId}
                    onChange={(e) => setQuickPaymentMethodId(e.target.value)}
                  >
                    <option value="">Select Payment Method</option>
                    {paymentMethods.map((pm) => (
                      <option key={pm.id} value={pm.id}>
                        {pm.name} ({pm.type})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Notes */}
                <div className="form-group">
                  <label className="form-label">Description / Invoice Notes</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. Server hosting renewal for March"
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
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  <Check size={16} /> {saving ? 'Recording...' : 'Record Expense'}
                </button>
              </div>
            </form>
          )}

          {/* MODE 2: BATCH SPREADSHEET GRID */}
          {entryMode === 'batch' && (
            <form onSubmit={handleSubmitBatch} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Total Batch Outlay: <strong className="mono" style={{ color: 'var(--danger)', fontSize: '1.15rem' }}>₹{runningTotal.toLocaleString('en-IN')}</strong>
                </span>
                <button type="button" className="btn btn-secondary btn-sm" onClick={handleAddRow}>
                  <Plus size={14} /> Add Row
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
                {rows.map((row, idx) => {
                  const rowCats = getCategoriesForRow(row.companyId);
                  const selectedCat = rowCats.find((c) => c.id === row.categoryId);
                  const subcategories = selectedCat?.subcategories || [];

                  return (
                    <div
                      key={idx}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '120px 140px 180px 160px 140px 120px 130px 40px',
                        gap: '0.5rem',
                        alignItems: 'center',
                        background: 'var(--bg-surface)',
                        padding: '0.65rem 0.85rem',
                        borderRadius: 'var(--radius)',
                        border: '1px solid var(--border-color)',
                        minWidth: '1000px',
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

                      <CategorySelect
                        categories={rowCats}
                        value={row.categoryId}
                        onChange={(e) => handleRowChange(idx, 'categoryId', e.target.value)}
                        placeholder="Category"
                        includeAddNew={true}
                        onAddNew={() => handleOpenAddCategory(idx)}
                        required
                      />

                      <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                        <select
                          className="select"
                          value={row.subcategory}
                          onChange={(e) => {
                            if (e.target.value === '__ADD_NEW_SUBCAT__') {
                              handleOpenAddSubcat(idx, row.categoryId);
                              return;
                            }
                            handleRowChange(idx, 'subcategory', e.target.value);
                          }}
                          style={{ flex: 1 }}
                        >
                          <option value="">Subcategory</option>
                          {row.categoryId && (
                            <option value="__ADD_NEW_SUBCAT__" style={{ fontWeight: 'bold', color: 'var(--primary)' }}>
                              + Add Sub-category...
                            </option>
                          )}
                          {subcategories.map((s, i) => (
                            <option key={i} value={s.name}>
                              {s.name}
                            </option>
                          ))}
                        </select>

                        {row.categoryId && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-icon"
                            title="Add sub-category"
                            onClick={() => handleOpenAddSubcat(idx, row.categoryId)}
                          >
                            <Plus size={12} />
                          </button>
                        )}
                      </div>

                      <input
                        type="text"
                        className="input"
                        placeholder="Vendor"
                        value={row.vendor}
                        onChange={(e) => handleRowChange(idx, 'vendor', e.target.value)}
                      />

                      <input
                        type="number"
                        className="input mono"
                        placeholder="₹"
                        value={row.amount}
                        onChange={(e) => handleRowChange(idx, 'amount', e.target.value)}
                        min="0"
                        step="any"
                        required
                      />

                      <select
                        className="select"
                        value={row.paymentMethodId}
                        onChange={(e) => handleRowChange(idx, 'paymentMethodId', e.target.value)}
                      >
                        <option value="">Payment</option>
                        {paymentMethods.map((pm) => (
                          <option key={pm.id} value={pm.id}>
                            {pm.name}
                          </option>
                        ))}
                      </select>

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
                  );
                })}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={handleAddRow}>
                  <Plus size={14} /> Add Row
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  <Check size={16} /> {saving ? 'Saving...' : `Save ${rows.length} Expense(s)`}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Filters & Search Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ position: 'relative', width: '100%', maxWidth: '360px' }}>
          <Search size={15} style={{ position: 'absolute', left: '12px', top: '11px', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="input"
            style={{ paddingLeft: '36px' }}
            placeholder="Search payee, category, notes..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <span style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
          Showing <strong>{expenses.length}</strong> of <strong>{totalCount}</strong> ledger records
        </span>
      </div>

      {/* Expenses Ledger Table */}
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Company</th>
              <th>Category</th>
              <th>Subcategory</th>
              <th>Payee / Vendor</th>
              <th>Payment Account</th>
              <th>Amount</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {expenses.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-muted)' }}>
                  <div className="empty-state">
                    <div className="empty-icon"><Receipt size={24} /></div>
                    <div className="empty-title">No expense records found</div>
                    <div className="empty-desc">Click "+ Record Expense" above to disburse your first payment</div>
                  </div>
                </td>
              </tr>
            ) : (
              expenses.map((exp) => {
                const comp = companies.find((c) => c.id === exp.companyId);

                return (
                  <tr key={exp.id}>
                    <td className="mono" style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                      {new Date(exp.date).toLocaleDateString()}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{comp?.name || '—'}</span>
                        {comp?.isCoreBranch && (
                          <span className="badge badge-success" style={{ fontSize: '0.62rem', padding: '0.05rem 0.35rem' }}>
                            Core
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{exp.categoryName}</span>
                    </td>
                    <td>
                      {exp.subcategory ? (
                        <span className="badge badge-neutral" style={{ fontSize: '0.72rem' }}>
                          {exp.subcategory}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-subtle)' }}>—</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        <div
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: 'var(--radius-xs)',
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border-color)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            color: 'var(--text-muted)',
                            flexShrink: 0,
                          }}
                        >
                          {(exp.vendor || 'EX').substring(0, 2).toUpperCase()}
                        </div>
                        <span style={{ fontWeight: 500 }}>{exp.vendor || '—'}</span>
                      </div>
                    </td>
                    <td style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
                      {exp.paymentMethodName || '—'}
                    </td>
                    <td>
                      <span className="mono" style={{ fontWeight: 800, color: 'var(--danger)', fontSize: '0.95rem' }}>
                        -₹{Number(exp.amount).toLocaleString('en-IN')}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn btn-secondary btn-icon"
                        onClick={() => setExpenseToDelete(exp.id)}
                        title="Delete Expense"
                        style={{ color: 'var(--danger)' }}
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

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!expenseToDelete}
        title="Delete Expense Record"
        message="Are you sure you want to permanently delete this expense record from the ledger? This action cannot be undone."
        confirmText="Delete Record"
        cancelText="Keep"
        variant="danger"
        loading={isDeleting}
        onConfirm={confirmDeleteExpense}
        onCancel={() => setExpenseToDelete(null)}
      />

      {/* In-Flight Category Creation Modal */}
      {showAddCatModal && (
        <div className="modal-backdrop" onClick={() => setShowAddCatModal(false)}>
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
                  <FolderPlus size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.05rem', margin: 0 }}>Create Category In-Flight</h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Saves directly into the company chart of accounts
                  </span>
                </div>
              </div>
              <button
                className="btn btn-ghost btn-icon"
                onClick={() => setShowAddCatModal(false)}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveCategory}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div className="form-group">
                  <label className="form-label">Target Legal Entity</label>
                  <select
                    className="select"
                    value={catCompanyId}
                    onChange={(e) => setCatCompanyId(e.target.value)}
                    required
                  >
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.isCoreBranch ? '(Core Branch)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">CORE BRIGHT Section / Letter</label>
                  <select
                    className="select"
                    value={catSection}
                    onChange={(e) => setCatSection(e.target.value)}
                    required
                  >
                    {CORE_SECTIONS.map((s, idx) => (
                      <option key={idx} value={s.group}>
                        {s.groupLabel}
                      </option>
                    ))}
                    <option value="CUSTOM">— Custom Letter / Section —</option>
                  </select>
                </div>

                {catSection === 'CUSTOM' && (
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Section Letter (e.g. X)</label>
                      <input
                        type="text"
                        className="input mono"
                        maxLength="2"
                        placeholder="X"
                        value={catCustomGroup}
                        onChange={(e) => setCatCustomGroup(e.target.value.toUpperCase())}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Section Label</label>
                      <input
                        type="text"
                        className="input"
                        placeholder="e.g. X — Special Projects"
                        value={catCustomLabel}
                        onChange={(e) => setCatCustomLabel(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Category Name *</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. Cloud Server Hosting"
                    value={catName}
                    onChange={(e) => setCatName(e.target.value)}
                    autoFocus
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Initial Sub-category (Optional)</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. Production Cluster AWS"
                    value={catInitialSub}
                    onChange={(e) => setCatInitialSub(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowAddCatModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={isSubmittingCat}>
                  {isSubmittingCat ? 'Creating...' : 'Create & Select'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* In-Flight Sub-category Creation Modal */}
      {showAddSubModal && (
        <div className="modal-backdrop" onClick={() => setShowAddSubModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <div>
                <h3 style={{ fontSize: '1.05rem', margin: 0 }}>Add Sub-category</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Parent Category: <strong style={{ color: 'var(--text-main)' }}>{subTargetCatName}</strong>
                </span>
              </div>
              <button
                className="btn btn-ghost btn-icon"
                onClick={() => setShowAddSubModal(false)}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveSubcategory}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Sub-category Name *</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. Courier & Overnight Shipping"
                    value={newSubName}
                    onChange={(e) => setNewSubName(e.target.value)}
                    autoFocus
                    required
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowAddSubModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={isSubmittingSub}>
                  {isSubmittingSub ? 'Adding...' : 'Add & Select'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExpensesPage;
