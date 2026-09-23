// ============================================================
// DASHBOARD — Expense Analytics with Canvas Charts
// ============================================================

let dashAllExpenses = [];
let dashFiltered = [];
let dashFilteredDatesOnly = [];

let dashAllIncomes = [];
let dashFilteredIncomes = [];
let dashFilteredIncomesDatesOnly = [];

// ---- Color palette for charts ----
const CHART_COLORS = [
    '#8b5cf6', '#06b6d4', '#22c55e', '#f43f5e', '#f59e0b',
    '#3b82f6', '#ec4899', '#6366f1', '#14b8a6', '#a855f7',
    '#0ea5e9', '#10b981', '#e11d48', '#eab308', '#8b5cf6'
];

const CHART_GRADIENTS = [
    ['#8b5cf6', '#a78bfa'], ['#06b6d4', '#22d3ee'], ['#22c55e', '#4ade80'],
    ['#f43f5e', '#fb7185'], ['#f59e0b', '#fbbf24'], ['#3b82f6', '#60a5fa'],
    ['#ec4899', '#f472b6'], ['#6366f1', '#818cf8'], ['#14b8a6', '#2dd4bf'],
    ['#a855f7', '#c084fc']
];

// Theme-aware color helper
function getThemeColors() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    return {
        cardBg: isDark ? '#111113' : '#ffffff',
        text: isDark ? '#fafafa' : '#09090b',
        textMuted: isDark ? '#a1a1aa' : '#71717a',
        gridLine: isDark ? '#27272a' : '#e4e4e7',
        noData: isDark ? '#52525b' : '#a1a1aa',
        fontSans: '"Inter", "DM Sans", system-ui, sans-serif',
        fontMono: '"JetBrains Mono", "Menlo", monospace',
        incomeGrad: isDark ? ['#4ade80', '#22c55e'] : ['#22c55e', '#16a34a'],
        expenseGrad: isDark ? ['#f87171', '#ef4444'] : ['#ef4444', '#dc2626'],
    };
}

// ---- Tooltip ----
let tooltip = null;
function getTooltip() {
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.className = 'dash-tooltip';
        document.body.appendChild(tooltip);
    }
    return tooltip;
}
function showTooltip(x, y, text) {
    const t = getTooltip();
    t.textContent = text;
    t.classList.add('visible');
    t.style.left = (x + 12) + 'px';
    t.style.top = (y - 10) + 'px';
}
function hideTooltip() {
    const t = getTooltip();
    t.classList.remove('visible');
}

// ============================================================
// LOAD DATA
// ============================================================
async function loadDashboard() {
    const loading = document.getElementById('dashLoading');
    const error = document.getElementById('dashError');
    const content = document.getElementById('dashContent');
    const refreshBtn = document.getElementById('dashRefreshBtn');

    loading.classList.remove('hidden');
    error.classList.add('hidden');
    content.classList.add('hidden');
    refreshBtn.disabled = true;

    try {
        // 1. Fetch Expenses from Zoho Books
        const res = await fetch(CONFIG.GET_EXPENSES_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Accept": "application/json" },
            body: JSON.stringify({ action: "getExpenses" })
        });

        if (!res.ok) throw new Error(`Expenses: HTTP ${res.status}`);
        const data = await res.json();

        let expenses = [];
        if (Array.isArray(data) && data.length > 0 && data[0].expenses) {
            expenses = data[0].expenses;
        } else if (data.expenses) {
            expenses = data.expenses;
        }
        dashAllExpenses = expenses;

        // 2. Fetch Incomes from Supabase (via n8n)
        let incomes = [];
        try {
            // First try GET with a timestamp query param to force bypass cache
            const resInc = await fetch(`${CONFIG.GET_INCOMES_URL}?t=${Date.now()}`, {
                headers: { "Cache-Control": "no-cache", "Pragma": "no-cache" }
            });
            if (resInc.ok) {
                const incData = await resInc.json();
                if (Array.isArray(incData)) {
                    incomes = incData;
                } else if (incData && typeof incData === 'object') {
                    if (incData.incomes && Array.isArray(incData.incomes)) {
                        incomes = incData.incomes;
                    } else if (incData.data && Array.isArray(incData.data)) {
                        incomes = incData.data;
                    } else if (incData.id !== undefined || incData.amount !== undefined) {
                        incomes = [incData];
                    }
                }
            } else {
                // Try fallback POST
                const resIncPost = await fetch(CONFIG.GET_INCOMES_URL, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "getIncomes" })
                });
                if (resIncPost.ok) {
                    const incData = await resIncPost.json();
                    if (Array.isArray(incData)) {
                        incomes = incData;
                    } else if (incData && typeof incData === 'object') {
                        if (incData.incomes && Array.isArray(incData.incomes)) {
                            incomes = incData.incomes;
                        } else if (incData.id !== undefined || incData.amount !== undefined) {
                            incomes = [incData];
                        }
                    }
                }
            }
        } catch (incErr) {
            console.warn('[Dashboard] Income loading failed, defaulting to empty:', incErr);
            incomes = [];
        }
        dashAllIncomes = incomes;

        loading.classList.add('hidden');
        content.classList.remove('hidden');

        applyDashFilters();

    } catch (err) {
        console.error('[Dashboard] Error:', err);
        loading.classList.add('hidden');
        error.classList.remove('hidden');
        document.getElementById('dashErrorMsg').textContent = `Failed to load: ${err.message}`;
    } finally {
        refreshBtn.disabled = false;
    }
}

