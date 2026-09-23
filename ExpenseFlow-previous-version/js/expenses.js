// ============================================================
// EXPENSES PAGE — Fetch & Display from Zoho Books via n8n
// ============================================================

// Uses CONFIG.GET_EXPENSES_URL from config.js

let allExpenses = [];
let filteredExpenses = [];
let currentSort = { field: 'date', dir: 'desc' };

// ---- Load expenses from webhook ----
async function loadExpenses() {
    const loading = document.getElementById('tableLoading');
    const error = document.getElementById('tableError');
    const empty = document.getElementById('tableEmpty');
    const table = document.getElementById('expenseTable');
    const tableFooter = document.getElementById('tableFooter');
    const refreshBtn = document.getElementById('refreshBtn');

    loading.classList.remove('hidden');
    error.classList.add('hidden');
    empty.classList.add('hidden');
    table.classList.add('hidden');
    tableFooter.classList.add('hidden');
    refreshBtn.disabled = true;

    try {
        const res = await fetch(CONFIG.GET_EXPENSES_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify({ action: "getExpenses" })
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();

        // Response: [{ code: 0, expenses: [...] }]
        let expenses = [];
        if (Array.isArray(data) && data.length > 0 && data[0].expenses) {
            expenses = data[0].expenses;
        } else if (data.expenses) {
            expenses = data.expenses;
        }

        allExpenses = expenses;
        loading.classList.add('hidden');

        // Apply existing filters
        applyFilters();

        document.getElementById('lastUpdated').textContent = new Date().toLocaleTimeString('en-IN', {
            hour: '2-digit', minute: '2-digit'
        });
        localStorage.setItem('expenses_last_fetch', Date.now().toString());

    } catch (err) {
        console.error('[Expenses] Error:', err);
        loading.classList.add('hidden');
        error.classList.remove('hidden');
        document.getElementById('tableErrorMsg').textContent = `Failed to load: ${err.message}`;
    } finally {
        refreshBtn.disabled = false;
    }
}

// ============================================================
// DATE FILTER
// ============================================================
function applyFilters() {
    const fromDate = document.getElementById('filterFrom').value;
    const toDate = document.getElementById('filterTo').value;
    const company = document.getElementById('filterCompany') ? document.getElementById('filterCompany').value : '';
    const searchQuery = document.getElementById('searchInput').value.toLowerCase().trim();

    let result = [...allExpenses];

    // Date range filter
    if (fromDate) {
        result = result.filter(exp => exp.date >= fromDate);
    }
    if (toDate) {
        result = result.filter(exp => exp.date <= toDate);
    }

    // Company filter
    if (company) {
        result = result.filter(e => resolveExpenseCompany(e) === company);
    }

    // Text search filter
    if (searchQuery) {
        result = result.filter(exp => {
            const { subcategory, notes } = splitDescription(exp.description);
            const searchable = [
                exp.date, exp.description, exp.account_name,
                subcategory, notes, exp.paid_through_account_name,
                exp.vendor_name, String(exp.total)
            ].filter(Boolean).join(' ').toLowerCase();
            return searchable.includes(searchQuery);
        });
    }

    filteredExpenses = result;

    // Update filter info text
    const filterInfo = document.getElementById('filterInfo');
    if (fromDate || toDate) {
        const parts = [];
        if (fromDate) parts.push(formatDate(fromDate));
        if (toDate) parts.push(formatDate(toDate));
        filterInfo.textContent = `Showing ${result.length} of ${allExpenses.length} • ${parts.join(' → ')}`;
        document.getElementById('countLabel').textContent = 'Filtered Expenses';
        document.getElementById('amountLabel').textContent = 'Filtered Amount';
    } else {
        filterInfo.textContent = '';
        document.getElementById('countLabel').textContent = 'Total Expenses';
        document.getElementById('amountLabel').textContent = 'Total Amount';
    }

    // Show results
    const table = document.getElementById('expenseTable');
    const tableFooter = document.getElementById('tableFooter');
    const empty = document.getElementById('tableEmpty');

    if (result.length === 0) {
        table.classList.add('hidden');
        tableFooter.classList.add('hidden');
        empty.classList.remove('hidden');
    } else {
        empty.classList.add('hidden');
        sortAndRender();
        updateSummary(result);
        table.classList.remove('hidden');
        tableFooter.classList.remove('hidden');
    }
}

function clearFilters() {
    document.getElementById('filterFrom').value = '';
    document.getElementById('filterTo').value = '';
    if (document.getElementById('filterCompany')) document.getElementById('filterCompany').value = '';
    document.getElementById('searchInput').value = '';
    applyFilters();
}

// ---- CSV Export ----
function exportCSV() {
    if (filteredExpenses.length === 0) {
        if (typeof showToast === 'function') showToast('No data to export', 'warning');
        return;
    }
    const headers = ['Date', 'Category', 'Subcategory', 'Notes', 'Paid Via', 'Amount'];
    const rows = filteredExpenses.map(exp => {
        const { subcategory, notes } = splitDescription(exp.description);
        return [
            exp.date || '',
            (exp.account_name || '').replace(/,/g, ';'),
            subcategory.replace(/,/g, ';'),
            notes.replace(/,/g, ';'),
            (exp.paid_through_account_name || '').replace(/,/g, ';'),
            exp.total || 0
        ].join(',');
    });
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expenses_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    if (typeof showToast === 'function') showToast(`Exported ${filteredExpenses.length} records to CSV`, 'success');
}

// ============================================================
// SORT & RENDER
// ============================================================
function sortAndRender() {
    const sorted = [...filteredExpenses].sort((a, b) => {
        let valA = a[currentSort.field] ?? '';
        let valB = b[currentSort.field] ?? '';

        if (currentSort.field === 'total' || currentSort.field === 'bcy_total') {
            valA = parseFloat(valA) || 0;
            valB = parseFloat(valB) || 0;
        } else {
            valA = String(valA).toLowerCase();
            valB = String(valB).toLowerCase();
        }

        if (valA < valB) return currentSort.dir === 'asc' ? -1 : 1;
        if (valA > valB) return currentSort.dir === 'asc' ? 1 : -1;
        return 0;
    });
    renderTable(sorted);
}

// ---- Split "Subcategory - Notes" description ----
function splitDescription(desc) {
    if (!desc) return { subcategory: '—', notes: '—' };
    const dashIndex = desc.indexOf(' - ');
    if (dashIndex > 0) {
        return {
            subcategory: desc.substring(0, dashIndex).trim(),
            notes: desc.substring(dashIndex + 3).trim() || '—'
        };
    }
    return { subcategory: desc.trim(), notes: '—' };
}

// ---- Render table rows ----
function renderTable(expenses) {
    const tbody = document.getElementById('expenseTableBody');
    tbody.innerHTML = '';

    expenses.forEach(exp => {
        const tr = document.createElement('tr');
        const catClass = getCategoryClass(exp.account_name);
        const { subcategory, notes } = splitDescription(exp.description);

        tr.innerHTML = `
            <td class="td-date">${formatDate(exp.date)}</td>
            <td><span class="cat-badge ${catClass}">${escapeHtml(exp.account_name || '—')}</span></td>
            <td class="td-subcat">${escapeHtml(subcategory)}</td>
            <td class="td-notes" title="${escapeAttr(notes)}">${escapeHtml(notes)}</td>
            <td class="td-paid-via">${escapeHtml(exp.paid_through_account_name || '—')}</td>
            <td class="td-amount ${getAmountClass(exp.total)}">${formatCurrency(exp.total)}</td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('rowCount').textContent = `${expenses.length} record${expenses.length !== 1 ? 's' : ''}`;
}

// ---- Update summary cards ----
function updateSummary(expenses) {
    document.getElementById('totalCount').textContent = expenses.length;

    const total = expenses.reduce((sum, exp) => sum + (parseFloat(exp.total) || 0), 0);
    document.getElementById('totalAmount').textContent = formatCurrency(total);

    const categories = new Set(expenses.map(e => e.account_name).filter(Boolean));
    document.getElementById('totalCategories').textContent = categories.size;
}

// ---- Sort table ----
function sortTable(field) {
    if (currentSort.field === field) {
        currentSort.dir = currentSort.dir === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.field = field;
        currentSort.dir = field === 'total' ? 'desc' : 'asc';
    }

    document.querySelectorAll('.sort-icon').forEach(el => el.textContent = '↕');
    const icon = document.getElementById(`sort-${field}`);
    if (icon) icon.textContent = currentSort.dir === 'asc' ? '↑' : '↓';

    sortAndRender();
}

// ---- Search triggers filter ----
document.getElementById('searchInput').addEventListener('input', function () {
    applyFilters();
});

// ---- Helpers ----
function formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatCurrency(amount) {
    const num = parseFloat(amount) || 0;
    return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function escapeAttr(str) {
    return (str || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function getAmountClass(amount) {
    const n = parseFloat(amount) || 0;
    if (n >= 50000) return 'amount-high';
    if (n >= 10000) return 'amount-mid';
    return '';
}

// ---- Category → gradient class mapping ----
const CATEGORY_MAP = {
    'Financial Compliance':     'cat-g1',
    'Business Travel':          'cat-g2',
    'Transport & Logistics':    'cat-g3',
    'Telecom':                  'cat-g4',
    'Labor':                    'cat-g5',
    'Telephone Expense':        'cat-g6',
    'Travel Expense':           'cat-g7',
    'Infrastructure & Utilities':'cat-g8',
    'Procurement & Consumables':'cat-g9',
    'Vendor & Partner Services':'cat-g10',
    'Legal & Regulatory Safeguards':'cat-g1',
    'Business Insurance':       'cat-g2',
    'Brand Development':        'cat-g3',
    'Media & Communications':   'cat-g4',
    'Paid Acquisition':         'cat-g5',
    'Sales Enablement':         'cat-g6',
    'Recruitment & Hiring':     'cat-g7',
    'Salaries & Wages':         'cat-g8',
    'Employee Benefits':        'cat-g9',
    'Learning & Development':   'cat-g10',
    'Client Entertainment & Hospitality': 'cat-g1',
    'Team Hospitality & Celebrations': 'cat-g3',
    'Miscellaneous & Contingency': 'cat-g5',
};

function getCategoryClass(name) {
    if (!name) return 'cat-g1';
    if (CATEGORY_MAP[name]) return CATEGORY_MAP[name];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = ((hash << 5) - hash) + name.charCodeAt(i);
    return 'cat-g' + ((Math.abs(hash) % 10) + 1);
}

// ---- Auto-refresh when new expense is added ----
window.addEventListener('storage', function (e) {
    if (e.key === 'expense_added') {
        setTimeout(() => loadExpenses(), 2000);
    }
});

function getExpenseCompany(accountName) {
    if (!accountName) return '';
    const parts = accountName.split(/\s*-\s*/);
    if (parts.length > 1) {
        let last = parts[parts.length - 1].trim();
        if (last === '50') last = 'ATC';
        
        const dynamicCompanies = typeof getCompanies === 'function'
            ? getCompanies().map(c => c.company_name)
            : [];
            
        const allCompanies = [...new Set([...dynamicCompanies, 'ECBC', '2024', 'MINING', 'LAYOUT', 'ATC'])];

        const cleanLast = last.toLowerCase();
        const matched = allCompanies.find(c => c.toLowerCase() === cleanLast);
        if (matched) {
            return matched;
        }
    }
    return '';
}

function resolveExpenseCompany(e) {
    if (!e) return '';
    
    const allCompanies = typeof getCompanies === 'function'
        ? [...new Set([...getCompanies().map(c => c.company_name), 'ECBC', '2024', 'MINING', 'LAYOUT', 'ATC'])]
        : ['ECBC', '2024', 'MINING', 'LAYOUT', 'ATC'];

    function findMatch(val) {
        if (!val) return null;
        const cleanVal = val.toString().trim().toLowerCase();
        return allCompanies.find(c => c.toLowerCase() === cleanVal) || null;
    }
    
    // 1. Try parsing from account name
    let comp = getExpenseCompany(e.account_name);
    if (comp) return comp;
    
    // 2. Try direct fields case-insensitively
    let match = findMatch(e.company) || findMatch(e.customer_name) || findMatch(e.reference_number);
    if (match) return match;
    
    // 3. Try custom fields
    if (Array.isArray(e.custom_fields)) {
        for (const cf of e.custom_fields) {
            match = findMatch(cf.value);
            if (match) return match;
        }
    }
    
    // 4. Try notes (case-insensitive substring match)
    if (e.notes) {
        const cleanNotes = e.notes.toLowerCase();
        const found = allCompanies.find(c => cleanNotes.includes(c.toLowerCase()));
        if (found) return found;
    }
    
    return '';
}

// ---- Initial load ----
const now = new Date();
const currentYear = now.getFullYear();
const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
const currentDay = String(now.getDate()).padStart(2, '0');
const defaultFromDate = `${currentYear}-${currentMonth}-01`;
const defaultToDate = `${currentYear}-${currentMonth}-${currentDay}`;

if (document.getElementById('filterFrom')) {
    document.getElementById('filterFrom').value = defaultFromDate;
}
if (document.getElementById('filterTo')) {
    document.getElementById('filterTo').value = defaultToDate;
}

// Populate company filter dropdown
const filterCompany = document.getElementById('filterCompany');
if (filterCompany && typeof getCompanyOptionsHTML === 'function') {
    filterCompany.innerHTML = '<option value="">All</option>' + getCompanyOptionsHTML();
}

loadExpenses();
