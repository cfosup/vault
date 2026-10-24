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
  DollarSign,
} from 'lucide-react';
import { GET_EXPENSES, GET_COMPANIES, GET_CATEGORIES, GET_PAYMENT_METHODS, GET_INCOMES } from '../graphql/queries';
import { CREATE_EXPENSES, DELETE_EXPENSE, CREATE_CATEGORY, ADD_SUBCATEGORY } from '../graphql/mutations';
import { useAuthStore } from '../store/authStore';
import { CategorySelect } from '../components/common/CategorySelect';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { client } from '../graphql/client';
import { formatDisplayDate } from '../utils/dateUtils';
import { CompanyIncomeSelect } from '../components/common/CompanyIncomeSelect';
import { getCachedIncomeSelection, setCachedIncomeSelection } from '../utils/incomeCache';

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
  const { activeCompanyId, token, user } = useAuthStore();
  const [showForm, setShowForm] = useState(false);
  const [entryMode, setEntryMode] = useState('quick'); // 'quick' | 'batch'
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('date_desc');
  const [successNotice, setSuccessNotice] = useState('');

  // Cache of categories per company ID { [companyId]: [Category] }
  const [companyCategories, setCompanyCategories] = useState({});

  // Cache of incomes per company ID { [companyId]: { items: [], totalCount: 0, hasMore: false, isFull: false, loading: false } }
  const [companyIncomes, setCompanyIncomes] = useState({});

  // Quick Single-Entry Form State
  const [quickDate, setQuickDate] = useState(new Date().toISOString().split('T')[0]);
  const [quickCompanyId, setQuickCompanyId] = useState(activeCompanyId || '');
  const [quickCategoryId, setQuickCategoryId] = useState('');
  const [quickCategoryName, setQuickCategoryName] = useState('');
  const [quickSubcategory, setQuickSubcategory] = useState('');
  const [quickVendor, setQuickVendor] = useState('');
  const [quickAmount, setQuickAmount] = useState('');
  const [quickPaymentMethodId, setQuickPaymentMethodId] = useState('');
  const [quickIncomeId, setQuickIncomeId] = useState('');
  const [quickIncomeIds, setQuickIncomeIds] = useState([]);
  const [quickIncomeAllocations, setQuickIncomeAllocations] = useState([]);
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
      incomeId: '',
      incomeIds: [],
      incomeAllocations: [],
      notes: '',
    },
  ]);

  const { data: compData } = useQuery(GET_COMPANIES);
  const { data: catData, refetch: refetchCategories } = useQuery(GET_CATEGORIES, {
    variables: { companyId: activeCompanyId || null },
  });
  const { data: pmData } = useQuery(GET_PAYMENT_METHODS);
  const { data: allIncomesData, refetch: refetchIncomes } = useQuery(GET_INCOMES, {
    variables: { limit: 500 },
    fetchPolicy: 'cache-and-network',
  });

  const companies = compData?.companies || [];
  const activeCompany = companies.find((c) => c.id === activeCompanyId);
  const defaultCategories = catData?.categories || [];
  const paymentMethods = pmData?.paymentMethods || [];
  const allIncomes = allIncomesData?.incomes?.incomes || [];

  const { data, loading, refetch } = useQuery(GET_EXPENSES, {
    variables: {
      filter: {
        companyId: activeCompanyId || null,
        search: search || null,
        sortBy: sortBy || 'date_desc',
      },
      page,
      limit: 15,
    },
    fetchPolicy: 'cache-and-network',
  });

  const [createExpenses, { loading: saving }] = useMutation(CREATE_EXPENSES);
  const [deleteExpense] = useMutation(DELETE_EXPENSE);
  const [createCategory] = useMutation(CREATE_CATEGORY);
  const [addSubcategory] = useMutation(ADD_SUBCATEGORY);

  const expenses = data?.expenses?.expenses || [];
  const totalPages = data?.expenses?.totalPages || 1;
  const totalCount = data?.expenses?.totalCount || 0;

  // Load incomes for a specific company (recent 5, or all 100 with View More)
  const loadIncomesForCompany = async (cId, fetchAll = false) => {
    if (!cId) return;
    try {
      setCompanyIncomes((prev) => ({
        ...prev,
        [cId]: { ...(prev[cId] || { items: [] }), loading: true },
      }));

      const limit = fetchAll ? 100 : 5;
      const res = await client.query({
        query: GET_INCOMES,
        variables: {
          filter: { companyId: cId },
          page: 1,
          limit,
        },
        fetchPolicy: 'network-only',
      });

      const incomeList = res.data?.incomes?.incomes || [];
      const totalCount = res.data?.incomes?.totalCount || 0;
      const hasMore = totalCount > incomeList.length;

      setCompanyIncomes((prev) => ({
        ...prev,
        [cId]: {
          items: incomeList,
          totalCount,
          hasMore,
          isFull: fetchAll,
          loading: false,
        },
      }));

      // Note: Remembered selections are used to prioritize dropdown display, but new expenses default to unlinked.
    } catch (err) {
      console.error('Error fetching incomes for company:', err);
      setCompanyIncomes((prev) => ({
        ...prev,
        [cId]: { ...(prev[cId] || { items: [] }), loading: false },
      }));
    }
  };

  // Helper to sort incomes with remembered entry prioritized at top if accessible
  const getSortedIncomesForCompany = (cId) => {
    const data = companyIncomes[cId];
    if (!data || !data.items) return [];
    const rememberedId = user?.id ? localStorage.getItem(`vault_last_income_${user.id}_${cId}`) : null;
    if (!rememberedId) return data.items;

    const rememberedItem = data.items.find((i) => i.id === rememberedId);
    if (!rememberedItem) return data.items; // graceful fallback if deleted or not in list

    const others = data.items.filter((i) => i.id !== rememberedId);
    return [{ ...rememberedItem, isRemembered: true }, ...others];
  };

  // Sync activeCompanyId or cached company with quickCompanyId and initialize state
  useEffect(() => {
    const cached = getCachedIncomeSelection(user?.id);
    const targetComp = activeCompanyId || cached?.companyId || quickCompanyId || companies[0]?.id;
    if (targetComp) {
      if (!quickCompanyId || activeCompanyId) setQuickCompanyId(targetComp);
      loadCategoriesForCompany(targetComp);
      // Expenses ALWAYS default to unlinked general expenses
      setRows((prev) =>
        prev.map((r, i) =>
          i === 0 && !r.companyId
            ? {
                ...r,
                companyId: targetComp,
                incomeId: '',
                incomeIds: [],
                incomeAllocations: [],
              }
            : r
        )
      );
    }
  }, [activeCompanyId, companies.length, user?.id]);

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

  // Multi-Income Allocation Split Helpers for Quick Entry
  const quickExpAmount = useMemo(() => {
    return Math.max(0, parseFloat(quickAmount) || 0);
  }, [quickAmount]);

  const totalQuickAllocated = useMemo(() => {
    return quickIncomeAllocations.reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
  }, [quickIncomeAllocations]);

  const allocationDiff = useMemo(() => {
    return Number((quickExpAmount - totalQuickAllocated).toFixed(2));
  }, [quickExpAmount, totalQuickAllocated]);

  const isAllocationExact = useMemo(() => {
    return Math.abs(allocationDiff) < 0.05 && quickExpAmount > 0;
  }, [allocationDiff, quickExpAmount]);

  const handleAllocationAmountChange = (incId, rawVal) => {
    // Strip leading zeroes before non-zero digits ("010000" -> "10000", "05000" -> "5000", "00" -> "0")
    let val = String(rawVal).replace(/[^0-9.]/g, '');
    const parts = val.split('.');
    if (parts.length > 2) {
      val = parts[0] + '.' + parts.slice(1).join('');
    }
    if (/^0[0-9]/.test(val)) {
      val = val.replace(/^0+/, '');
      if (val === '') val = '0';
    }
    // Allow empty string so user can freely backspace without 0 getting stuck on the left
    setQuickIncomeAllocations((prev) => {
      const exists = prev.some((a) => a.incomeId === incId);
      if (exists) {
        return prev.map((a) => (a.incomeId === incId ? { ...a, amount: val } : a));
      }
      return [...prev, { incomeId: incId, amount: val }];
    });
  };

  const handleSplitEvenly = () => {
    if (!quickIncomeIds.length) return;
    const perItem = Number((quickExpAmount / quickIncomeIds.length).toFixed(2));
    let running = 0;
    const updated = quickIncomeIds.map((id, idx) => {
      const isLast = idx === quickIncomeIds.length - 1;
      const amt = isLast ? Math.max(0, Number((quickExpAmount - running).toFixed(2))) : perItem;
      running += amt;
      return { incomeId: id, amount: String(amt) };
    });
    setQuickIncomeAllocations(updated);
  };

  const handleFillRemaining = (targetIncId) => {
    const othersSum = quickIncomeAllocations
      .filter((a) => a.incomeId !== targetIncId)
      .reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
    const rem = Math.max(0, Number((quickExpAmount - othersSum).toFixed(2)));
    setQuickIncomeAllocations((prev) => {
      const exists = prev.some((a) => a.incomeId === targetIncId);
      if (exists) {
        return prev.map((a) => (a.incomeId === targetIncId ? { ...a, amount: String(rem) } : a));
      }
      return [...prev, { incomeId: targetIncId, amount: String(rem) }];
    });
  };

  // Quick Single Submit
  const handleQuickSubmit = async (e, addAnother = false) => {
    if (e) e.preventDefault();

    if (!quickCompanyId || !quickCategoryId || !quickAmount) {
      alert('Please fill Company, Category, and Amount.');
      return;
    }

    // Validate that sum of allocations matches expense amount when multi-incomes are selected
    if (quickIncomeIds.length > 1) {
      if (Math.abs(allocationDiff) > 0.05) {
        alert(
          `The sum of income allocations (₹${totalQuickAllocated.toLocaleString('en-IN')}) must equal the total expense amount (₹${quickExpAmount.toLocaleString('en-IN')}).\n` +
          (allocationDiff > 0
            ? `You still have ₹${allocationDiff.toLocaleString('en-IN')} remaining to allocate.`
            : `Allocations exceed the expense amount by ₹${Math.abs(allocationDiff).toLocaleString('en-IN')}.`) +
          `\nPlease adjust the amounts or click "Split Evenly" to auto-balance.`
        );
        return;
      }
    }

    const pm = paymentMethods.find((p) => p.id === quickPaymentMethodId);

    const input = {
      companyId: quickCompanyId,
      date: quickDate,
      categoryId: quickCategoryId,
      categoryName: quickCategoryName,
      subcategory: quickSubcategory,
      amount: quickExpAmount,
      vendor: quickVendor,
      paymentMethodId: quickPaymentMethodId || null,
      paymentMethodName: pm?.name || '',
      notes: quickNotes,
      incomeId: quickIncomeIds[0] || quickIncomeId || null,
      incomeIds: quickIncomeIds.length > 0 ? quickIncomeIds : quickIncomeId ? [quickIncomeId] : [],
      incomeAllocations: quickIncomeIds.length > 1
        ? quickIncomeAllocations.map((a) => ({ incomeId: a.incomeId, amount: Number(a.amount) }))
        : quickIncomeId || quickIncomeIds.length === 1
        ? [{ incomeId: quickIncomeIds[0] || quickIncomeId, amount: quickExpAmount }]
        : [],
    };

    try {
      await createExpenses({ variables: { inputs: [input] } });
      const comp = companies.find((c) => c.id === input.companyId);
      const inc = allIncomes.find((i) => i.id === input.incomeId);
      setCachedIncomeSelection(user?.id, {
        companyId: input.companyId,
        companyName: comp?.name || '',
        incomeId: input.incomeId || null,
        incomeSource: inc?.source || '',
        incomeAmount: inc?.amount || 0,
        incomeDate: inc?.date || '',
      });

      setSuccessNotice(`Expense of ₹${Number(input.amount).toLocaleString('en-IN')} on ${formatDisplayDate(input.date)} recorded successfully!`);
      setTimeout(() => setSuccessNotice(''), 5000);
      refetch();
      if (refetchIncomes) refetchIncomes();
      if (addAnother) {
        setQuickAmount('');
        setQuickVendor('');
        setQuickNotes('');
        setQuickIncomeId('');
        setQuickIncomeIds([]);
        setQuickIncomeAllocations([]);
      } else {
        setShowForm(false);
        setQuickAmount('');
        setQuickVendor('');
        setQuickNotes('');
        setQuickIncomeId('');
        setQuickIncomeIds([]);
        setQuickIncomeAllocations([]);
      }
    } catch (err) {
      alert('Error saving expense: ' + err.message);
    }
  };

  // Batch Handlers
  const handleAddRow = () => {
    const cached = getCachedIncomeSelection(user?.id);
    const defaultComp = cached?.companyId || activeCompanyId || companies[0]?.id || '';
    if (defaultComp) {
      loadCategoriesForCompany(defaultComp);
    }
    setRows([
      ...rows,
      {
        companyId: defaultComp,
        date: new Date().toISOString().split('T')[0],
        categoryId: '',
        categoryName: '',
        subcategory: '',
        amount: '',
        vendor: '',
        paymentMethodId: '',
        paymentMethodName: '',
        incomeId: '',
        incomeIds: [],
        incomeAllocations: [],
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
    let finalVal = value;
    if (field === 'amount') {
      finalVal = String(value).replace(/[^0-9.]/g, '');
      const parts = finalVal.split('.');
      if (parts.length > 2) finalVal = parts[0] + '.' + parts.slice(1).join('');
      if (/^0[0-9]/.test(finalVal)) {
        finalVal = finalVal.replace(/^0+/, '');
        if (finalVal === '') finalVal = '0';
      }
    }
    updated[index][field] = finalVal;

    if (field === 'companyId') {
      updated[index].categoryId = '';
      updated[index].categoryName = '';
      updated[index].subcategory = '';
      updated[index].incomeId = '';
      if (value) {
        loadCategoriesForCompany(value);
        loadIncomesForCompany(value, false);
      }
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

  const handleRowCompanyIncomeChange = (index, newCompanyId, newIncomeId, newIncomeIds) => {
    const updated = [...rows];
    let compChanged = false;
    // Only set companyId if the row doesn't have a company selected yet
    if (!updated[index].companyId && newCompanyId) {
      updated[index].companyId = newCompanyId;
      compChanged = true;
    }
    const finalIds = newIncomeIds || (newIncomeId ? [newIncomeId] : []);
    updated[index].incomeId = newIncomeId || (finalIds.length > 0 ? finalIds[0] : '');
    updated[index].incomeIds = finalIds;

    const rowAmt = parseFloat(updated[index].amount) || 0;
    if (finalIds.length > 1) {
      const perItem = Number((rowAmt / finalIds.length).toFixed(2));
      let running = 0;
      updated[index].incomeAllocations = finalIds.map((id, i) => {
        const isLast = i === finalIds.length - 1;
        const amt = isLast ? Math.max(0, Number((rowAmt - running).toFixed(2))) : perItem;
        running += amt;
        return { incomeId: id, amount: amt };
      });
    } else if (finalIds.length === 1) {
      updated[index].incomeAllocations = [{ incomeId: finalIds[0], amount: rowAmt }];
    } else {
      updated[index].incomeAllocations = [];
    }

    if (compChanged) {
      updated[index].categoryId = '';
      updated[index].categoryName = '';
      updated[index].subcategory = '';
      if (newCompanyId) {
        loadCategoriesForCompany(newCompanyId);
      }
    }
    setRows(updated);

    if (newCompanyId) {
      const comp = companies.find((c) => c.id === newCompanyId);
      const inc = allIncomes.find((i) => i.id === newIncomeId);
      setCachedIncomeSelection(user?.id, {
        companyId: newCompanyId,
        companyName: comp?.name || '',
        incomeId: newIncomeId || null,
        incomeSource: inc?.source || '',
        incomeAmount: inc?.amount || 0,
        incomeDate: inc?.date || '',
      });
    }
  };

  const runningTotal = rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

  const handleSubmitBatch = async (e) => {
    e.preventDefault();
    const inputs = rows.map((r) => {
      const rowAmt = parseFloat(r.amount) || 0;
      let allocs = [];
      if (Array.isArray(r.incomeAllocations) && r.incomeAllocations.length > 0) {
        allocs = r.incomeAllocations;
      } else if (Array.isArray(r.incomeIds) && r.incomeIds.length > 1) {
        const perItem = Number((rowAmt / r.incomeIds.length).toFixed(2));
        let running = 0;
        allocs = r.incomeIds.map((id, i) => {
          const isLast = i === r.incomeIds.length - 1;
          const amt = isLast ? Math.max(0, Number((rowAmt - running).toFixed(2))) : perItem;
          running += amt;
          return { incomeId: id, amount: amt };
        });
      } else if (r.incomeId || (r.incomeIds && r.incomeIds.length === 1)) {
        allocs = [{ incomeId: r.incomeId || r.incomeIds[0], amount: rowAmt }];
      }

      return {
        companyId: r.companyId || companies[0]?.id,
        date: r.date,
        categoryId: r.categoryId,
        categoryName: r.categoryName,
        subcategory: r.subcategory,
        amount: rowAmt,
        vendor: r.vendor,
        paymentMethodId: r.paymentMethodId || null,
        paymentMethodName: r.paymentMethodName,
        notes: r.notes,
        incomeId: r.incomeId || (r.incomeIds && r.incomeIds.length > 0 ? r.incomeIds[0] : null) || null,
        incomeIds: r.incomeIds && r.incomeIds.length > 0 ? r.incomeIds : r.incomeId ? [r.incomeId] : [],
        incomeAllocations: allocs,
      };
    });

    for (const item of inputs) {
      if (!item.companyId || !item.categoryId || !item.amount) {
        alert('Please ensure Company, Category, and Amount are filled for all rows.');
        return;
      }
    }

    try {
      await createExpenses({ variables: { inputs } });
      const lastRow = inputs[inputs.length - 1];
      if (lastRow) {
        const comp = companies.find((c) => c.id === lastRow.companyId);
        const inc = allIncomes.find((i) => i.id === lastRow.incomeId);
        setCachedIncomeSelection(user?.id, {
          companyId: lastRow.companyId,
          companyName: comp?.name || '',
          incomeId: lastRow.incomeId || null,
          incomeSource: inc?.source || '',
          incomeAmount: inc?.amount || 0,
          incomeDate: inc?.date || '',
        });
      }
      setSuccessNotice(`Successfully recorded ${inputs.length} expense disbursements in the ledger!`);
      setTimeout(() => setSuccessNotice(''), 5000);
      setShowForm(false);
      const cached = getCachedIncomeSelection(user?.id);
      setRows([
        {
          companyId: cached?.companyId || activeCompanyId || companies[0]?.id || '',
          date: new Date().toISOString().split('T')[0],
          categoryId: '',
          categoryName: '',
          subcategory: '',
          amount: '',
          vendor: '',
          paymentMethodId: '',
          paymentMethodName: '',
          incomeId: '',
          incomeIds: [],
          incomeAllocations: [],
          notes: '',
        },
      ]);
      refetch();
      if (refetchIncomes) refetchIncomes();
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
            onClick={() => {
              if (!showForm) {
                const targetComp = quickCompanyId || activeCompanyId || companies[0]?.id;
                if (targetComp) {
                  if (!quickCompanyId) setQuickCompanyId(targetComp);
                  loadCategoriesForCompany(targetComp);
                  loadIncomesForCompany(targetComp, false);
                }
              }
              setShowForm(!showForm);
            }}
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
        <div
          className="card glass-card"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            border: '1.5px solid var(--border-hover)',
            boxShadow: '0 16px 36px -8px rgba(0,0,0,0.35), inset 0 1px 0 0 rgba(255,255,255,0.08)',
          }}
        >
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
                  color: entryMode === 'quick' ? 'var(--primary-foreground)' : 'var(--text-muted)',
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
                  color: entryMode === 'batch' ? 'var(--primary-foreground)' : 'var(--text-muted)',
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
                      const newCompId = e.target.value;
                      setQuickCompanyId(newCompId);
                      setQuickCategoryId('');
                      setQuickCategoryName('');
                      setQuickSubcategory('');
                      setQuickIncomeId('');
                      setQuickIncomeIds([]);
                      setQuickIncomeAllocations([]);
                      if (newCompId) {
                        loadCategoriesForCompany(newCompId);
                        loadIncomesForCompany(newCompId, false);
                      }
                    }}
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

                {/* Amount */}
                <div className="form-group">
                  <label className="form-label">Amount (₹ INR) *</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="input mono"
                    placeholder="0.00"
                    value={quickAmount}
                    onChange={(e) => {
                      let val = String(e.target.value).replace(/[^0-9.]/g, '');
                      const parts = val.split('.');
                      if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('');
                      if (/^0[0-9]/.test(val)) {
                        val = val.replace(/^0+/, '');
                        if (val === '') val = '0';
                      }
                      setQuickAmount(val);
                    }}
                    required
                    style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--danger)', fontFamily: 'var(--font-mono)' }}
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

              <div className="grid-3">
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

                {/* Linked Revenue / Income Entry (Hierarchical Class & Sub-Class) */}
                <div className="form-group">
                  <label
                    className="form-label"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-start',
                      gap: '0.4rem',
                      fontFamily: 'var(--font-sans)',
                    }}
                  >
                    <DollarSign size={13} style={{ color: 'var(--success)' }} />
                    <span>Link to Income (Class & Sub-Class)</span>
                  </label>
                  <CompanyIncomeSelect
                    companies={companies}
                    incomes={allIncomes}
                    companyId={quickCompanyId}
                    incomeId={quickIncomeId}
                    incomeIds={quickIncomeIds}
                    incomeAllocations={quickIncomeAllocations}
                    expenseAmount={quickExpAmount}
                    userId={user?.id}
                    variant="full"
                    placeholder="— None (Unlinked Expense) —"
                    onChange={({ companyId, incomeId, incomeIds }) => {
                      // Only set quickCompanyId if not already chosen by user
                      if (!quickCompanyId && companyId) {
                        setQuickCompanyId(companyId);
                        loadCategoriesForCompany(companyId);
                      }
                      setQuickIncomeId(incomeId || '');
                      const nextIds = incomeIds || (incomeId ? [incomeId] : []);
                      setQuickIncomeIds(nextIds);

                      if (nextIds.length === 0) {
                        setQuickIncomeAllocations([]);
                      } else if (nextIds.length === 1) {
                        setQuickIncomeAllocations([{ incomeId: nextIds[0], amount: String(quickExpAmount) }]);
                      } else {
                        const existingMap = new Map(quickIncomeAllocations.map((a) => [a.incomeId, a.amount]));
                        const hasAnyCustom = nextIds.some((id) => existingMap.has(id) && Number(existingMap.get(id)) > 0);
                        if (!hasAnyCustom && quickExpAmount > 0) {
                          const perItem = Number((quickExpAmount / nextIds.length).toFixed(2));
                          let running = 0;
                          const newAllocs = nextIds.map((id, idx) => {
                            const isLast = idx === nextIds.length - 1;
                            const amt = isLast ? Math.max(0, Number((quickExpAmount - running).toFixed(2))) : perItem;
                            running += amt;
                            return { incomeId: id, amount: String(amt) };
                          });
                          setQuickIncomeAllocations(newAllocs);
                        } else {
                          setQuickIncomeAllocations(
                            nextIds.map((id) => ({
                              incomeId: id,
                              amount: existingMap.get(id) !== undefined ? String(existingMap.get(id)) : '0',
                            }))
                          );
                        }
                      }
                    }}
                  />
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

              {/* Multi-Income Allocation Split Card */}
              {quickIncomeIds.length > 1 && (
                <div
                  style={{
                    padding: '1.25rem',
                    background: 'var(--bg-surface)',
                    fontFamily: 'var(--font-sans)',
                    border: isAllocationExact
                      ? '1px solid var(--border-color)'
                      : allocationDiff > 0
                      ? '1.5px solid oklch(0.7 0.18 55)'
                      : '1.5px solid var(--danger)',
                    borderRadius: 'var(--radius)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.85rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div
                        style={{
                          width: '26px',
                          height: '26px',
                          borderRadius: 'var(--radius-xs)',
                          background: 'var(--bg-card)',
                          border: '1px solid var(--border-color)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--success)',
                        }}
                      >
                        <DollarSign size={15} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.92rem', fontFamily: 'var(--font-sans)' }}>
                          Split Expense Across Incomes ({quickIncomeIds.length} Linked)
                        </div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}>
                          Specify the amount used from each income. Total allocated must equal expense: ₹{quickExpAmount.toLocaleString('en-IN')}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleSplitEvenly}
                      style={{ fontSize: '0.74rem', padding: '0.25rem 0.6rem', display: 'flex', alignItems: 'center', gap: '0.35rem', fontFamily: 'var(--font-sans)' }}
                      title="Distribute expense amount equally across all selected incomes"
                    >
                      <Zap size={12} style={{ color: 'var(--warning)' }} /> Split Evenly
                    </button>
                  </div>

                  {/* Allocation Rows */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {quickIncomeIds.map((incId) => {
                      const inc = allIncomes.find((i) => i.id === incId);
                      const comp = companies.find((c) => c.id === inc?.companyId);
                      const alloc = quickIncomeAllocations.find((a) => a.incomeId === incId);
                      const currentAmt = alloc?.amount !== undefined ? alloc.amount : '';

                      return (
                        <div
                          key={incId}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '0.75rem',
                            padding: '0.55rem 0.75rem',
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-sm)',
                            fontFamily: 'var(--font-sans)',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0, flex: 1 }}>
                            <span className="badge badge-neutral" style={{ fontSize: '0.68rem', flexShrink: 0, fontFamily: 'var(--font-sans)' }}>
                              🏢 {comp?.name || 'Company'}
                            </span>
                            <span style={{ fontWeight: 600, fontSize: '0.84rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--font-sans)' }}>
                              {inc?.source || 'Income Stream'}
                            </span>
                            <span className="mono" style={{ fontSize: '0.72rem', color: 'var(--text-muted)', flexShrink: 0, fontFamily: 'var(--font-mono)' }}>
                              (Total: ₹{Number(inc?.amount || 0).toLocaleString('en-IN')})
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                            <button
                              type="button"
                              className="btn btn-ghost"
                              onClick={() => handleFillRemaining(incId)}
                              style={{ fontSize: '0.7rem', padding: '0.2rem 0.45rem', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}
                              title="Fill remainder to reach total expense amount"
                            >
                              Fill Remainder
                            </button>
                            <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                              <span
                                className="mono"
                                style={{
                                  position: 'absolute',
                                  left: '0.55rem',
                                  fontSize: '0.82rem',
                                  color: 'var(--text-muted)',
                                  fontWeight: 600,
                                  fontFamily: 'var(--font-mono)',
                                }}
                              >
                                ₹
                              </span>
                              <input
                                type="text"
                                inputMode="decimal"
                                className="input mono"
                                style={{ width: '130px', paddingLeft: '1.35rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}
                                placeholder="0.00"
                                value={currentAmt}
                                onChange={(e) => handleAllocationAmountChange(incId, e.target.value)}
                                required
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Live Validation Bar (Theme-native Linear / Stripe status badge) */}
                  <div
                    style={{
                      padding: '0.6rem 0.85rem',
                      background: isAllocationExact
                        ? 'var(--success-bg)'
                        : allocationDiff > 0
                        ? 'var(--warning-bg)'
                        : 'var(--danger-bg)',
                      border: isAllocationExact
                        ? '1px solid var(--success-border)'
                        : allocationDiff > 0
                        ? '1px solid var(--warning-border)'
                        : '1px solid var(--danger-border)',
                      borderRadius: 'var(--radius-sm)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '0.8rem',
                      flexWrap: 'wrap',
                      gap: '0.45rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <span style={{ fontWeight: 600 }}>
                        Total Expense: <span className="mono">₹{quickExpAmount.toLocaleString('en-IN')}</span>
                      </span>
                      <span style={{ color: 'var(--text-muted)' }}>•</span>
                      <span style={{ fontWeight: 600 }}>
                        Allocated: <span className="mono" style={{ color: isAllocationExact ? 'var(--success)' : 'inherit', fontWeight: 700 }}>₹{totalQuickAllocated.toLocaleString('en-IN')}</span>
                      </span>
                    </div>

                    <div>
                      {isAllocationExact ? (
                        <span style={{ color: 'var(--success)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                          <Check size={14} /> Sum matches expense (100% Allocated)
                        </span>
                      ) : allocationDiff > 0 ? (
                        <span style={{ color: 'var(--warning)', fontWeight: 700 }}>
                          ⚠ ₹{allocationDiff.toLocaleString('en-IN')} remaining to allocate
                        </span>
                      ) : (
                        <span style={{ color: 'var(--danger)', fontWeight: 700 }}>
                          ⚠ Over-allocated by ₹{Math.abs(allocationDiff).toLocaleString('en-IN')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

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

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
                {/* Column Headers for Batch Spreadsheet Grid */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '110px 130px 160px 140px 130px 110px 120px 220px 36px',
                    gap: '0.5rem',
                    padding: '0.2rem 0.85rem',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    minWidth: '1160px',
                  }}
                >
                  <div>Date</div>
                  <div>Company (Class)</div>
                  <div>Category</div>
                  <div>Subcategory</div>
                  <div>Payee / Vendor</div>
                  <div>Amount (₹)</div>
                  <div>Payment</div>
                  <div>Link to Income (Class & Sub-Class)</div>
                  <div></div>
                </div>

                {rows.map((row, idx) => {
                  const rowCats = getCategoriesForRow(row.companyId);
                  const selectedCat = rowCats.find((c) => c.id === row.categoryId);
                  const subcategories = selectedCat?.subcategories || [];

                  return (
                    <div
                      key={idx}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '110px 130px 160px 140px 130px 110px 120px 220px 36px',
                        gap: '0.5rem',
                        alignItems: 'center',
                        background: 'var(--bg-surface)',
                        padding: '0.65rem 0.85rem',
                        borderRadius: 'var(--radius)',
                        border: '1px solid var(--border-color)',
                        minWidth: '1160px',
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
                        type="text"
                        inputMode="decimal"
                        className="input mono"
                        placeholder="₹ 0.00"
                        value={row.amount}
                        onChange={(e) => handleRowChange(idx, 'amount', e.target.value)}
                        required
                        style={{ fontFamily: 'var(--font-mono)' }}
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

                      <CompanyIncomeSelect
                        companies={companies}
                        incomes={allIncomes}
                        companyId={row.companyId}
                        incomeId={row.incomeId}
                        incomeIds={row.incomeIds || (row.incomeId ? [row.incomeId] : [])}
                        userId={user?.id}
                        variant="compact"
                        placeholder="Link to Income"
                        onChange={({ companyId, incomeId, incomeIds }) => {
                          handleRowCompanyIncomeChange(idx, companyId, incomeId, incomeIds);
                        }}
                        style={{ fontSize: '0.8rem' }}
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

      {/* Success Notification Banner */}
      {successNotice && (
        <div
          className="card"
          style={{
            background: 'var(--success-bg)',
            borderLeft: '4px solid var(--success)',
            color: 'var(--success)',
            padding: '0.85rem 1.15rem',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
            <Check size={16} />
            <span>{successNotice}</span>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            onClick={() => setSuccessNotice('')}
            style={{ color: 'var(--success)', padding: 0 }}
          >
            <X size={14} />
          </button>
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Sort:</span>
            <select
              className="select"
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                setPage(1);
              }}
              style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem', minWidth: '170px' }}
            >
              <option value="date_desc">Disbursement Date (Newest)</option>
              <option value="createdAt_desc">Recently Created</option>
              <option value="date_asc">Disbursement Date (Oldest)</option>
              <option value="amount_desc">Amount (Highest)</option>
            </select>
          </div>

          <span style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
            Showing <strong>{expenses.length}</strong> of <strong>{totalCount}</strong> ledger records
          </span>
        </div>
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
              <th>Linked Revenue</th>
              <th>Amount</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {expenses.length === 0 ? (
              <tr>
                <td colSpan="9" style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-muted)' }}>
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
                      {formatDisplayDate(exp.date || exp.createdAt)}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{comp?.name || '—'}</span>
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
                      {exp.incomes && exp.incomes.length > 0 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.25rem', maxWidth: '200px' }}>
                          {exp.incomes.length === 1 ? (
                            <span
                              className="badge badge-success"
                              style={{
                                fontSize: '0.72rem',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                                maxWidth: '160px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                              title={`Linked to: ${exp.incomes[0].source} (₹${Number(exp.incomes[0].amount).toLocaleString('en-IN')})`}
                            >
                              <DollarSign size={10} /> {exp.incomes[0].source}
                            </span>
                          ) : (
                            <span
                              className="badge badge-success"
                              style={{
                                fontSize: '0.72rem',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                                cursor: 'help',
                              }}
                              title={
                                exp.incomeAllocations && exp.incomeAllocations.length > 0
                                  ? exp.incomeAllocations
                                      .map((a) => {
                                        const inc = exp.incomes.find((i) => i.id === a.incomeId);
                                        return `${inc?.source || 'Income'}: ₹${Number(a.amount).toLocaleString('en-IN')}`;
                                      })
                                      .join(' • ')
                                  : exp.incomes.map((inc) => `${inc.source} (₹${Number(inc.amount).toLocaleString('en-IN')})`).join(', ')
                              }
                            >
                              <DollarSign size={10} /> {exp.incomes.length} Incomes (Split)
                            </span>
                          )}
                        </div>
                      ) : exp.income ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span
                            className="badge badge-success"
                            style={{
                              fontSize: '0.72rem',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              maxWidth: '160px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                            title={`Linked to: ${exp.income.source} (₹${Number(exp.income.amount).toLocaleString('en-IN')})`}
                          >
                            <DollarSign size={10} /> {exp.income.source}
                          </span>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-subtle)', fontSize: '0.78rem' }}>—</span>
                      )}
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
                        {c.name}
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