// ============================================================
// FILTERS
// ============================================================
function setPreset(btn, range) {
    document.querySelectorAll('.dash-preset').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const now = new Date();
    let from = '', to = '';

    switch (range) {
        case 'thisMonth':
            from = formatISO(new Date(now.getFullYear(), now.getMonth(), 1));
            to = formatISO(now);
            break;
        case 'lastMonth':
            from = formatISO(new Date(now.getFullYear(), now.getMonth() - 1, 1));
            to = formatISO(new Date(now.getFullYear(), now.getMonth(), 0));
            break;
        case 'last3':
            from = formatISO(new Date(now.getFullYear(), now.getMonth() - 3, 1));
            to = formatISO(now);
            break;
        case 'last6':
            from = formatISO(new Date(now.getFullYear(), now.getMonth() - 6, 1));
            to = formatISO(now);
            break;
        case 'ytd':
            from = formatISO(new Date(now.getFullYear(), 0, 1));
            to = formatISO(now);
            break;
        case 'all':
        default:
            from = '';
            to = '';
            break;
    }

    document.getElementById('dashFrom').value = from;
    document.getElementById('dashTo').value = to;
    applyDashFilters();
}

function applyDashFilters() {
    const from = document.getElementById('dashFrom').value;
    const to = document.getElementById('dashTo').value;
    const company = document.getElementById('dashCompany') ? document.getElementById('dashCompany').value : '';

    // Filter expenses
    let result = [...dashAllExpenses];
    if (from) result = result.filter(e => e.date >= from);
    if (to) result = result.filter(e => e.date <= to);

    dashFilteredDatesOnly = [...result];
    if (company) {
        result = result.filter(e => resolveExpenseCompany(e) === company);
    }
    dashFiltered = result;

    // Filter incomes
    let incResult = [...dashAllIncomes];
    if (from || to) {
        incResult = incResult.filter(i => {
            if (!i.date) return false;
            const itemDate = i.date.substring(0, 10);
            if (from && itemDate < from) return false;
            if (to && itemDate > to) return false;
            return true;
        });
    }

    dashFilteredIncomesDatesOnly = [...incResult];
    if (company) {
        const cleanCompany = company.trim().toLowerCase();
        incResult = incResult.filter(i => i.company && i.company.trim().toLowerCase() === cleanCompany);
    }
    dashFilteredIncomes = incResult;

    // Deactivate presets if custom dates don't match any preset
    if (from || to) {
        const activePreset = document.querySelector('.dash-preset.active');
        if (activePreset && activePreset.dataset.range === 'all' && (from || to)) {
            activePreset.classList.remove('active');
        }
    }

    renderDashboard();
}

// ============================================================
// RENDER ALL
// ============================================================
function renderDashboard() {
    renderInsights();
    renderKPIs();
    renderPieChart();
    renderIncomeCompanyPieChart();
    renderBarChart();
    renderCashFlowChart();
    renderTop5();
    renderDailyChart();
    renderPaymentChart();
    renderRecentList();
    renderCompanyChart();
}

// ============================================================
// SMART INSIGHTS
// ============================================================
function renderInsights() {
    const container = document.getElementById('insightsScroll');
    if (!container) return;
    
    const expenses = dashFiltered;
    const incomes = dashFilteredIncomes;
    const insights = [];
    
    const totalSpent = expenses.reduce((s, e) => s + (parseFloat(e.total) || 0), 0);
    const totalIncome = incomes.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
    
    // 1. Top spending category
    const catMap = {};
    expenses.forEach(e => {
        const cat = getBaseCategory(e.account_name);
        catMap[cat] = (catMap[cat] || 0) + (parseFloat(e.total) || 0);
    });
    const topCat = Object.entries(catMap).sort((a, b) => b[1] - a[1])[0];
    if (topCat) {
        insights.push({
            icon: '🏆', iconClass: 'insight-icon-purple',
            label: 'Top Category',
            value: topCat[0],
            meta: `₹${abbreviate(topCat[1])} · ${((topCat[1] / totalSpent) * 100).toFixed(0)}% of total`
        });
    }
    
    // 2. Average daily spend
    if (expenses.length > 0) {
        const dates = [...new Set(expenses.map(e => e.date).filter(Boolean))];
        const avgDaily = totalSpent / (dates.length || 1);
        insights.push({
            icon: '📊', iconClass: 'insight-icon-blue',
            label: 'Avg Daily Spend',
            value: '₹' + abbreviate(avgDaily),
            meta: `Across ${dates.length} active day${dates.length !== 1 ? 's' : ''}`
        });
    }
    
    // 3. Savings rate
    if (totalIncome > 0) {
        const savingsRate = ((totalIncome - totalSpent) / totalIncome * 100);
        insights.push({
            icon: savingsRate >= 0 ? '💰' : '⚠️',
            iconClass: savingsRate >= 0 ? 'insight-icon-green' : 'insight-icon-rose',
            label: 'Savings Rate',
            value: savingsRate.toFixed(1) + '%',
            meta: savingsRate >= 0 ? `Saving ₹${abbreviate(totalIncome - totalSpent)}` : `Overspent by ₹${abbreviate(Math.abs(totalIncome - totalSpent))}`
        });
    }
    
    // 4. Top payment method
    const payMap = {};
    expenses.forEach(e => {
        const m = e.paid_through_account_name || 'Unknown';
        payMap[m] = (payMap[m] || 0) + 1;
    });
    const topPay = Object.entries(payMap).sort((a, b) => b[1] - a[1])[0];
    if (topPay) {
        insights.push({
            icon: '💳', iconClass: 'insight-icon-cyan',
            label: 'Preferred Payment',
            value: topPay[0],
            meta: `${topPay[1]} transaction${topPay[1] !== 1 ? 's' : ''} · ${((topPay[1] / expenses.length) * 100).toFixed(0)}%`
        });
    }
    
    // 5. Highest single expense
    if (expenses.length > 0) {
        const maxExp = expenses.reduce((max, e) => (parseFloat(e.total) || 0) > (parseFloat(max.total) || 0) ? e : max, expenses[0]);
        insights.push({
            icon: '🔥', iconClass: 'insight-icon-rose',
            label: 'Largest Expense',
            value: '₹' + abbreviate(parseFloat(maxExp.total) || 0),
            meta: `${getBaseCategory(maxExp.account_name)} · ${formatDateFull(maxExp.date)}`
        });
    }
    
    // 6. Most active company
    const compInsightMap = {};
    expenses.forEach(e => {
        const c = resolveExpenseCompany(e);
        if (c) compInsightMap[c] = (compInsightMap[c] || 0) + (parseFloat(e.total) || 0);
    });
    const topComp = Object.entries(compInsightMap).sort((a, b) => b[1] - a[1])[0];
    if (topComp) {
        insights.push({
            icon: '🏢', iconClass: 'insight-icon-amber',
            label: 'Top Company',
            value: topComp[0],
            meta: `₹${abbreviate(topComp[1])} spent`
        });
    }
    
    if (insights.length === 0) {
        container.innerHTML = '';
        return;
    }
    
    container.innerHTML = insights.map((ins, i) => `
        <div class="insight-card" style="animation-delay: ${i * 0.05 + 0.1}s">
            <div class="insight-icon ${ins.iconClass}">${ins.icon}</div>
            <div class="insight-body">
                <div class="insight-label">${ins.label}</div>
                <div class="insight-value">${ins.value}</div>
                <div class="insight-meta">${ins.meta}</div>
            </div>
        </div>
    `).join('');
}

