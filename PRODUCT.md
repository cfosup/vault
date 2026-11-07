# Vault — Product Guide

Vault is a multi-company finance app. One organization account holds many companies. Each company tracks income, expenses, categories, budgets, and an AI chat assistant. A separate super-admin screen watches every organization.

The browser app is React. It talks to one GraphQL API for almost every action, and to three CSV download routes for exports. Data lives in MongoDB. Every customer record is stored with an `orgId` taken from the signed-in user's token, so one organization cannot read another organization's companies, expenses, income, budgets, or chats.

## How a request moves

1. The user opens a page in `client/src/pages`.
2. The page runs a query or mutation from `client/src/graphql/queries.js` or `client/src/graphql/mutations.js`.
3. `client/src/graphql/client.js` attaches `Authorization: Bearer <token>` and posts to `POST /graphql`.
4. `server/src/middleware/auth.js` reads the token and sets `userId`, `orgId`, and `role`.
5. The matching resolver in `server/src/schema/resolvers` checks login, checks the organization, and reads or writes a model in `server/src/models`.

Customer pages require a normal login token. The admin page at `/admin` uses a separate token stored as `vault_admin_token`. That token is issued only by `adminLogin`, and only for a user whose role is `superadmin`.

## Screens

| Route | Page file | What the user does there |
|---|---|---|
| `/login` | `client/src/pages/LoginPage.jsx` | Register, sign in with email and password, or sign in with Google |
| `/` | `client/src/pages/DashboardPage.jsx` | See totals, charts, company spend, and income usage |
| `/expenses` | `client/src/pages/ExpensesPage.jsx` | Add, edit, search, and soft-delete expenses. Link an expense to one or more income entries |
| `/income` | `client/src/pages/IncomePage.jsx` | Add and soft-delete income receipts |
| `/budgets` | `client/src/pages/BudgetsPage.jsx` | Set a spend limit per category and see how much is used |
| `/companies` | `client/src/pages/CompaniesPage.jsx` | Create and edit companies and their chart of accounts |
| `/categories` | redirect only | Sends the user to `/companies` |
| `/settings` | `client/src/pages/SettingsPage.jsx` | Payment methods, theme, profile, CSV export, test email |
| `/admin` | `client/src/pages/AdminDashboardPage.jsx` | Super-admin login, user list, activity, API metrics, chatbot usage, role changes |

`client/src/App.jsx` defines those routes. Customer routes other than `/login` are wrapped in `ProtectedRoute`, which sends a signed-out user back to `/login`.

## What the product does

