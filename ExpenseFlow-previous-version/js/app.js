// ============================================================
// EXPENSE FORM LOGIC
// ============================================================

// Uses CONFIG.EXPENSE_WEBHOOK_URL from config.js

const expenseContainer = document.getElementById('expenseContainer');
let rowCount = 0;

function createRow() {
    rowCount++;
    const rowId = `row_${rowCount}`;
    const rowHTML = `
        <div class="expense-card" id="${rowId}">
            <div class="expense-header">
                <span class="expense-entry-label">Entry #${rowCount}</span>
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
                    <label>Category</label>
                    <select class="cat-input" required><option value="">— Select —</option></select>
                </div>
                <div class="form-group">
                    <label>Subcategory</label>
                    <select class="subcat-input" required disabled><option value="">— Select Category First —</option></select>
                </div>
                <div class="form-group hidden custom-subcat-group">
                    <label>Custom Subcategory</label>
                    <input type="text" class="custom-subcat-input" placeholder="Type here...">
                </div>
                <div class="form-group">
                    <label>Amount (₹)</label>
                    <input type="number" class="amount-input" step="0.01" required placeholder="0.00" oninput="updateTotal()">
                </div>
                <div class="form-group">
                    <label>Vendor / Paid To</label>
                    <input type="text" class="vendor-input" required placeholder="Name of business/person">
                </div>
                <div class="form-group">
                    <label>Pay Through</label>
                    <select class="paythrough-input" required>
                        <option value="Petty Cash">Cash</option>
                        <option value="ICICI">ICICI</option>
                        <option value="HDFC">HDFC</option>
                    </select>
                </div>
                <div class="form-group" style="grid-column: 1 / -1;">
                    <label>Notes</label>
                    <input type="text" class="notes-input" placeholder="Brief description...">
                </div>
            </div>
        </div>
    `;
    expenseContainer.insertAdjacentHTML('beforeend', rowHTML);
    setupRowLogic(document.getElementById(rowId));
}

function setupRowLogic(row) {
    const dateInput = row.querySelector('.date-input');
    const catInput = row.querySelector('.cat-input');
    const subcatInput = row.querySelector('.subcat-input');
    const customGroup = row.querySelector('.custom-subcat-group');
    const customInput = row.querySelector('.custom-subcat-input');

    dateInput.valueAsDate = new Date();

    // Populate categories based on CORE BRIGHT grouping from categories.js
    for (const [groupLabel, categories] of Object.entries(coreBrightGroups)) {
        const optgroup = document.createElement('optgroup');
        optgroup.label = groupLabel;
        categories.forEach(cat => {
            if (categoriesData[cat]) {
                const opt = document.createElement('option');
                opt.value = cat;
                opt.textContent = cat;
                optgroup.appendChild(opt);
            }
        });
        catInput.appendChild(optgroup);
    }

    catInput.addEventListener('change', function () {
        subcatInput.innerHTML = '<option value="">— Select Subcategory —</option>';
        customGroup.classList.add('hidden');
        customInput.removeAttribute('required');

        if (this.value) {
            subcatInput.disabled = false;
            const subGroups = categoriesData[this.value];

            for (const [groupName, items] of Object.entries(subGroups)) {
                if (items.length === 0) {
                    const opt = document.createElement('option');
                    opt.value = groupName;
                    opt.textContent = groupName;
                    subcatInput.appendChild(opt);
                } else {
                    const optgroup = document.createElement('optgroup');
                    optgroup.label = "— " + groupName + " —";
                    items.forEach(item => {
                        const opt = document.createElement('option');
                        opt.value = item;
                        opt.textContent = item;
                        optgroup.appendChild(opt);
                    });
                    subcatInput.appendChild(optgroup);
                }
            }

            const otherOpt = document.createElement('option');
            otherOpt.value = "ADD_NEW";
            otherOpt.textContent = "+ Custom Subcategory";
            otherOpt.style.fontWeight = "bold";
            subcatInput.appendChild(otherOpt);
        } else {
            subcatInput.disabled = true;
        }
    });

    subcatInput.addEventListener('change', function () {
        if (this.value === "ADD_NEW") {
            customGroup.classList.remove('hidden');
            customInput.setAttribute('required', 'true');
        } else {
            customGroup.classList.add('hidden');
            customInput.removeAttribute('required');
        }
    });
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
document.getElementById('bulkExpenseForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    const btn = document.getElementById('submitBtn');
    const status = document.getElementById('statusMessage');

    btn.innerHTML = '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" class="spin"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg> Syncing...';
    btn.disabled = true;

    const allRows = document.querySelectorAll('.expense-card');
    const payloadData = [];

    allRows.forEach(row => {
        let finalSubcat = row.querySelector('.subcat-input').value;
        if (finalSubcat === "ADD_NEW") {
            finalSubcat = row.querySelector('.custom-subcat-input').value;
        }
        payloadData.push({
            date: row.querySelector('.date-input').value,
            company: row.querySelector('.company-input').value,
            category: row.querySelector('.cat-input').value,
            subcategory: finalSubcat,
            amount: parseFloat(row.querySelector('.amount-input').value),
            vendor: row.querySelector('.vendor-input').value,
            paid_through: row.querySelector('.paythrough-input').value,
            notes: row.querySelector('.notes-input').value
        });
    });

    try {
        const response = await fetch(CONFIG.EXPENSE_WEBHOOK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ expenses: payloadData })
        });

        if (response.ok) {
            if (typeof showToast === 'function') {
                showToast(`${payloadData.length} expense(s) synced to Zoho Books successfully!`, 'success');
            } else {
                status.textContent = `✓ ${payloadData.length} record(s) synced to Zoho Books.`;
                status.className = "message success";
                status.style.display = "block";
            }
            status.style.display = 'none';

            // Signal expenses page to refresh (cross-tab via localStorage)
            localStorage.setItem('expense_added', Date.now().toString());

            setTimeout(() => {
                expenseContainer.innerHTML = '';
                rowCount = 0;
                createRow();
                status.style.display = "none";
            }, 3000);
        } else {
            throw new Error("Bad Response");
        }
    } catch (err) {
        if (typeof showToast === 'function') {
            showToast('Connection Error! Ensure n8n Webhook has CORS enabled.', 'error', 6000);
        } else {
            status.textContent = "Connection Error! Ensure n8n Webhook has CORS enabled.";
            status.className = "message error";
            status.style.display = "block";
        }
    } finally {
        btn.innerHTML = '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg> Sync to Zoho Books';
        btn.disabled = false;
    }
});
