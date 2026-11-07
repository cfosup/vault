# Vault — Flows, Flaws, and Upgrades

Vault is a multi-company ledger. One organization holds many companies. Those companies hold income and expenses. An expense can be tied to income in the same organization. Budgets, the dashboard, CSV export, and chat all read those same rows. The super-admin screen sits beside the customer app and can see every organization.

Every customer row is stored with the organization id from the signed-in user's token. A second organization gets an empty list. Asking for another organization's company returns not found.

## How a request moves

1. A React page in `client/src/pages` runs a query or mutation from `client/src/graphql`.
2. Apollo attaches `Authorization: Bearer <token>` and posts to `POST /graphql`.
3. `server/src/middleware/auth.js` reads the token and sets `userId`, `orgId`, and `role`.
4. The matching resolver checks login, checks the organization, and reads or writes a model in `server/src/models`.

Customer pages require a normal login token. `/admin` uses a separate token from `adminLogin`. That token is issued only for a user whose role is `superadmin`.

CSV downloads use `GET /export/expenses`, `GET /export/income`, and `GET /export/categories` with the same JWT.

## Layers

| Layer | Where it lives | Job |
|---|---|---|
| Screens | `client/src/pages` and `client/src/components` | Forms, charts, chat drawer, admin login |
| Client state | `client/src/store/authStore.js` and the Apollo cache | Token, user, organization, active company, theme |
| API contract | `server/src/schema/typeDefs` | 32 queries and 31 mutations |
| Rules | Resolvers, `server/src/utils/tenant.js`, `server/src/middleware/auth.js` | Login check, organization filter, company must belong to the organization |
| Services | Budget, chat, email, seed, activity | Spend math, Groq replies, Resend mail, category seed, audit rows |
| Data | 10 Mongoose models | Organization through activity log |
| Files out | `server/src/controllers/exportController.js` | CSV for the signed-in organization |

Outside the customer app: Firebase proves a Google login, Groq writes chat answers, Resend sends welcome and budget emails, and the Render keep-alive pings `/health`. Admin API counts live in server memory, so they reset when the process restarts.

## Money path

Company, then income and expense. An expense can point at one or more income receipts. Spend is checked against a budget. Income and expenses feed the dashboard. Chat answers from those dashboard numbers for the same organization.

## Current flows

Deletes of income and expenses set `isDeleted` rather than removing the row.

### 1. Sign up and sign in

Register creates an organization and an owner user, hashes the password, and returns a JWT. Email login checks the stored password and returns a token. A Google-only account is told to continue with Google. Google sign-in is accepted only after the Firebase ID token is verified. The server uses the email inside that token.

Screens: `client/src/pages/LoginPage.jsx`.

Operations: `checkEmailExists`, `register`, `login`, `firebaseOAuth`.

### 2. Company and chart of accounts

The owner creates a company under the signed-in organization. Marking it a core branch copies 51 categories onto that company. Categories, subcategories, section delete, and reset back to the core template are edited on the companies page. `/categories` only redirects to `/companies`.

Screen: `client/src/pages/CompaniesPage.jsx`.

Operations: `companies`, `categories`, `createCompany`, `updateCompany`, `deleteCompany`, `createCategory`, `deleteCategory`, `deleteCategorySection`, `addSubcategory`, `deleteSubcategory`, `resetCompanyCategoriesToCore`.

### 3. Record income

One or more receipts for a company in this organization: date, amount, source, and notes. The page can create and soft-delete. It does not call `updateIncome`, even though that mutation exists.

Screen: `client/src/pages/IncomePage.jsx`.

Operations: `incomes`, `companies`, `createIncomes`, `deleteIncome`.

### 4. Record an expense

Company, category, amount, vendor, and payment method. The expense can link to one or more income receipts in the same organization, including income that belongs to a different company in that organization. If several incomes are selected, the split amounts must equal the expense amount. After a create, matching budget buckets are recalculated and a budget email can be sent.

The page can create and soft-delete, and it can add a category or subcategory while typing. It does not call `updateExpense`.

Screen: `client/src/pages/ExpensesPage.jsx`.

Operations: `expenses`, `categories`, `paymentMethods`, `incomes`, `companies`, `createExpenses`, `deleteExpense`, `createCategory`, `addSubcategory`.

### 5. Budget check