// ============================================================
// KPIs
// ============================================================
function renderKPIs() {
    const expenses = dashFiltered;
    const incomes = dashFilteredIncomes;

    const totalSpent = expenses.reduce((s, e) => s + (parseFloat(e.total) || 0), 0);
    const totalIncome = incomes.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
    const netBalance = totalIncome - totalSpent;
    const count = expenses.length + incomes.length;

    const activeComps = new Set();
    expenses.forEach(e => {
        const c = resolveExpenseCompany(e);
        if (c) activeComps.add(c);
    });
    incomes.forEach(i => {
        if (i.company) activeComps.add(i.company);
    });

    animateValue('kpiTotalIncome', totalIncome, true);
    animateValue('kpiTotalSpent', totalSpent, true);
    animateValue('kpiNetBalance', netBalance, true);

    const netCard = document.getElementById('kpiNetCard');
    const netIcon = document.getElementById('kpiNetIcon');
    if (netCard && netIcon) {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        if (netBalance >= 0) {
            netCard.style.borderColor = 'var(--success)';
            netIcon.style.background = isDark ? 'rgba(74, 222, 128, 0.15)' : 'rgba(34, 197, 94, 0.12)';
            netIcon.style.color = isDark ? '#4ade80' : '#22c55e';
        } else {
            netCard.style.borderColor = 'var(--danger)';
            netIcon.style.background = isDark ? 'rgba(248, 113, 113, 0.15)' : 'rgba(239, 68, 68, 0.12)';
            netIcon.style.color = isDark ? '#f87171' : '#ef4444';
        }
    }

    document.getElementById('kpiCount').textContent = count.toLocaleString('en-IN');
    document.getElementById('kpiCompaniesActive').textContent = activeComps.size.toLocaleString('en-IN');
}

function animateValue(id, target, isCurrency) {
    const el = document.getElementById(id);
    const duration = 600;
    const startTime = performance.now();
    const startVal = 0;

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
        const current = startVal + (target - startVal) * eased;

        if (isCurrency) {
            el.textContent = '₹' + current.toLocaleString('en-IN', {
                minimumFractionDigits: 2, maximumFractionDigits: 2
            });
        } else {
            el.textContent = Math.round(current).toLocaleString('en-IN');
        }

        if (progress < 1) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
}

// ============================================================
// PIE CHART — Category Breakdown
// ============================================================
function renderPieChart() {
    const tc = getThemeColors();
    const canvas = document.getElementById('chartPie');
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const size = 280;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
    ctx.scale(dpr, dpr);

    // Aggregate by category
    const catMap = {};
    dashFiltered.forEach(e => {
        const cat = getBaseCategory(e.account_name);
        catMap[cat] = (catMap[cat] || 0) + (parseFloat(e.total) || 0);
    });

    const sorted = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
    const total = sorted.reduce((s, [, v]) => s + v, 0);

    if (sorted.length === 0 || total === 0) {
        ctx.clearRect(0, 0, size, size);
        ctx.fillStyle = tc.noData;
        ctx.font = '500 14px ' + tc.fontSans;
        ctx.textAlign = 'center';
        ctx.fillText('No data available', size / 2, size / 2);
        document.getElementById('pieLegend').innerHTML = '';
        return;
    }

    // Draw pie
    const cx = size / 2, cy = size / 2, radius = 110;
    let startAngle = -Math.PI / 2;
    const slices = [];

    ctx.clearRect(0, 0, size, size);

    sorted.forEach(([cat, val], i) => {
        const sliceAngle = (val / total) * 2 * Math.PI;
        const color = CHART_COLORS[i % CHART_COLORS.length];

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, radius, startAngle, startAngle + sliceAngle);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();

        // Thin separator
        ctx.strokeStyle = tc.cardBg;
        ctx.lineWidth = 2;
        ctx.stroke();

        slices.push({ cat, val, color, startAngle, endAngle: startAngle + sliceAngle });
        startAngle += sliceAngle;
    });

    // Inner circle (donut)
    ctx.beginPath();
    ctx.arc(cx, cy, 60, 0, 2 * Math.PI);
    ctx.fillStyle = tc.cardBg;
    ctx.fill();

    // Center text
    ctx.fillStyle = tc.text;
    ctx.font = '700 16px ' + tc.fontMono;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('₹' + abbreviate(total), cx, cy - 6);
    ctx.font = '500 10px ' + tc.fontSans;
    ctx.fillStyle = tc.textMuted;
    ctx.fillText('TOTAL', cx, cy + 12);

    // Legend
    const legendEl = document.getElementById('pieLegend');
    const maxLegend = 7;
    const display = sorted.length > maxLegend ? sorted.slice(0, maxLegend) : sorted;
    const othersVal = sorted.length > maxLegend
        ? sorted.slice(maxLegend).reduce((s, [, v]) => s + v, 0)
        : 0;

    legendEl.innerHTML = display.map(([cat, val], i) => `
        <div class="pie-legend-item">
            <div class="pie-legend-dot" style="background:${CHART_COLORS[i % CHART_COLORS.length]}"></div>
            <span class="pie-legend-label">${escapeHtml(cat)}</span>
            <span class="pie-legend-value">${((val / total) * 100).toFixed(1)}%</span>
        </div>
    `).join('') + (othersVal > 0 ? `
        <div class="pie-legend-item">
            <div class="pie-legend-dot" style="background:#999"></div>
            <span class="pie-legend-label">Others</span>
            <span class="pie-legend-value">${((othersVal / total) * 100).toFixed(1)}%</span>
        </div>
    ` : '');

    // Tooltip on hover
    canvas.onmousemove = function (e) {
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const dx = mx - cx, dy = my - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 60 && dist < radius) {
            let angle = Math.atan2(dy, dx);
            if (angle < -Math.PI / 2) angle += 2 * Math.PI;
            const slice = slices.find(s => angle >= s.startAngle && angle < s.endAngle);
            if (slice) {
                showTooltip(e.clientX, e.clientY,
                    `${slice.cat}: ₹${slice.val.toLocaleString('en-IN', { maximumFractionDigits: 2 })} (${((slice.val / total) * 100).toFixed(1)}%)`
                );
                return;
            }
        }
        hideTooltip();
    };
    canvas.onmouseleave = hideTooltip;
}

