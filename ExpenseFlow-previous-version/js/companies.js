// ============================================================
// DYNAMIC COMPANY MANAGEMENT
// ============================================================

// Key for local storage
const COMPANIES_STORAGE_KEY = 'expenseflow_companies';
const STORAGE_SYNC_KEY = 'companies_updated';

// Empty default list as requested: "dont need any default when we add it should be available"
const DEFAULT_COMPANIES = [];

// Helper to escape HTML characters to prevent XSS
function escapeHtml(str) {
    if (!str) return '';
    return str.toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Get company list from localStorage
function getCompanies() {
    const stored = localStorage.getItem(COMPANIES_STORAGE_KEY);
    if (!stored) {
        localStorage.setItem(COMPANIES_STORAGE_KEY, JSON.stringify(DEFAULT_COMPANIES));
        return DEFAULT_COMPANIES;
    }
    try {
        return JSON.parse(stored);
    } catch (e) {
        console.error("Failed to parse companies from storage, using defaults", e);
        return DEFAULT_COMPANIES;
    }
}

// Save company list to localStorage
function saveCompanies(companies) {
    localStorage.setItem(COMPANIES_STORAGE_KEY, JSON.stringify(companies));
    // Trigger sync event for other tabs
    localStorage.setItem(STORAGE_SYNC_KEY, Date.now().toString());
}

// Generate option HTML tags for company selects
function getCompanyOptionsHTML() {
    const companies = getCompanies();
    if (companies.length === 0) {
        return `<option value="" disabled>— No Companies Added —</option>`;
    }
    return companies.map(c => `<option value="${escapeHtml(c.company_name)}">${escapeHtml(c.company_name)}</option>`).join('');
}

// Update all company select elements on the page dynamically
function updateAllCompanySelects() {
    // 1. Update form dropdowns (class .company-input)
    const companyInputs = document.querySelectorAll('.company-input');
    companyInputs.forEach(select => {
        const currentVal = select.value;
        select.innerHTML = '<option value="">— Select —</option>' + getCompanyOptionsHTML();
        select.value = currentVal;
    });

    // 2. Update filter dropdowns (id filterCompany)
    const filterCompany = document.getElementById('filterCompany');
    if (filterCompany) {
        const currentVal = filterCompany.value;
        filterCompany.innerHTML = '<option value="">All</option>' + getCompanyOptionsHTML();
        filterCompany.value = currentVal;
    }

    // 3. Update dashboard dropdown (id dashCompany)
    const dashCompany = document.getElementById('dashCompany');
    if (dashCompany) {
        const currentVal = dashCompany.value;
        dashCompany.innerHTML = '<option value="">All</option>' + getCompanyOptionsHTML();
        dashCompany.value = currentVal;
        
        // Re-run dashboard filter when company list is modified in background
        if (typeof applyDashFilters === 'function') {
            applyDashFilters();
        }
    }
}

// Open modal overlay
function openAddCompanyModal() {
    const overlay = document.getElementById('companyModalOverlay');
    if (overlay) {
        overlay.classList.add('visible');
        const firstInput = document.getElementById('newCompanyName');
        if (firstInput) firstInput.focus();
    }
}

// Close modal overlay and reset form
function closeAddCompanyModal() {
    const overlay = document.getElementById('companyModalOverlay');
    if (overlay) {
        overlay.classList.remove('visible');
    }
    const form = document.getElementById('addCompanyForm');
    if (form) {
        form.reset();
    }
}

// Fetch companies from the n8n webhook and update dropdowns
async function fetchCompanyNames() {
    try {
        const url = (typeof CONFIG !== 'undefined' && CONFIG.COMPANY_NAMES_URL) || "https://n8n.skillednation.ai/webhook/company_names";
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        if (Array.isArray(data)) {
            // Map webhook companies to standard format
            const webhookCompanies = data.map(c => ({
                company_name: c.company_name,
                zoho_organization_id: "60061889304"
            }));
            
            // Get current local companies to preserve any unsynced ones
            const currentLocal = getCompanies();
            
            // Merge: start with webhook companies
            const merged = [...webhookCompanies];
            
            // Add local ones if they aren't in the webhook list yet
            currentLocal.forEach(local => {
                const exists = merged.some(w => w.company_name.toLowerCase() === local.company_name.toLowerCase());
                if (!exists) {
                    merged.push(local);
                }
            });
            
            // Save and update
            saveCompanies(merged);
            updateAllCompanySelects();
        }
    } catch (error) {
        console.error("Failed to fetch company names from webhook:", error);
    }
}

// Inject Modal HTML dynamically into DOM on page load
function injectAddCompanyModal() {
    if (document.getElementById('companyModalOverlay')) return; // Already injected

    const modalHTML = `
        <div class="company-modal-overlay" id="companyModalOverlay">
            <div class="company-modal-card">
                <div class="company-modal-header">
                    <h3 class="company-modal-title">Add New Company</h3>
                    <button class="company-modal-close" onclick="closeAddCompanyModal()" aria-label="Close modal">✕</button>
                </div>
                <form id="addCompanyForm" class="company-modal-form">
                    <div class="form-group">
                        <label for="newCompanyName">Company Name</label>
                        <input type="text" id="newCompanyName" placeholder="e.g. PERSONAL" required autocomplete="off">
                    </div>
                    <div class="company-modal-actions">
                        <button type="button" class="btn btn-outline btn-sm" onclick="closeAddCompanyModal()">Cancel</button>
                        <button type="submit" class="btn btn-primary btn-sm" id="saveCompanyBtn">
                            Save Company
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Bind form submit event
    const form = document.getElementById('addCompanyForm');
    if (form) {
        form.addEventListener('submit', async function(e) {
            e.preventDefault();

            const nameInput = document.getElementById('newCompanyName');
            const saveBtn = document.getElementById('saveCompanyBtn');

            const companyName = nameInput.value.trim();
            const zohoOrgId = "60061889304"; // Set internally and keep as default

            if (!companyName) return;

            // Show loading state
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" class="spin"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg> Saving...';

            try {
                // Call dynamic create company webhook
                const response = await fetch(CONFIG.CREATE_COMPANY_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        company_name: companyName,
                        zoho_organization_id: zohoOrgId
                    })
                });

                if (!response.ok) {
                    throw new Error(`n8n returned HTTP ${response.status}`);
                }

                // Add to list and persist
                const currentCompanies = getCompanies();
                
                // Avoid duplicates
                const exists = currentCompanies.some(c => c.company_name.toLowerCase() === companyName.toLowerCase());
                if (!exists) {
                    currentCompanies.push({
                        company_name: companyName,
                        zoho_organization_id: zohoOrgId
                    });
                    saveCompanies(currentCompanies);
                }

                // Show success message
                if (typeof showToast === 'function') {
                    showToast(`Company "${companyName}" added successfully!`, 'success');
                }

                // Close and refresh dropdowns
                closeAddCompanyModal();
                updateAllCompanySelects();

                // Fetch updated company list from webhook
                fetchCompanyNames();

            } catch (err) {
                console.error("Error creating company via webhook:", err);
                
                // Fallback: Add locally anyway so the user is not blocked
                const currentCompanies = getCompanies();
                const exists = currentCompanies.some(c => c.company_name.toLowerCase() === companyName.toLowerCase());
                if (!exists) {
                    currentCompanies.push({
                        company_name: companyName,
                        zoho_organization_id: zohoOrgId
                    });
                    saveCompanies(currentCompanies);
                }

                // Show warning message with the error details
                if (typeof showToast === 'function') {
                    showToast(`Webhook sync failed (${err.message || err}), but "${companyName}" was added locally.`, 'warning', 6000);
                } else {
                    alert(`Webhook sync failed (${err.message || err}), but "${companyName}" was added locally.`);
                }

                closeAddCompanyModal();
                updateAllCompanySelects();
            } finally {
                saveBtn.disabled = false;
                saveBtn.innerHTML = 'Save Company';
            }
        });
    }
}

// Cross-tab synchronization via storage event
window.addEventListener('storage', function(e) {
    if (e.key === STORAGE_SYNC_KEY) {
        updateAllCompanySelects();
    }
});

// Setup on DOM loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        injectAddCompanyModal();
        updateAllCompanySelects();
        fetchCompanyNames();
    });
} else {
    injectAddCompanyModal();
    updateAllCompanySelects();
    fetchCompanyNames();
}

