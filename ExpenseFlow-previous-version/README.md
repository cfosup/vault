# Zoho Books Minimal — Premium Expense Ledger

A high-fidelity, minimal financial tracking dashboard and ledger for Zoho Books and Supabase, powered by n8n webhooks. Designed with modern minimalist aesthetics, dual theme support, smart insights, keyboard shortcuts, and a rich interactive AI assistant.

---

## ✨ Features of the App

- **🎨 Modern Minimalist Design** — Clean card layouts, Inter font family, JetBrains Mono numbers, smooth custom fade-in transitions, and theme-aware styling.
- **🌓 Dual-Theme Engine** — Smooth switching between Light and Dark mode with persistence via `localStorage` and system preference auto-detection.
- **📝 Bulk Transaction Ledger** — Fast input forms for both Expenses (syncing to Zoho Books) and Income (syncing to Supabase) with row addition, removal, and live running tallies.
- **📊 Real-Time Analytics Dashboard** — Interactive Canvas 2D graphs detailing categories, monthly trends, cash flow comparisons, daily velocity, payment methods, and company shares.
- **🧠 Algorithmic Smart Insights** — Real-time computation of Savings Rate (%), Average Daily Spend, Largest Expense, Top Category, and Preferred Payment type.
- **🔍 Tabular Ledger Feed** — Scrollable database grid with text search, column sorting, date-range presets, and conditional color alerts (red for transactions ≥₹50,000, orange for ≥₹10,000).
- **📥 Data Portability** — One-click **Export CSV** download button of currently filtered transactions.
- **💬 Rich AI Financial Assistant** — Embedded chatbot with markdown rendering, inline code highlights, currency pills, copy-on-click message boxes, sessionStorage state, and automatic page context sensing.
- **⌨️ Keyboard Shortcuts** — Press **`?`** on any page to open a hotkey helper sheet (Navigate with `D`, `E`, `I`, `V`; toggle with `T`, `C`).
- **🍞 Toast Notification Container** — Slide-in success, warning, info, and error status updates with timer progress lines.

---

## 📂 Project Structure

```
├── index.html            # Main entry: Bulk Add Expense form
├── income.html           # Bulk Add Income form
├── expenses.html         # Table list of expenses + CSV export
├── dashboard.html        # Interactive charts, filters & insights strip
├── README.md             # Project documentation
├── test-webhook.js       # Test script for webhook endpoints
├── css/
│   ├── styles.css        # Core design tokens, global layouts, toasts, shortcuts, & chat panel
│   └── dashboard.css     # Chart layouts, KPI grid, and insights strip styles
└── js/
    ├── config.js         # Central n8n webhook URL configuration
    ├── theme.js          # Persisted theme engine (Light/Dark toggling)
    ├── toast.js          # Global toast alerts manager
    ├── shortcuts.js      # Global keyboard shortcuts register & overlay
    ├── categories.js     # Expense classification mappings
    ├── app.js            # Expense form submission & bulk sync logic
    ├── income.js         # Income form submission & Supabase sync logic
    ├── expenses.js       # Ledger search, sort, and display logic
    └── dashboard.js      # Canvas chart rendering & smart insights logic
```

---

## ⚙️ Configuration

Set your n8n workflow URLs in **`js/config.js`**:

```javascript
const CONFIG = {
    // Add/create expenses in Zoho Books
    EXPENSE_WEBHOOK_URL: "https://your-n8n-instance/webhook/zohobooks",

    // Get all expenses from Zoho Books
    GET_EXPENSES_URL: "https://your-n8n-instance/webhook/getexpences",

    // n8n Webhook AI Chat assistant
    CHAT_WEBHOOK_URL: "https://your-n8n-instance/webhook/chat",

    // Add/create income in Supabase
    INCOME_WEBHOOK_URL: "https://your-n8n-instance/webhook/add-income",

    // Get all income from Supabase
    GET_INCOMES_URL: "https://your-n8n-instance/webhook/get-income",
};
```

---

## 🗄️ Storage Architecture

- **`localStorage`**: Keeps track of your theme preference (`theme`) and cache refresh state between page navigations.
- **`sessionStorage`**: Retains assistant session (`chatSessionId`) and chat message logs (`chatHistory`) to preserve conversation logs while browsing.
- **Remotes**:
  - **Expenses** sync to **Zoho Books** Chart of Accounts.
  - **Incomes** sync to a **Supabase PostgreSQL** database table.

---

## 🎹 Keyboard Shortcuts Quick Reference

Press **`?`** on any page to open the visual guide.

| Key | Action | Description |
| :--- | :--- | :--- |
| **`D`** | View Dashboard | Navigates to `dashboard.html` |
| **`E`** | Add Expense | Navigates to `index.html` |
| **`I`** | Add Income | Navigates to `income.html` |
| **`V`** | View Expenses | Navigates to `expenses.html` |
| **`T`** | Toggle Theme | Switches between Light and Dark modes |
| **`C`** | Toggle Chat | Opens or minimizes the AI assistant panel |
| **`N`** | New Entry Row | Appends a fresh transaction row to the active form |
| **`/`** | Focus Search | Focuses on the search field (if on view expenses page) |
| **`Esc`** | Close Modals | Closes active shortcuts or chat overlays |