// ============================================================
// BAR CHART — Monthly Trend
// ============================================================
function renderBarChart() {
    const tc = getThemeColors();
    const canvas = document.getElementById('chartBar');
    const container = canvas.parentElement;
    const width = container.clientWidth - 40; // padding
    const height = 220;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    // Aggregate by month
    const monthMap = {};
    dashFiltered.forEach(e => {
        if (!e.date) return;
        const key = e.date.substring(0, 7); // YYYY-MM
        monthMap[key] = (monthMap[key] || 0) + (parseFloat(e.total) || 0);
    });

    const keys = Object.keys(monthMap).sort();
    const values = keys.map(k => monthMap[k]);

    if (keys.length === 0) {
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = tc.noData;
        ctx.font = '500 14px ' + tc.fontSans;
        ctx.textAlign = 'center';
        ctx.fillText('No data available', width / 2, height / 2);
        return;
    }

    const maxVal = Math.max(...values) * 1.15;
    const marginLeft = 65;
    const marginBottom = 36;
    const marginTop = 10;
    const chartW = width - marginLeft - 20;
    const chartH = height - marginBottom - marginTop;
    const barWidth = Math.min(40, (chartW / keys.length) * 0.6);
    const gap = chartW / keys.length;

    ctx.clearRect(0, 0, width, height);

    // Grid lines
    const gridLines = 5;
    ctx.strokeStyle = tc.gridLine;
    ctx.lineWidth = 1;
    ctx.fillStyle = tc.textMuted;
    ctx.font = '500 10px ' + tc.fontMono;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    for (let i = 0; i <= gridLines; i++) {
        const y = marginTop + chartH - (chartH * i / gridLines);
        const val = (maxVal * i / gridLines);

        ctx.beginPath();
        ctx.setLineDash([3, 3]);
        ctx.moveTo(marginLeft, y);
        ctx.lineTo(width - 20, y);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillText('₹' + abbreviate(val), marginLeft - 8, y);
    }

    // Bars
    const barRects = [];
    keys.forEach((key, i) => {
        const val = values[i];
        const barH = (val / maxVal) * chartH;
        const x = marginLeft + gap * i + (gap - barWidth) / 2;
        const y = marginTop + chartH - barH;

        // Gradient bar
        const grad = ctx.createLinearGradient(x, y + barH, x, y);
        const colors = CHART_GRADIENTS[i % CHART_GRADIENTS.length];
        grad.addColorStop(0, colors[0]);
        grad.addColorStop(1, colors[1]);

        ctx.fillStyle = grad;
        ctx.fillRect(x, y, barWidth, barH);

        barRects.push({ x, y, w: barWidth, h: barH, key, val });

        // Month label
        const label = formatMonthLabel(key);
        ctx.fillStyle = tc.textMuted;
        ctx.font = '500 10px ' + tc.fontSans;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(label, x + barWidth / 2, marginTop + chartH + 8);
    });

    // Tooltip
    canvas.onmousemove = function (e) {
        const rect = canvas.getBoundingClientRect();
        const mx = (e.clientX - rect.left);
        const my = (e.clientY - rect.top);
        const hit = barRects.find(r => mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h);
        if (hit) {
            showTooltip(e.clientX, e.clientY,
                `${formatMonthLabel(hit.key)}: ₹${hit.val.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
            );
            canvas.style.cursor = 'pointer';
        } else {
            hideTooltip();
            canvas.style.cursor = 'default';
        }
    };
    canvas.onmouseleave = () => { hideTooltip(); canvas.style.cursor = 'default'; };
}

// ============================================================
// TOP 5 CATEGORIES (Horizontal bars)
// ============================================================
function renderTop5() {
    const tc = getThemeColors();
    const container = document.getElementById('top5List');
    const catMap = {};
    dashFiltered.forEach(e => {
        const cat = getBaseCategory(e.account_name);
        catMap[cat] = (catMap[cat] || 0) + (parseFloat(e.total) || 0);
    });

    const sorted = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const maxVal = sorted.length > 0 ? sorted[0][1] : 1;

    if (sorted.length === 0) {
        container.innerHTML = '<div style="text-align:center;color:' + tc.noData + ';padding:2rem;font-size:0.88rem;">No data available</div>';
        return;
    }

    container.innerHTML = sorted.map(([cat, val], i) => {
        const pct = (val / maxVal * 100).toFixed(1);
        return `
            <div class="top5-item">
                <div class="top5-header">
                    <span class="top5-name">${escapeHtml(cat)}</span>
                    <span class="top5-amount">₹${val.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                </div>
                <div class="top5-bar-track">
                    <div class="top5-bar-fill" style="width: 0%" data-width="${pct}%"></div>
                </div>
            </div>
        `;
    }).join('');

    // Animate bars in
    requestAnimationFrame(() => {
        container.querySelectorAll('.top5-bar-fill').forEach(bar => {
            bar.style.width = bar.dataset.width;
        });
    });
}

// ============================================================
// DAILY SPENDING — Area/Line Chart
// ============================================================
function renderDailyChart() {
    const tc = getThemeColors();
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const canvas = document.getElementById('chartDaily');
    const container = canvas.parentElement;
    const width = container.clientWidth - 40;
    const height = 200;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    // Aggregate by date
    const dayMap = {};
    dashFiltered.forEach(e => {
        if (!e.date) return;
        dayMap[e.date] = (dayMap[e.date] || 0) + (parseFloat(e.total) || 0);
    });

    const keys = Object.keys(dayMap).sort();
    const values = keys.map(k => dayMap[k]);

    if (keys.length === 0) {
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = tc.noData;
        ctx.font = '500 14px ' + tc.fontSans;
        ctx.textAlign = 'center';
        ctx.fillText('No data available', width / 2, height / 2);
        return;
    }

    const maxVal = Math.max(...values) * 1.2 || 1;
    const marginLeft = 65;
    const marginBottom = 30;
    const marginTop = 10;
    const marginRight = 20;
    const chartW = width - marginLeft - marginRight;
    const chartH = height - marginBottom - marginTop;

    ctx.clearRect(0, 0, width, height);

    // Grid
    const gridLines = 4;
    ctx.strokeStyle = tc.gridLine;
    ctx.lineWidth = 1;
    ctx.fillStyle = tc.textMuted;
    ctx.font = '500 10px ' + tc.fontMono;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    for (let i = 0; i <= gridLines; i++) {
        const y = marginTop + chartH - (chartH * i / gridLines);
        const val = (maxVal * i / gridLines);
        ctx.beginPath();
        ctx.setLineDash([3, 3]);
        ctx.moveTo(marginLeft, y);
        ctx.lineTo(width - marginRight, y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillText('₹' + abbreviate(val), marginLeft - 8, y);
    }

    // Build points
    const points = keys.map((k, i) => ({
        x: marginLeft + (chartW * i / (keys.length - 1 || 1)),
        y: marginTop + chartH - (values[i] / maxVal * chartH),
        date: k,
        val: values[i]
    }));

    // Area fill
    const areaGrad = ctx.createLinearGradient(0, marginTop, 0, marginTop + chartH);
    areaGrad.addColorStop(0, isDark ? 'rgba(139, 92, 246, 0.25)' : 'rgba(124, 58, 237, 0.2)');
    areaGrad.addColorStop(1, isDark ? 'rgba(139, 92, 246, 0.02)' : 'rgba(124, 58, 237, 0.02)');

    ctx.beginPath();
    ctx.moveTo(points[0].x, marginTop + chartH);
    points.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(points[points.length - 1].x, marginTop + chartH);
    ctx.closePath();
    ctx.fillStyle = areaGrad;
    ctx.fill();

    // Line
    ctx.beginPath();
    points.forEach((p, i) => {
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
    });
    ctx.strokeStyle = '#8b5cf6';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();

    // Dots
    points.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3.5, 0, 2 * Math.PI);
        ctx.fillStyle = '#8b5cf6';
        ctx.fill();
        ctx.strokeStyle = tc.cardBg;
        ctx.lineWidth = 2;
        ctx.stroke();
    });

    // X labels (show max 8)
    const labelStep = Math.max(1, Math.ceil(keys.length / 8));
    ctx.fillStyle = tc.textMuted;
    ctx.font = '500 9px ' + tc.fontSans;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    keys.forEach((k, i) => {
        if (i % labelStep === 0 || i === keys.length - 1) {
            const x = marginLeft + (chartW * i / (keys.length - 1 || 1));
            ctx.fillText(formatShortDate(k), x, marginTop + chartH + 8);
        }
    });

    // Tooltip
    canvas.onmousemove = function (e) {
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const hit = points.find(p => Math.abs(mx - p.x) < 12);
        if (hit) {
            showTooltip(e.clientX, e.clientY,
                `${formatDateFull(hit.date)}: ₹${hit.val.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
            );
            canvas.style.cursor = 'pointer';
        } else {
            hideTooltip();
            canvas.style.cursor = 'default';
        }
    };
    canvas.onmouseleave = () => { hideTooltip(); canvas.style.cursor = 'default'; };
}

// ============================================================
// PAYMENT METHOD PIE CHART
// ============================================================
function renderPaymentChart() {
    const tc = getThemeColors();
    const canvas = document.getElementById('chartPayment');
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const size = 240;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
    ctx.scale(dpr, dpr);

    const payMap = {};
    dashFiltered.forEach(e => {
        const method = e.paid_through_account_name || 'Unknown';
        payMap[method] = (payMap[method] || 0) + (parseFloat(e.total) || 0);
    });

    const sorted = Object.entries(payMap).sort((a, b) => b[1] - a[1]);
    const total = sorted.reduce((s, [, v]) => s + v, 0);

    if (sorted.length === 0 || total === 0) {
        ctx.clearRect(0, 0, size, size);
        ctx.fillStyle = tc.noData;
        ctx.font = '500 14px ' + tc.fontSans;
        ctx.textAlign = 'center';
        ctx.fillText('No data', size / 2, size / 2);
        document.getElementById('paymentLegend').innerHTML = '';
        return;
    }

    const cx = size / 2, cy = size / 2, radius = 95;
    let startAngle = -Math.PI / 2;
    const slices = [];

    ctx.clearRect(0, 0, size, size);

    // Use offset colors for payment to differentiate from category pie
    const payColors = ['#3b82f6', '#f59e0b', '#22c55e', '#a855f7', '#f43f5e', '#06b6d4', '#6366f1', '#ec4899'];

    sorted.forEach(([method, val], i) => {
        const sliceAngle = (val / total) * 2 * Math.PI;
        const color = payColors[i % payColors.length];

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, radius, startAngle, startAngle + sliceAngle);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = tc.cardBg;
        ctx.lineWidth = 2;
        ctx.stroke();

        slices.push({ method, val, color, startAngle, endAngle: startAngle + sliceAngle });
        startAngle += sliceAngle;
    });

    // Donut hole
    ctx.beginPath();
    ctx.arc(cx, cy, 50, 0, 2 * Math.PI);
    ctx.fillStyle = tc.cardBg;
    ctx.fill();

    ctx.fillStyle = tc.text;
    ctx.font = '700 12px ' + tc.fontMono;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(sorted.length + '', cx, cy - 4);
    ctx.font = '500 9px ' + tc.fontSans;
    ctx.fillStyle = tc.textMuted;
    ctx.fillText('METHODS', cx, cy + 10);

    // Legend
    const legendEl = document.getElementById('paymentLegend');
    legendEl.innerHTML = sorted.slice(0, 5).map(([method, val], i) => `
        <div class="pie-legend-item">
            <div class="pie-legend-dot" style="background:${payColors[i % payColors.length]}"></div>
            <span class="pie-legend-label">${escapeHtml(method)}</span>
            <span class="pie-legend-value">${((val / total) * 100).toFixed(1)}%</span>
        </div>
    `).join('');

    // Tooltip
    canvas.onmousemove = function (e) {
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const dx = mx - cx, dy = my - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 50 && dist < radius) {
            let angle = Math.atan2(dy, dx);
            if (angle < -Math.PI / 2) angle += 2 * Math.PI;
            const slice = slices.find(s => angle >= s.startAngle && angle < s.endAngle);
            if (slice) {
                showTooltip(e.clientX, e.clientY,
                    `${slice.method}: ₹${slice.val.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
                );
                return;
            }
        }
        hideTooltip();
    };
    canvas.onmouseleave = hideTooltip;
}

// ============================================================
// RECENT EXPENSES LIST
// ============================================================
function renderRecentList() {
    const tc = getThemeColors();
    const container = document.getElementById('recentList');
    const recent = [...dashFiltered]
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
        .slice(0, 8);

    if (recent.length === 0) {
        container.innerHTML = '<div style="text-align:center;color:' + tc.noData + ';padding:2rem;font-size:0.88rem;">No recent expenses</div>';
        return;
    }

    const dotColors = ['#8b5cf6', '#22c55e', '#3b82f6', '#f59e0b', '#a855f7', '#f43f5e', '#06b6d4', '#6366f1'];

    container.innerHTML = recent.map((e, i) => `
        <div class="recent-item">
            <div class="recent-dot" style="background:${dotColors[i % dotColors.length]}"></div>
            <div class="recent-info">
                <div class="recent-cat">${escapeHtml(getBaseCategory(e.account_name))}</div>
                <div class="recent-date">${formatDateFull(e.date)}</div>
            </div>
            <div class="recent-amount">₹${(parseFloat(e.total) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
    `).join('');
}

// ============================================================
// COMPANY BREAKDOWN BAR CHART
// ============================================================
function renderCompanyChart() {
    const tc = getThemeColors();
    const canvas = document.getElementById('chartCompany');
    if (!canvas) return;
    const container = canvas.parentElement;
    const width = container.clientWidth - 40;
    const height = 220;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    // Aggregate both Expenses and Incomes by company
    const compMap = {};
    const knownCompanies = typeof getCompanies === 'function'
        ? getCompanies().map(c => c.company_name)
        : ['ECBC', '2024', 'MINING', 'LAYOUT', 'ATC'];
    
    // Initialize map
    knownCompanies.forEach(c => compMap[c] = { income: 0, expense: 0 });
    compMap['Unknown'] = { income: 0, expense: 0 };

    dashFilteredDatesOnly.forEach(e => {
        const comp = resolveExpenseCompany(e) || 'Unknown';
        if (!compMap[comp]) compMap[comp] = { income: 0, expense: 0 };
        compMap[comp].expense += (parseFloat(e.total) || 0);
    });

    dashFilteredIncomesDatesOnly.forEach(i => {
        const comp = i.company || 'Unknown';
        if (!compMap[comp]) compMap[comp] = { income: 0, expense: 0 };
        compMap[comp].income += (parseFloat(i.amount) || 0);
    });

    // Keys to show: only those with either values > 0 or in known list
    const keys = Object.keys(compMap).filter(k => 
        compMap[k].income > 0 || compMap[k].expense > 0 || (k !== 'Unknown' && knownCompanies.includes(k))
    ).sort();

    if (keys.length === 0) {
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = tc.noData;
        ctx.font = '500 14px ' + tc.fontSans;
        ctx.textAlign = 'center';
        ctx.fillText('No data available', width / 2, height / 2);
        return;
    }

    const maxVal = Math.max(...keys.map(k => Math.max(compMap[k].income, compMap[k].expense))) * 1.15 || 1;
    const marginLeft = 65;
    const marginBottom = 36;
    const marginTop = 10;
    const chartW = width - marginLeft - 20;
    const chartH = height - marginBottom - marginTop;
    
    const groupGap = chartW / keys.length;
    const barWidth = Math.min(24, (groupGap * 0.35));

    ctx.clearRect(0, 0, width, height);

    // Grid lines
    const gridLines = 5;
    ctx.strokeStyle = tc.gridLine;
    ctx.lineWidth = 1;
    ctx.fillStyle = tc.textMuted;
    ctx.font = '500 10px ' + tc.fontMono;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    for (let i = 0; i <= gridLines; i++) {
        const y = marginTop + chartH - (chartH * i / gridLines);
        const val = (maxVal * i / gridLines);

        ctx.beginPath();
        ctx.setLineDash([3, 3]);
        ctx.moveTo(marginLeft, y);
        ctx.lineTo(width - 20, y);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillText('₹' + abbreviate(val), marginLeft - 8, y);
    }

    const barRects = [];
    keys.forEach((key, i) => {
        const data = compMap[key];
        const incH = (data.income / maxVal) * chartH;
        const expH = (data.expense / maxVal) * chartH;

        const groupX = marginLeft + groupGap * i;
        const incX = groupX + (groupGap - (barWidth * 2 + 4)) / 2;
        const expX = incX + barWidth + 4;

        const incY = marginTop + chartH - incH;
        const expY = marginTop + chartH - expH;

        // Draw Income (Green Gradient)
        const incGrad = ctx.createLinearGradient(incX, incY + incH, incX, incY);
        incGrad.addColorStop(0, tc.incomeGrad[0]);
        incGrad.addColorStop(1, tc.incomeGrad[1]);
        ctx.fillStyle = incGrad;
        ctx.fillRect(incX, incY, barWidth, incH);
        barRects.push({ x: incX, y: incY, w: barWidth, h: incH, type: 'Income', company: key, val: data.income });

        // Draw Expense (Red Gradient)
        const expGrad = ctx.createLinearGradient(expX, expY + expH, expX, expY);
        expGrad.addColorStop(0, tc.expenseGrad[0]);
        expGrad.addColorStop(1, tc.expenseGrad[1]);
        ctx.fillStyle = expGrad;
        ctx.fillRect(expX, expY, barWidth, expH);
        barRects.push({ x: expX, y: expY, w: barWidth, h: expH, type: 'Expense', company: key, val: data.expense });

        ctx.fillStyle = tc.textMuted;
        ctx.font = '500 10px ' + tc.fontSans;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(key, groupX + groupGap / 2, marginTop + chartH + 8);
    });

    // Tooltip
    canvas.onmousemove = function (e) {
        const rect = canvas.getBoundingClientRect();
        const mx = (e.clientX - rect.left);
        const my = (e.clientY - rect.top);
        const hit = barRects.find(r => mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h);
        if (hit) {
            showTooltip(e.clientX, e.clientY,
                `${hit.company} ${hit.type}: ₹${hit.val.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
            );
            canvas.style.cursor = 'pointer';
        } else {
            hideTooltip();
            canvas.style.cursor = 'default';
        }
    };
    canvas.onmouseleave = () => { hideTooltip(); canvas.style.cursor = 'default'; };
}

// ============================================================
// NEW CHARTS — INCOME STREAM & MONTHLY CASH FLOW
// ============================================================
function renderIncomeCompanyPieChart() {
    const tc = getThemeColors();
    const canvas = document.getElementById('chartIncomeCompany');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const size = 240;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
    ctx.scale(dpr, dpr);

    const companyMap = {};
    dashFilteredIncomes.forEach(i => {
        const company = i.company || 'Other';
        companyMap[company] = (companyMap[company] || 0) + (parseFloat(i.amount) || 0);
    });

    const sorted = Object.entries(companyMap).sort((a, b) => b[1] - a[1]);
    const total = sorted.reduce((s, [, v]) => s + v, 0);

    if (sorted.length === 0 || total === 0) {
        ctx.clearRect(0, 0, size, size);
        ctx.fillStyle = tc.noData;
        ctx.font = '500 14px ' + tc.fontSans;
        ctx.textAlign = 'center';
        ctx.fillText('No data available', size / 2, size / 2);
        document.getElementById('incomeCompanyLegend').innerHTML = '';
        return;
    }

    const cx = size / 2, cy = size / 2, radius = 95;
    let startAngle = -Math.PI / 2;
    const slices = [];

    ctx.clearRect(0, 0, size, size);
    
    // Modern vibrant color palette for income
    const incColors = ['#22c55e', '#3b82f6', '#f59e0b', '#a855f7', '#f43f5e', '#4ade80', '#0ea5e9', '#eab308'];

    sorted.forEach(([company, val], i) => {
        const sliceAngle = (val / total) * 2 * Math.PI;
        const color = incColors[i % incColors.length];

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, radius, startAngle, startAngle + sliceAngle);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = tc.cardBg;
        ctx.lineWidth = 2;
        ctx.stroke();

        slices.push({ company, val, color, startAngle, endAngle: startAngle + sliceAngle });
        startAngle += sliceAngle;
    });

    // Donut hole
    ctx.beginPath();
    ctx.arc(cx, cy, 50, 0, 2 * Math.PI);
    ctx.fillStyle = tc.cardBg;
    ctx.fill();

    ctx.fillStyle = tc.text;
    ctx.font = '700 11px ' + tc.fontMono;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('₹' + abbreviate(total), cx, cy - 6);
    ctx.font = '500 8px ' + tc.fontSans;
    ctx.fillStyle = tc.textMuted;
    ctx.fillText('TOTAL INCOME', cx, cy + 8);

    // Legend
    const legendEl = document.getElementById('incomeCompanyLegend');
    legendEl.innerHTML = sorted.slice(0, 5).map(([company, val], i) => `
        <div class="pie-legend-item">
            <div class="pie-legend-dot" style="background:${incColors[i % incColors.length]}"></div>
            <span class="pie-legend-label">${escapeHtml(company)}</span>
            <span class="pie-legend-value">${((val / total) * 100).toFixed(1)}%</span>
        </div>
    `).join('');

    // Tooltip
    canvas.onmousemove = function (e) {
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const dx = mx - cx, dy = my - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 50 && dist < radius) {
            let angle = Math.atan2(dy, dx);
            if (angle < -Math.PI / 2) angle += 2 * Math.PI;
            const slice = slices.find(s => angle >= s.startAngle && angle < s.endAngle);
            if (slice) {
                showTooltip(e.clientX, e.clientY,
                    `${slice.company}: ₹${slice.val.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
                );
                return;
            }
        }
        hideTooltip();
    };
    canvas.onmouseleave = hideTooltip;
}

function renderCashFlowChart() {
    const tc = getThemeColors();
    const canvas = document.getElementById('chartCashFlow');
    if (!canvas) return;
    const container = canvas.parentElement;
    const width = container.clientWidth - 40;
    const height = 220;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    // Aggregate expenses and incomes by month
    const cashMap = {};
    dashFiltered.forEach(e => {
        if (!e.date) return;
        const key = e.date.substring(0, 7);
        if (!cashMap[key]) cashMap[key] = { income: 0, expense: 0 };
        cashMap[key].expense += (parseFloat(e.total) || 0);
    });
    dashFilteredIncomes.forEach(i => {
        if (!i.date) return;
        const key = i.date.substring(0, 7);
        if (!cashMap[key]) cashMap[key] = { income: 0, expense: 0 };
        cashMap[key].income += (parseFloat(i.amount) || 0);
    });

    const keys = Object.keys(cashMap).sort();
    
    if (keys.length === 0) {
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = tc.noData;
        ctx.font = '500 14px ' + tc.fontSans;
        ctx.textAlign = 'center';
        ctx.fillText('No data available', width / 2, height / 2);
        return;
    }

    const maxVal = Math.max(...keys.map(k => Math.max(cashMap[k].income, cashMap[k].expense))) * 1.15 || 1;
    const marginLeft = 65;
    const marginBottom = 36;
    const marginTop = 10;
    const chartW = width - marginLeft - 20;
    const chartH = height - marginBottom - marginTop;
    
    const groupGap = chartW / keys.length;
    const barWidth = Math.min(22, (groupGap * 0.4));
    
    ctx.clearRect(0, 0, width, height);

    // Grid lines
    const gridLines = 5;
    ctx.strokeStyle = tc.gridLine;
    ctx.lineWidth = 1;
    ctx.fillStyle = tc.textMuted;
    ctx.font = '500 10px ' + tc.fontMono;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    for (let i = 0; i <= gridLines; i++) {
        const y = marginTop + chartH - (chartH * i / gridLines);
        const val = (maxVal * i / gridLines);

        ctx.beginPath();
        ctx.setLineDash([3, 3]);
        ctx.moveTo(marginLeft, y);
        ctx.lineTo(width - 20, y);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillText('₹' + abbreviate(val), marginLeft - 8, y);
    }

    const barRects = [];
    keys.forEach((key, i) => {
        const data = cashMap[key];
        const incH = (data.income / maxVal) * chartH;
        const expH = (data.expense / maxVal) * chartH;

        const groupX = marginLeft + groupGap * i;
        const incX = groupX + (groupGap - (barWidth * 2 + 4)) / 2;
        const expX = incX + barWidth + 4;
        
        const incY = marginTop + chartH - incH;
        const expY = marginTop + chartH - expH;

        // Draw Inflow (Income)
        const incGrad = ctx.createLinearGradient(incX, incY + incH, incX, incY);
        incGrad.addColorStop(0, tc.incomeGrad[0]);
        incGrad.addColorStop(1, tc.incomeGrad[1]);
        ctx.fillStyle = incGrad;
        ctx.fillRect(incX, incY, barWidth, incH);
        barRects.push({ x: incX, y: incY, w: barWidth, h: incH, type: 'Income', month: key, val: data.income });

        // Draw Outflow (Expense)
        const expGrad = ctx.createLinearGradient(expX, expY + expH, expX, expY);
        expGrad.addColorStop(0, tc.expenseGrad[0]);
        expGrad.addColorStop(1, tc.expenseGrad[1]);
        ctx.fillStyle = expGrad;
        ctx.fillRect(expX, expY, barWidth, expH);
        barRects.push({ x: expX, y: expY, w: barWidth, h: expH, type: 'Expense', month: key, val: data.expense });

        const label = formatMonthLabel(key);
        ctx.fillStyle = tc.textMuted;
        ctx.font = '500 10px ' + tc.fontSans;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(label, groupX + groupGap / 2, marginTop + chartH + 8);
    });

    canvas.onmousemove = function (e) {
        const rect = canvas.getBoundingClientRect();
        const mx = (e.clientX - rect.left);
        const my = (e.clientY - rect.top);
        const hit = barRects.find(r => mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h);
        if (hit) {
            showTooltip(e.clientX, e.clientY,
                `${formatMonthLabel(hit.month)} ${hit.type}: ₹${hit.val.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
            );
            canvas.style.cursor = 'pointer';
        } else {
            hideTooltip();
            canvas.style.cursor = 'default';
        }
    };
    canvas.onmouseleave = () => { hideTooltip(); canvas.style.cursor = 'default'; };
}

// ============================================================
// HELPERS
// ============================================================
function getBaseCategory(accountName) {
    if (!accountName) return 'Uncategorized';
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
            return parts.slice(0, -1).join(' - ').trim();
        }
    }
    return accountName.trim();
}

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

function formatISO(d) {
    return d.getFullYear() + '-' +
        String(d.getMonth() + 1).padStart(2, '0') + '-' +
        String(d.getDate()).padStart(2, '0');
}

function formatMonthLabel(yyyymm) {
    const [y, m] = yyyymm.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[parseInt(m, 10) - 1] + ' ' + y.slice(2);
}

function formatShortDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function formatDateFull(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function abbreviate(n) {
    if (n >= 10000000) return (n / 10000000).toFixed(1) + 'Cr';
    if (n >= 100000) return (n / 100000).toFixed(1) + 'L';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toFixed(0);
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
}

// ---- Redraw charts on resize ----
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        if (dashFiltered.length > 0 || dashFilteredIncomes.length > 0) {
            renderBarChart();
            renderCashFlowChart();
            renderDailyChart();
            renderCompanyChart();
        }
    }, 200);
});

// ---- Auto-refresh when new transaction is added ----
window.addEventListener('storage', function (e) {
    if (e.key === 'expense_added' || e.key === 'income_added') {
        setTimeout(() => loadDashboard(), 1000);
    }
});

// Re-render charts when theme changes
document.addEventListener('themechange', () => {
    if (dashFiltered.length > 0 || dashFilteredIncomes.length > 0) {
        renderDashboard();
    }
});

// ---- Initial load ----
const now = new Date();
if (document.getElementById('dashFrom')) {
    document.getElementById('dashFrom').value = formatISO(new Date(now.getFullYear(), now.getMonth(), 1));
}
if (document.getElementById('dashTo')) {
    document.getElementById('dashTo').value = formatISO(now);
}

// Populate company filter dropdown
const dashCompany = document.getElementById('dashCompany');
if (dashCompany && typeof getCompanyOptionsHTML === 'function') {
    dashCompany.innerHTML = '<option value="">All</option>' + getCompanyOptionsHTML();
}

loadDashboard();
