// ============================================================
// INCOME FORM LOGIC
// ============================================================
console.log("income.js loaded: text input source field v4");

// Uses CONFIG.INCOME_WEBHOOK_URL from config.js

const incomeContainer = document.getElementById('incomeContainer');
let rowCount = 0;

function createRow() {
    rowCount++;
    const rowId = `row_${rowCount}`;
    const rowHTML = `
        <div class="expense-card" id="${rowId}">
            <div class="expense-header">
                <span class="expense-entry-label">Income Entry #${rowCount}</span>
                ${rowCount > 1 ? `<button type="button" class="btn btn-danger-ghost" onclick="removeRow('${rowId}')">✕ Remove</button>` : ''}
            </div>
            <div class="expense-grid">
                <div class="form-group">
                    <label>Date</label>
                    <input type="date" class="date-input" required>
                </div>
                <div class="form-group">
                    <label>Company</label>
                    <select class="company-input" required>
                        <option value="">— Select —</option>
                        ${getCompanyOptionsHTML()}
                    </select>
                </div>
                <div class="form-group">
                    <label>Amount (₹)</label>
                    <input type="number" class="amount-input" step="0.01" required placeholder="0.00" oninput="updateTotal()">
                </div>
                <div class="form-group">
                    <label>Source</label>
                    <input type="text" class="source-input" required placeholder="e.g. Client Payment, Dividend, etc." autocomplete="off">
                </div>
                <div class="form-group" style="grid-column: 1 / -1;">
                    <label>Notes</label>
                    <input type="text" class="notes-input" placeholder="Additional details...">
                </div>
            </div>
        </div>
    `;

    incomeContainer.insertAdjacentHTML('beforeend', rowHTML);
    setupRowLogic(document.getElementById(rowId));
}

function setupRowLogic(row) {
    const dateInput = row.querySelector('.date-input');
    dateInput.valueAsDate = new Date();
}

function removeRow(rowId) {
    document.getElementById(rowId)?.remove();
    updateTotal();
}

// ---- Live total calculation ----
function updateTotal() {
    const amounts = document.querySelectorAll('.amount-input');
    let total = 0;
    amounts.forEach(input => {
        total += parseFloat(input.value) || 0;
    });
    const el = document.getElementById('runningTotal');
    if (el) {
        el.textContent = '₹' + total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
}

// Initialize first row
createRow();
document.getElementById('addRowBtn').addEventListener('click', createRow);

// ============================================================
// FORM SUBMISSION → n8n Webhook
// ============================================================
document.getElementById('bulkIncomeForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    const btn = document.getElementById('submitBtn');
    const status = document.getElementById('statusMessage');

    btn.innerHTML = '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" class="spin"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg> Syncing...';
    btn.disabled = true;

    const allRows = document.querySelectorAll('.expense-card');
    const payloadData = [];

    allRows.forEach(row => {
        payloadData.push({
            date: row.querySelector('.date-input').value,
            company: row.querySelector('.company-input').value,
            amount: parseFloat(row.querySelector('.amount-input').value),
            source: row.querySelector('.source-input').value,
            notes: row.querySelector('.notes-input').value
        });
    });

    try {
        const response = await fetch(CONFIG.INCOME_WEBHOOK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ incomes: payloadData })
        });

        if (response.ok) {
            if (typeof showToast === 'function') {
                showToast(`${payloadData.length} income record(s) synced to Supabase!`, 'success');
            } else {
                status.textContent = `✓ ${payloadData.length} income record(s) synced to Supabase.`;
                status.className = "message success";
                status.style.display = "block";
            }

            // Signal dashboard / list pages to refresh
            localStorage.setItem('income_added', Date.now().toString());

            setTimeout(() => {
                incomeContainer.innerHTML = '';
                rowCount = 0;
                createRow();
                status.style.display = "none";
                updateTotal();
            }, 3000);
        } else {
            throw new Error("Bad Response");
        }
    } catch (err) {
        if (typeof showToast === 'function') {
            showToast('Connection Error! Ensure n8n Webhook is active.', 'error', 6000);
        } else {
            status.textContent = "Connection Error! Ensure n8n Webhook is active and CORS is enabled.";
            status.className = "message error";
            status.style.display = "block";
        }
    } finally {
        btn.innerHTML = '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg> Sync to Supabase';
        btn.disabled = false;
    }
});
