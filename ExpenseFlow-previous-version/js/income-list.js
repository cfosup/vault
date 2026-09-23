// ============================================================
// INCOME LIST PAGE — Fetch & Display from Supabase via n8n
// ============================================================

// Uses CONFIG.GET_INCOMES_URL from config.js

let allIncomes = [];
let filteredIncomes = [];
let currentSort = { field: 'date', dir: 'desc' };

// ---- Load incomes from webhook ----
async function loadIncomes() {
    const loading = document.getElementById('tableLoading');
    const error = document.getElementById('tableError');
    const empty = document.getElementById('tableEmpty');
    const table = document.getElementById('incomeTable');
    const tableFooter = document.getElementById('tableFooter');
    const refreshBtn = document.getElementById('refreshBtn');

    loading.classList.remove('hidden');
    error.classList.add('hidden');
    empty.classList.add('hidden');
    table.classList.add('hidden');
    tableFooter.classList.add('hidden');
    refreshBtn.disabled = true;

    try {
        const res = await fetch(`${CONFIG.GET_INCOMES_URL}?t=${Date.now()}`, {
            headers: {
                "Cache-Control": "no-cache",
                "Pragma": "no-cache"
            }
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();

        let incomes = [];
        if (Array.isArray(data)) {
            incomes = data;
        } else if (data && typeof data === 'object') {
            if (data.incomes && Array.isArray(data.incomes)) {
                incomes = data.incomes;
            } else if (data.data && Array.isArray(data.data)) {
                incomes = data.data;
            }
        }

        allIncomes = incomes;
        loading.classList.add('hidden');

        // Apply filters
        applyFilters();

        document.getElementById('lastUpdated').textContent = new Date().toLocaleTimeString('en-IN', {
            hour: '2-digit', minute: '2-digit'
        });
        localStorage.setItem('incomes_last_fetch', Date.now().toString());

    } catch (err) {
        console.error('[Incomes] Error:', err);
        loading.classList.add('hidden');
        error.classList.remove('hidden');
        document.getElementById('tableErrorMsg').textContent = `Failed to load: ${err.message}`;
    } finally {
        refreshBtn.disabled = false;
    }
}

// ============================================================
// FILTER LOGIC
// ============================================================
function applyFilters() {
    const fromDate = document.getElementById('filterFrom').value;
    const toDate = document.getElementById('filterTo').value;
    const company = document.getElementById('filterCompany') ? document.getElementById('filterCompany').value : '';
    const searchQuery = document.getElementById('searchInput').value.toLowerCase().trim();

    let result = [...allIncomes];

    // Date range filter
    if (fromDate || toDate) {
        result = result.filter(inc => {
            if (!inc.date) return false;
            const itemDate = inc.date.substring(0, 10);
            if (fromDate && itemDate < fromDate) return false;
            if (toDate && itemDate > toDate) return false;
            return true;
        });
    }

    // Company filter
    if (company) {
        const cleanCompany = company.trim().toLowerCase();
        result = result.filter(inc => inc.company && inc.company.trim().toLowerCase() === cleanCompany);
    }

    // Text search filter
    if (searchQuery) {
        result = result.filter(inc => {
            const searchable = [
                inc.date, inc.company, inc.source, inc.notes, String(inc.amount)
            ].filter(Boolean).join(' ').toLowerCase();
            return searchable.includes(searchQuery);
        });
    }

    filteredIncomes = result;

    // Update filter info text
    const filterInfo = document.getElementById('filterInfo');
    if (fromDate || toDate || company || searchQuery) {
        filterInfo.textContent = `Showing ${result.length} of ${allIncomes.length}`;
        document.getElementById('countLabel').textContent = 'Filtered Inflows';
        document.getElementById('amountLabel').textContent = 'Filtered Amount';
    } else {
        filterInfo.textContent = '';
        document.getElementById('countLabel').textContent = 'Total Records';
        document.getElementById('amountLabel').textContent = 'Total Amount';
    }

    // Show results
    const table = document.getElementById('incomeTable');
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
    if (filteredIncomes.length === 0) {
        if (typeof showToast === 'function') showToast('No data to export', 'warning');
        return;
    }
    const headers = ['Date', 'Company', 'Source', 'Notes', 'Amount'];
    const rows = filteredIncomes.map(inc => {
        return [
            inc.date || '',
            (inc.company || '').replace(/,/g, ';'),
            (inc.source || '').replace(/,/g, ';'),
            (inc.notes || '').replace(/,/g, ';'),
            inc.amount || 0
        ].join(',');
    });
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `income_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    if (typeof showToast === 'function') showToast(`Exported ${filteredIncomes.length} records to CSV`, 'success');
}

// ============================================================
// SORT & RENDER
// ============================================================
function sortAndRender() {
    const sorted = [...filteredIncomes].sort((a, b) => {
        let valA = a[currentSort.field] ?? '';
        let valB = b[currentSort.field] ?? '';

        if (currentSort.field === 'amount') {
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

// ---- Render table rows ----
function renderTable(incomes) {
    const tbody = document.getElementById('incomeTableBody');
    tbody.innerHTML = '';

    incomes.forEach(inc => {
        const tr = document.createElement('tr');
        const companyLabel = inc.company || '—';
        const colorHash = getCompanyColorClass(companyLabel);

        tr.innerHTML = `
            <td class="td-date">${formatDate(inc.date)}</td>
            <td><span class="cat-badge ${colorHash}">${escapeHtml(companyLabel)}</span></td>
            <td class="td-subcat">${escapeHtml(inc.source || '—')}</td>
            <td class="td-notes" title="${escapeAttr(inc.notes)}">${escapeHtml(inc.notes || '—')}</td>
            <td class="td-amount amount-low">${formatCurrency(inc.amount)}</td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('rowCount').textContent = `${incomes.length} record${incomes.length !== 1 ? 's' : ''}`;
}

// ---- Update summary cards ----
function updateSummary(incomes) {
    document.getElementById('totalCount').textContent = incomes.length;

    const total = incomes.reduce((sum, inc) => sum + (parseFloat(inc.amount) || 0), 0);
    document.getElementById('totalAmount').textContent = formatCurrency(total);

    const companies = new Set(incomes.map(i => i.company).filter(Boolean));
    document.getElementById('totalCompanies').textContent = companies.size;
}

// ---- Sort table ----
function sortTable(field) {
    if (currentSort.field === field) {
        currentSort.dir = currentSort.dir === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.field = field;
        currentSort.dir = field === 'amount' ? 'desc' : 'asc';
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
    const d = new Date(dateStr.substring(0, 10) + 'T00:00:00');
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

// Dynamic Company color class mapping
function getCompanyColorClass(name) {
    if (!name || name === '—') return 'cat-g8';
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = ((hash << 5) - hash) + name.charCodeAt(i);
    return 'cat-g' + ((Math.abs(hash) % 10) + 1);
}

// ---- Auto-refresh when new income is added ----
window.addEventListener('storage', function (e) {
    if (e.key === 'income_added') {
        setTimeout(() => loadIncomes(), 2000);
    }
});

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

loadIncomes();