A bucket caps one category for the month, quarter, year, or custom dates. If start and end dates are empty, monthly, quarterly, and yearly windows use the current period. The page shows used amount, remaining amount, and over-budget state. The page can create and delete a bucket. It does not call `updateBudgetBucket`.

Screen: `client/src/pages/BudgetsPage.jsx`.

Operations: `allBudgetUsages`, `categories`, `companies`, `createBudgetBucket`, `deleteBudgetBucket`.

### 6. Dashboard and export

Totals, category mix, monthly trend, income versus expense, top vendors, payment methods, per-company spend, and income usage for one company. CSV download for expenses, income, and categories.

`allCompaniesIncomeUsage` is implemented on the server. The dashboard asks for one company at a time.

Screen: `client/src/pages/DashboardPage.jsx`.

Operations: `dashboardSummary`, `categoryBreakdown`, `monthlyTrend`, `incomeVsExpenseTrend`, `topVendors`, `paymentMethodBreakdown`, `companySpendBreakdown`, `companyIncomeUsage`, `companies`, `expenses`, plus the three CSV routes.

### 7. Chat

The signed-in user asks about their own organization's numbers. The reply is stored on a chat session and can be cleared. Another organization cannot read that session.

Screen: `client/src/components/chat/ChatPanel.jsx`.

Operations: `chatSession`, `sendChatMessage`, `clearChatSession`.

### 8. Settings

Payment methods, a test email, and profile details already stored in the browser. The page can create and delete a payment method. It does not call `updatePaymentMethod`. The database wipe control has been removed. `POST /api/admin/reset-database` always returns 403 and does not delete rows.

Screen: `client/src/pages/SettingsPage.jsx`.

Operations: `paymentMethods`, `createPaymentMethod`, `deletePaymentMethod`, `sendTestEmail`.

### 9. Super admin

A separate login at `/admin`. Only `role: superadmin` can load platform stats, users, companies, recent activity, API counts, and chatbot usage, and can change a user role to `owner`, `admin`, or `member`. Organization owners and company admins are rejected. Admin login checks the password already stored for that super-admin user. It does not create a user and does not reset an existing password.

Screen: `client/src/pages/AdminDashboardPage.jsx`.

Operations: `adminLogin`, `adminDashboard`, `updateUserRole`.

The separate queries `adminApiMetrics`, `adminChatbotUsage`, `adminActivityLogs`, and `adminUserDetail` work on the API. The admin page reads that same information through `adminDashboard`.

## Current flaws

These are the flaws in the system as it runs today. Sign-up, email login, creating income and expenses, budgets, the dashboard, chat, CSV export, and super-admin access complete. The items below are what those flows still get wrong or leave unfinished.

| Flaw | Where | What goes wrong |
|---|---|---|
| Deleting a company leaves its money behind | `deleteCompany` in `companyResolvers.js` | The company row is removed. Its expenses, income, and budgets stay. The all-company dashboard total still counts that money. The per-company chart drops the company, so the two views no longer match. |
| Recorded expenses, income, budgets, and payment methods cannot be corrected in the app | Expenses, Income, Budgets, and Settings pages | The server mutations `updateExpense`, `updateIncome`, `updateBudgetBucket`, and `updatePaymentMethod` exist. The pages never call them. A wrong amount is fixed by deleting the row and typing it again. |
| Customer roles do not change what a person can do | Every customer resolver | `owner`, `admin`, and `member` are stored on the user. Any signed-in user in the organization can create and delete companies, expenses, income, and budgets. The role is checked only on the admin screen. After a super admin sets someone to `member`, that person can still delete records. |
| A forgotten password cannot be recovered | `login` in `authResolvers.js` | A wrong password stops at login. There is no reset mutation and no reset email. |
| A soft delete cannot be undone | `deleteExpense` and `deleteIncome` | The row stays in Mongo with `isDeleted: true` and disappears from lists. There is no deleted list and no restore mutation. |
| The organization cannot see its own activity | `activityService.js` and admin queries | Register, login, create, and delete events are written to `ActivityLog`. Only a super admin can read them. |
| Admin API counts disappear on restart | `apiMetricsService.js` | Call counts and recent errors are kept in process memory. Restarting the API clears the admin monitor. |
| Income usage is missing for the whole organization at once | `allCompaniesIncomeUsage` in `dashboard.graphql` | The query is implemented. The dashboard asks for one company at a time, so a user comparing every company has to switch the active company. |
| Anyone can ask whether an email is registered | `checkEmailExists` | The query needs no token. A caller can probe addresses before trying to register or sign in. |
| The API accepts a browser call from any website | CORS in `server/src/index.js` | The allow-list and the fallback both accept the request, so the origin check does not block a site. |
| The categories route does not open the categories page | `App.jsx` | `CategoriesPage.jsx` exists. `/categories` redirects to `/companies`. |
| Server operations the screens never use | `client/src/graphql` | These work on `POST /graphql` and no page calls them: `me`, `company`, `category`, `paymentMethod`, `income`, `expense`, `expensesByIncome`, `budgetBuckets`, `budgetBucket`, `budgetUsage`, `allCompaniesIncomeUsage`, `adminApiMetrics`, `adminChatbotUsage`, `adminActivityLogs`, `adminUserDetail`, `updateExpense`, `updateIncome`, `updateCategory`, `updatePaymentMethod`, `updateBudgetBucket`, `updateSubcategoryItems`. |