- **Account.** Register creates an organization and an owner user. Login returns a JWT. Google sign-in is accepted only after the Firebase ID token is verified.
- **Companies.** An owner can keep several business entities under one organization. A company marked as a core branch receives the seeded 51-category chart of accounts.
- **Income.** Money coming in is stored with a company, date, amount, and source. Deletes are soft deletes (`isDeleted: true`).
- **Expenses.** Money going out is stored with a company, category, amount, vendor, and payment method. An expense can be linked to income in the same organization, including income that belongs to a different company in that organization. If several incomes are selected, the split amounts must add up to the expense amount.
- **Budgets.** A bucket limits spending for one category. Usage is calculated for the bucket period (monthly, quarterly, yearly, or the bucket's own start and end dates). Crossing the alert threshold can send an email.
- **Dashboard.** Totals, category mix, monthly trend, income versus expense, top vendors, payment methods, per-company spend, and how much of each income receipt has been used.
- **Chat.** A signed-in user can ask questions about their own organization's numbers. Answers come from Groq and are saved on a chat session.
- **Admin.** A super admin can see platform totals, users, recent activity, API call counts, and chatbot usage, and can change a user's role to `owner`, `admin`, or `member`.
- **Export.** Signed-in users can download expenses, income, or categories as CSV.

## Access rules

| Caller | What they can do |
|---|---|
| Signed out | `register`, `login`, `firebaseOAuth`, `checkEmailExists`, `GET /health` |
| Signed-in user | Their own organization's data only. The company on a new expense, income, or budget must belong to that organization |
| `owner`, `admin`, `member` | Customer app only. These roles cannot open admin queries |
| `superadmin` | Admin queries and `updateUserRole`. Admin login checks the password already stored for that user and does not rewrite it |

`POST /api/admin/reset-database` does not delete anything. It always returns 403 so existing accounts and records stay in place.

## Root files

| File | Purpose |
|---|---|
| `package.json` | Runs both apps with `npm run dev` |
| `run-dev.js` | Starts the API on port 4000 and the website on port 5173 |
| `render.yaml` | Render hosting config for the API |
| `README.md` | Short setup notes |
| `DEPLOYMENT_GUIDE.md` | Production deploy notes |
| `DATABASE_DOCUMENTATION.md` | Older database field notes |
| `implementation_plan.md` | Historical build plan |
| `PRODUCT.md` | This guide |

## Client files

| File | Purpose |
|---|---|
| `client/src/main.jsx` | Starts React, Apollo, and the router |
| `client/src/App.jsx` | Route table and login guard |
| `client/src/graphql/client.js` | GraphQL address, auth header, and logout on an expired token |
| `client/src/graphql/queries.js` | Every query the website sends |
| `client/src/graphql/mutations.js` | Every mutation the website sends |
| `client/src/store/authStore.js` | Saves token, user, organization, active company, and theme in the browser |
| `client/src/config/firebase.js` | Google sign-in popup |
| `client/src/utils/dateUtils.js` | Display dates |
| `client/src/utils/incomeCache.js` | Remembers the last income selection on the expense form |
| `client/src/components/layout/Navbar.jsx` | Top navigation |
| `client/src/components/layout/PageLayout.jsx` | Page shell around protected screens |
| `client/src/components/common/ConfirmModal.jsx` | Delete confirmation dialog |
| `client/src/components/common/CategorySelect.jsx` | Category and subcategory picker |
| `client/src/components/common/CompanyIncomeSelect.jsx` | Company and income picker used when linking an expense |
| `client/src/components/chat/ChatPanel.jsx` | Chat drawer |
| `client/src/components/chat/MarkdownContent.jsx` | Renders the assistant's markdown reply |
| `client/vite.config.js` | Vite build config |
| `client/vercel.json` | Sends all website paths to `index.html` so refresh works |
| `client/.env.example` | `VITE_GRAPHQL_URL` and `VITE_API_URL` |

`client/src/pages/CategoriesPage.jsx` still exists, but the router does not show it. Category work is done on the companies page.

## Server files

| File | Purpose |
|---|---|
| `server/src/index.js` | Express app, `/health`, disabled reset route, CSV routes, GraphQL mount, startup |
| `server/src/config/db.js` | MongoDB connection. If Atlas is unreachable in development, it falls back to an in-memory database |
| `server/src/middleware/auth.js` | Turns the bearer token into `userId`, `orgId`, and `role`. `requireAuth` blocks signed-out calls |
| `server/src/schema/typeDefs/index.js` | Loads and merges every `.graphql` file |
| `server/src/schema/resolvers/index.js` | Merges every resolver into one GraphQL map |
| `server/src/schema/typeDefs/*.graphql` | The API contract: types, inputs, queries, and mutations |
| `server/src/schema/resolvers/*Resolvers.js` | The behavior for each query and mutation |
| `server/src/models/*.js` | Mongoose collections |
| `server/src/services/authService.js` | Password hashing and JWT sign/verify |
| `server/src/services/firebaseAuth.js` | Checks the Google ID token against Firebase's public keys |
| `server/src/services/seedService.js` | Seeds the 51 global categories, copies them onto a core-branch company, and creates a super admin only when that email does not already exist |
| `server/src/services/budgetService.js` | Spend used versus the bucket limit, including subcategory limits |
| `server/src/services/chatService.js` | Builds the financial answer and calls Groq |
| `server/src/services/emailService.js` | Welcome, budget alert, disbursement, and test emails through Resend |
| `server/src/services/activityService.js` | Writes the activity log used by the admin screen |
| `server/src/services/apiMetricsService.js` | Counts API calls and recent errors for the admin screen |
| `server/src/services/keepAliveService.js` | Pings the API on Render so the free instance stays awake |
| `server/src/controllers/exportController.js` | CSV downloads. Requires the same JWT, passed as a bearer header or `?token=` |
| `server/src/utils/dateRange.js` | Date filters. A date-only end date includes that whole day |
| `server/src/utils/tenant.js` | Rejects a company id that is not in the signed-in organization |
| `server/scripts/clearDb.js` | Manual script that clears collections. It is not called by the website |
| `server/scripts/resetUserPassword.js` | Manual script that resets one user's password. It is not called by the website |
| `server/tests/phase1.test.js` | Models, seed, and health check |
| `server/tests/phase2.test.js` | Auth, companies, expenses, income, and tenant isolation |
| `server/tests/phase3.test.js` | Dashboard numbers and budgets |
| `server/tests/phase4.test.js` | Chat session and answers |
| `server/tests/phase1_enhancements.test.js` | Core-branch categories, subcategory budgets, CSV export |
| `server/tests/phase5_income_linking_usage.test.js` | Income linking, splits, and usage math |
| `server/tests/admin_resolvers_unit.test.js` | Admin role rejection |
| `server/tests/admin_dashboard.test.js` | Admin dashboard coverage |
| `server/.env.example` | Variable names for Mongo, JWT, Groq, Resend, Firebase, and the optional first super-admin password |

## Collections

| Model file | Collection purpose |
|---|---|
| `server/src/models/Organization.js` | The tenant. Name, slug, plan |
| `server/src/models/User.js` | A person in that tenant. Email, password hash, role, Firebase uid |
| `server/src/models/Company.js` | A business entity inside the organization |
| `server/src/models/Category.js` | Chart-of-accounts row. Global templates have `isGlobal: true`. Company copies have `companyId` |
| `server/src/models/PaymentMethod.js` | Bank, card, cash, or UPI account used on an expense |
| `server/src/models/Income.js` | Money received |
| `server/src/models/Expense.js` | Money spent, including income links and allocations |
| `server/src/models/BudgetBucket.js` | Spend cap for a category, plus optional subcategory caps |
| `server/src/models/ChatSession.js` | One conversation for one user in one organization |
| `server/src/models/ActivityLog.js` | Register, login, create, update, and delete events |

## REST endpoints

These are not GraphQL.

| Method and path | Auth | Purpose |
|---|---|---|
| `GET /health` | None | Returns `status`, database state, and version. Used by uptime checks |
| `GET /export/expenses` | JWT | CSV of that organization's expenses. Optional `companyId`, `startDate`, `endDate` |
| `GET /export/income` | JWT | CSV of that organization's income. Same optional filters |
| `GET /export/categories` | JWT | CSV of global templates plus that organization's categories. Optional `companyId` |
| `POST /api/admin/reset-database` | None, and it does nothing | Always `403`. Kept so old clients get a clear refusal instead of a wipe |
| `POST /graphql` | Bearer token when the field requires it | All queries and mutations below |

## Queries

There are 32 queries. Unless a row says "signed out", the caller must send a valid bearer token. Customer queries only return rows for `orgId` on that token.

### Account

Defined in `server/src/schema/typeDefs/auth.graphql`. Handled by `authResolvers.js`.

| Query | Arguments | Returns | Who | What it does |
|---|---|---|---|---|
| `me` | none | `User` | Signed in | The current user: id, org, name, email, role, verification, last login |
| `checkEmailExists` | `email: String!` | `Boolean` | Signed out | `true` when that email is already registered. Used by the login form before submit |

### Companies

Defined in `company.graphql`. Handled by `companyResolvers.js`.

| Query | Arguments | Returns | What it does |
|---|---|---|---|
| `companies` | none | `[Company]` | All companies in the signed-in organization, newest first |
| `company` | `id: ID!` | `Company` | One company. Error if it belongs to another organization |

`Company` fields: `id`, `orgId`, `name`, `description`, `isActive`, `isCoreBranch`, `createdAt`.

### Categories

Defined in `category.graphql`. Handled by `categoryResolvers.js`.

| Query | Arguments | Returns | What it does |
|---|---|---|---|
| `categories` | `companyId: ID` | `[Category]` | With a company id, that company's categories. Without one, the global templates |
| `category` | `id: ID!` | `Category` | One category row, including its subcategories |

`Category` fields: `id`, `orgId`, `companyId`, `name`, `group`, `groupLabel`, `subcategories`, `isGlobal`, `createdAt`.

Each subcategory has `name`, `items`, and `isCustom`.

### Payment methods

Defined in `paymentMethod.graphql`. Handled by `paymentMethodResolvers.js`.

| Query | Arguments | Returns | What it does |
|---|---|---|---|
| `paymentMethods` | none | `[PaymentMethod]` | Payment accounts for this organization |
| `paymentMethod` | `id: ID!` | `PaymentMethod` | One payment account |

Fields: `id`, `orgId`, `name`, `type`, `accountNumber`, `isActive`, `createdAt`.

### Income

Defined in `income.graphql`. Handled by `incomeResolvers.js`.

| Query | Arguments | Returns | What it does |
|---|---|---|---|
| `incomes` | `filter: IncomeFilter`, `page: Int`, `limit: Int` | `IncomePage` | Paged income. Soft-deleted rows are hidden |
| `income` | `id: ID!` | `Income` | One receipt in this organization |

`IncomeFilter`: `companyId`, `startDate`, `endDate`, `search` (source and notes).

`IncomePage`: `incomes`, `totalCount`, `page`, `totalPages`.

`Income` fields: `id`, `orgId`, `companyId`, `date`, `amount`, `source`, `notes`, `createdBy`, `createdAt`, `updatedAt`.

### Expenses

Defined in `expense.graphql`. Handled by `expenseResolvers.js`.

| Query | Arguments | Returns | What it does |
|---|---|---|---|
| `expenses` | `filter: ExpenseFilter`, `page: Int`, `limit: Int` | `ExpensePage` | Paged expenses. Page size is capped at 100 |
| `expense` | `id: ID!` | `Expense` | One expense in this organization |
| `expensesByIncome` | `incomeId: ID!` | `[Expense]` | Expenses linked to that income through `incomeId`, `incomeIds`, or an allocation |

`ExpenseFilter`: `companyId`, `categoryId`, `incomeId`, `startDate`, `endDate`, `search`, `vendor`, `paymentMethodId`, `sortBy`.

`sortBy` accepts `createdAt_desc`, `date_asc`, and `amount_desc`. The default is newest date first.

`Expense` fields: `id`, `orgId`, `companyId`, `date`, `categoryId`, `categoryName`, `subcategory`, `amount`, `vendor`, `paymentMethodId`, `paymentMethodName`, `notes`, `budgetBucketId`, `incomeId`, `incomeIds`, `incomeAllocations`, `income`, `incomes`, `createdBy`, `createdAt`, `updatedAt`.

`income` is the primary linked receipt. `incomes` is every linked receipt. `incomeAllocations` is the split: each item has `incomeId`, `amount`, and `companyId`.

### Budgets

Defined in `budget.graphql`. Handled by `budgetResolvers.js`. Math is in `budgetService.js`.

| Query | Arguments | Returns | What it does |
|---|---|---|---|
| `budgetBuckets` | `companyId: ID` | `[BudgetBucket]` | Buckets for the organization, optionally one company |
| `budgetBucket` | `id: ID!` | `BudgetBucket` | One bucket |
| `budgetUsage` | `bucketId: ID!` | `BudgetUsage` | Amount used, amount left, percent, over-budget flag, near-limit flag, and subcategory usage |
| `allBudgetUsages` | `companyId: ID` | `[BudgetUsage]` | The same usage object for every matching bucket |

`BudgetBucket` fields: `id`, `orgId`, `companyId`, `categoryId`, `categoryName`, `name`, `limitAmount`, `period`, `startDate`, `endDate`, `alertThreshold`, `subcatBudgets`, `createdAt`.

`period` is `monthly`, `quarterly`, `yearly`, or `custom`. If start and end dates are empty, monthly, quarterly, and yearly windows use the current period. Custom with no dates counts all spending for that category.

### Dashboard

Defined in `dashboard.graphql`. Handled by `dashboardResolvers.js`.

`DashFilter` is `companyId`, `startDate`, `endDate`. Omit `companyId` to include every company in the organization.

| Query | Arguments | Returns | What it does |
|---|---|---|---|
| `dashboardSummary` | `filter: DashFilter` | `DashboardSummary` | Total expenses, total income, net, counts, top category, top vendor |
| `categoryBreakdown` | `filter: DashFilter` | `[CategoryBreakdown]` | Spend and percentage per category |
| `monthlyTrend` | `months: Int`, `companyId: ID` | `[MonthlyTrend]` | Expense total for each month. Default look-back is 6 months |
| `incomeVsExpenseTrend` | `months: Int`, `companyId: ID` | `[IncomeExpenseTrend]` | Expenses, income, and net for each month |
| `topVendors` | `filter: DashFilter`, `limit: Int` | `[VendorStat]` | Vendors by spend. Default limit is 5 |
| `paymentMethodBreakdown` | `filter: DashFilter` | `[PaymentMethodStat]` | Spend per payment method |
| `companySpendBreakdown` | `filter: DashFilter` | `[CompanySpendStat]` | Expenses, income, net, and share of spend for each active company |
| `companyIncomeUsage` | `companyId: ID!` | `CompanyIncomeUsageReport` | How much of that company's income has been tied to expenses |
| `allCompaniesIncomeUsage` | none | `[CompanyIncomeUsageReport]` | The same report for every company |

`CompanyIncomeUsageReport` fields: `companyId`, `companyName`, `totalIncome`, `totalUtilized`, `remainingBalance`, `totalExcessSpending`, `utilizationPercentage`, `incomeEntries`, `incomeCount`, `unlinkedExpensesTotal`, `unlinkedExpenseCount`.

Each `incomeEntries` item adds `totalUtilized`, `remainingBalance`, `excessSpending`, `utilizationPercentage`, `linkedExpenses`, and `linkedExpenseCount` on top of the income fields. Unlinked expenses are reported on the company, not subtracted from a specific receipt. A company in another organization returns "Company not found".

### Chat

Defined in `chat.graphql`. Handled by `chatResolvers.js` and `chatService.js`.

| Query | Arguments | Returns | What it does |
|---|---|---|---|
| `chatSession` | `sessionId: String!` | `ChatSession` or null | The signed-in user's own session and its messages |

A message has `role` (`user` or `assistant`), `content`, and `timestamp`.

### Admin

Defined in `admin.graphql`. Handled by `adminResolvers.js`. Every query below requires `role: superadmin` (or `isSuperAdmin: true` on the token). An owner or company admin receives `FORBIDDEN`.

| Query | Arguments | Returns | What it does |
|---|---|---|---|
| `adminDashboard` | `search: String`, `role: String` | `AdminDashboardPayload` | Platform stats, matching users with their companies and counts, recent activity, API metrics, and chatbot usage |
| `adminApiMetrics` | none | `AdminApiMetricsPayload` | Total calls, total errors, success rate, per-endpoint counts, recent errors |
| `adminChatbotUsage` | none | `[UserChatbotUsage]` | Sessions and message counts per user |
| `adminActivityLogs` | `limit: Int` | `[AdminActivityLog]` | Newest activity rows. Limit is capped at 100. Default is 50 |
| `adminUserDetail` | `userId: ID!` | `AdminUserDetail` | One user plus their companies and transaction counts |

`AdminDashboardPayload` contains `stats`, `users`, `recentActivities`, `apiMetrics`, and `chatbotUsage`.

`stats` contains `totalUsers`, `totalOrganizations`, `totalCompanies`, `totalIncomeCount`, `totalExpenseCount`, `totalInteractions`, `totalChatMessages`, `activeUsersCount`.

## Mutations

There are 31 mutations.

### Account

| Mutation | Arguments | Returns | Who | What it does |
|---|---|---|---|---|
| `register` | `input: RegisterInput!` | `AuthPayload` | Signed out | Creates the organization and an `owner` user, hashes the password, and returns a token. Fails if the email exists. Password must be at least 6 characters |
| `login` | `email: String!`, `password: String!` | `AuthPayload` | Signed out | Checks the stored password and returns a token. A Google-only account is told to use Google. A wrong password does not reveal whether the hash is missing |
| `firebaseOAuth` | `input: FirebaseOAuthInput!` | `AuthPayload` | Signed out | Verifies `idToken` with Firebase. Uses the email inside the token, not a caller-supplied email. Links an existing user or creates a new organization and owner |
| `sendTestEmail` | `email: String!` | `EmailResult` | Signed in | Sends a Resend test message. Falls back to the signed-in user's email |

`RegisterInput`: `name`, `email`, `password`, `orgName`.

`FirebaseOAuthInput`: `idToken`, `uid`, `email`, `name`, `avatarUrl`, `orgName`. The server trusts `idToken`. The other identity fields are not used to choose the account.

`AuthPayload`: `token`, `user`, `org`, `message`.

### Companies

| Mutation | Arguments | Returns | What it does |
|---|---|---|---|
| `createCompany` | `input: CompanyInput!` | `Company` | Adds a company to the signed-in organization. If `isCoreBranch` is true, copies the 51 core categories onto it |
| `updateCompany` | `id: ID!`, `input: CompanyInput!` | `Company` | Renames, describes, activates, or marks the company as a core branch. Turning on core branch seeds categories if needed |
| `deleteCompany` | `id: ID!` | `Boolean` | Removes that company's document. It must belong to the caller |

`CompanyInput`: `name`, `description`, `isActive`, `isCoreBranch`.

### Categories

| Mutation | Arguments | Returns | What it does |
|---|---|---|---|
| `createCategory` | `input: CategoryInput!` | `Category` | Adds a category, optionally scoped to a company, with a starting subcategory list |
| `updateCategory` | `id: ID!`, `input: CategoryInput!` | `Category` | Updates name, group, label, or subcategories |
| `deleteCategory` | `id: ID!` | `Boolean` | Deletes one category |
| `deleteCategorySection` | `companyId: ID!`, `group: String!` | `Boolean` | Deletes every category in that letter-group for that company |
| `addSubcategory` | `categoryId: ID!`, `subcategoryName: String!`, `items: [String!]` | `Category` | Appends a subcategory |
| `updateSubcategoryItems` | `categoryId: ID!`, `subcategoryName: String!`, `items: [String!]!` | `Category` | Replaces the line items under a subcategory |
| `deleteSubcategory` | `categoryId: ID!`, `subcategoryName: String!` | `Category` | Removes one subcategory |
| `resetCompanyCategoriesToCore` | `companyId: ID!` | `[Category]` | Deletes that company's categories and copies the core template again |

`CategoryInput`: `companyId`, `name`, `group`, `groupLabel`, `subcategories`.

### Payment methods

| Mutation | Arguments | Returns | What it does |
|---|---|---|---|
| `createPaymentMethod` | `input: PaymentMethodInput!` | `PaymentMethod` | Adds a bank, card, cash, or other account for this organization |
| `updatePaymentMethod` | `id: ID!`, `input: PaymentMethodInput!` | `PaymentMethod` | Updates name, type, account number, or active flag |
| `deletePaymentMethod` | `id: ID!` | `Boolean` | Removes that payment method |

`PaymentMethodInput`: `name`, `type`, `accountNumber`, `isActive`.

### Income

| Mutation | Arguments | Returns | What it does |
|---|---|---|---|
| `createIncomes` | `inputs: [IncomeInput!]!` | `[Income]` | Inserts one or more receipts. Each `companyId` must belong to the caller |
| `updateIncome` | `id: ID!`, `input: IncomeInput!` | `Income` | Updates company, date, amount, source, or notes on a receipt in this organization |
| `deleteIncome` | `id: ID!` | `Boolean` | Soft-deletes the receipt |

`IncomeInput`: `companyId`, `date`, `amount`, `source`, `notes`.

### Expenses

| Mutation | Arguments | Returns | What it does |
|---|---|---|---|
| `createExpenses` | `inputs: [ExpenseInput!]!` | `[Expense]` | Inserts one or more expenses. Company must be in the organization. Linked income must be in the organization. Allocation amounts must equal the expense amount |
| `updateExpense` | `id: ID!`, `input: ExpenseInput!` | `Expense` | Updates an expense in this organization, including its income links |
| `deleteExpense` | `id: ID!` | `Boolean` | Soft-deletes the expense |

`ExpenseInput`: `companyId`, `date`, `categoryId`, `categoryName`, `subcategory`, `amount`, `vendor`, `paymentMethodId`, `paymentMethodName`, `notes`, `budgetBucketId`, `incomeId`, `incomeIds`, `incomeAllocations`.

After a create, the server recalculates matching budget buckets and may email the user if spend has crossed `alertThreshold`.

### Budgets

| Mutation | Arguments | Returns | What it does |
|---|---|---|---|
| `createBudgetBucket` | `input: BudgetBucketInput!` | `BudgetBucket` | Creates a cap. The company must belong to the caller. Category name is filled from the category when omitted |
| `updateBudgetBucket` | `id: ID!`, `input: BudgetBucketInput!` | `BudgetBucket` | Changes the limit, period, dates, threshold, or subcategory caps |
| `deleteBudgetBucket` | `id: ID!` | `Boolean` | Deletes the bucket |

`BudgetBucketInput`: `companyId`, `categoryId`, `categoryName`, `name`, `limitAmount`, `period`, `startDate`, `endDate`, `alertThreshold`, `subcatBudgets`.

### Chat

| Mutation | Arguments | Returns | What it does |
|---|---|---|---|
| `sendChatMessage` | `sessionId: String!`, `message: String!`, `activeCompanyId: ID` | `ChatMessage` | Saves the user message, answers from that organization's numbers, and saves the assistant message |
| `clearChatSession` | `sessionId: String!` | `Boolean` | Deletes that user's session |

### Admin

| Mutation | Arguments | Returns | Who | What it does |
|---|---|---|---|---|
| `adminLogin` | `email: String!`, `password: String!` | `AdminAuthPayload` | Signed out | Finds a user who is already `superadmin` and whose stored password matches. Returns an admin token. Does not create a user and does not change an existing password or role |
| `updateUserRole` | `userId: ID!`, `role: String!` | `User` | Super admin | Sets the role to `owner`, `admin`, or `member`. Any other role name is rejected |

`AdminAuthPayload`: `token`, `admin`, `message`.

## Which screen calls which operation

| Screen | Queries | Mutations |
|---|---|---|
| Login | `checkEmailExists` | `register`, `login`, `firebaseOAuth` |
| Navbar | `companies` | none |
| Dashboard | `dashboardSummary`, `categoryBreakdown`, `monthlyTrend`, `incomeVsExpenseTrend`, `topVendors`, `paymentMethodBreakdown`, `companySpendBreakdown`, `companyIncomeUsage`, `companies`, `expenses` | none on the charts |
| Chat drawer | `chatSession` | `sendChatMessage`, `clearChatSession` |
| Expenses | `expenses`, `categories`, `paymentMethods`, `incomes`, `companies` | `createExpenses`, `deleteExpense`, `createCategory`, `addSubcategory` |
| Income | `incomes`, `companies` | `createIncomes`, `deleteIncome` |
| Budgets | `allBudgetUsages`, `categories`, `companies` | `createBudgetBucket`, `deleteBudgetBucket` |
| Companies | `companies`, `categories` | `createCompany`, `updateCompany`, `deleteCompany`, `createCategory`, `deleteCategory`, `deleteCategorySection`, `addSubcategory`, `deleteSubcategory`, `resetCompanyCategoriesToCore` |
| Settings | `paymentMethods` | `createPaymentMethod`, `deletePaymentMethod`, `sendTestEmail` |
| Admin | `adminDashboard` | `adminLogin`, `updateUserRole` |

These operations are in the schema and in `client/src/graphql`, and they work through `POST /graphql` with the same auth rules. No current screen calls them: `me`, `company`, `category`, `paymentMethod`, `income`, `expense`, `expensesByIncome`, `budgetBuckets`, `budgetBucket`, `budgetUsage`, `allCompaniesIncomeUsage`, `adminApiMetrics`, `adminChatbotUsage`, `adminActivityLogs`, `adminUserDetail`, `updateExpense`, `updateIncome`, `updateCategory`, `updatePaymentMethod`, `updateBudgetBucket`, `updateSubcategoryItems`. The admin payload already includes activity, API metrics, chatbot usage, and user detail, so the admin page reads those through `adminDashboard` instead of the separate queries.

## Example: sign in and load the dashboard

```graphql
mutation Login($email: String!, $password: String!) {
  login(email: $email, password: $password) {
    token
    user { id name email role }
    org { id name slug plan }
  }
}
```

Send the returned token as `Authorization: Bearer <token>` on the next call.

```graphql
query GetDashboardSummary($filter: DashFilter) {
  dashboardSummary(filter: $filter) {
    totalExpenses
    totalIncome
    netBalance
    expenseCount
    incomeCount
    topCategory
    topVendor
  }
}
```

`$filter` can be `{ companyId: "<id>", startDate: "2026-11-01", endDate: "2026-11-30" }`. Leave `companyId` out to include the whole organization.