## Upgrades

Each upgrade below answers a flaw above, or adds a capability the ledger does not have yet. Fix the flaws before adding a new collection.

### Upgrades that remove the current flaws

| Upgrade | Flaw it closes | Change |
|---|---|---|
| Block or cascade a company delete | Deleting a company leaves its money behind | Refuse the delete while expenses, income, or budgets still point at that company, or soft-delete those rows with the company. |
| Edit forms | Records cannot be corrected in the app | Call `updateExpense`, `updateIncome`, `updateBudgetBucket`, and `updatePaymentMethod` from Expenses, Income, Budgets, and Settings. |
| Enforce roles on customer writes | Customer roles do not change what a person can do | Member reads. Admin writes day-to-day records. Owner manages companies and people. |
| Password reset | A forgotten password cannot be recovered | A one-time reset link through the existing Resend mail service. |
| Restore a soft delete | A soft delete cannot be undone | A deleted filter and a restore mutation limited to the same organization. |
| Organization activity | The organization cannot see its own activity | An activity query filtered by `orgId`, shown on Settings. |
| Persist admin API stats | Admin API counts disappear on restart | Write the counts to Mongo. |
| All-company income usage | Income usage is one company at a time | Call `allCompaniesIncomeUsage` from the dashboard income-usage tab. |
| Require a token for the email check | Anyone can ask whether an email is registered | Run `checkEmailExists` only for a signed-in user, or return the same message either way. |
| Honor the CORS allow-list | The API accepts a browser call from any website | Reject origins that are not the app, localhost, or the configured client URL. |
| Open categories in place or remove the dead page | `/categories` redirects away | Point the route at the companies category tools, or delete `CategoriesPage.jsx`. |

### Upgrades that add capability

| Upgrade | Why it fits | What it needs |
|---|---|---|
| Invite a teammate into the same organization | Register always creates a new organization, so the stored roles have nobody to apply to except the owner. | An invite mutation, an email link, and a people section for the owner. |
| Import expenses and income from CSV | Export already writes those columns. | A parser, a preview, and the existing `createExpenses` and `createIncomes` mutations. |
| Recurring income and expenses | Rent, payroll, and retainers are entered by hand every period. | A schedule on the same income and expense shape, generated when the period starts. |
| GST or tax on a line | Amounts are shown in rupees, with no tax split. | Tax rate and tax amount on the expense and income documents, plus a tax total on the dashboard. |
| Lock a closed month | Once a period is reported, later edits should stop. | A period-lock document checked by the expense and income mutations. |
| Vendor list | Vendor is free text, so the same vendor can be spelled more than one way. | A vendor collection scoped to the organization, selected on the expense form. |
| Approval over a limit | The budget email fires after the money is saved. There is no pending state. | A status on the expense and a queue for the owner or admin. |
| Weekly numbers by email | Resend and `dashboardSummary` already exist. | A scheduled job that emails the summary to the owner. |

Leave these until the flaws above are closed: receipt file storage, a live bank feed, and a debit-and-credit general ledger. CSV import covers bank data until a bank connection is justified. A balance sheet is a new model, not a field on an expense.

## Suggested order

1. Company delete, edit forms, and role checks.
2. Password reset, restore for soft deletes, and the organization activity list.
3. Persisted admin metrics, all-company income usage, the email-exists check, and the CORS allow-list.
4. Invites, CSV import, recurring entries, and tax.
5. Month lock, vendors, approval, and the weekly email.
