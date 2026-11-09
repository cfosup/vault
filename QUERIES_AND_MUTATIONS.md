# Queries and mutations

The API is GraphQL at `POST /graphql`. The shape is `server/src/schema/typeDefs/`. The behavior is `server/src/schema/resolvers/`. The browser calls are `client/src/graphql/queries.js` and `client/src/graphql/mutations.js`.

Send `Authorization: Bearer <token>` for a signed-in call. The super-admin screen uses the token from `adminLogin`, stored as `vault_admin_token`. Customer tokens are stored as `vault_token`.

This file lists every operation in the schema. There are **39 queries** and **42 mutations**, then the REST routes.

## Queries

### Account — `auth.graphql`

| # | Query | Returns | Who |
|---|---|---|---|
| 1 | `me` | `User` with `accessScope`, `modules`, `companyIds`, `canDeleteExpenses`, `canDeleteIncome` | Signed in |
| 2 | `checkEmailExists(email: String!)` | `Boolean` | Signed in. The login page does not call this while signed out |
| 3 | `myActivityLogs(limit: Int)` | `[ActivityLogEntry]` (`id`, `action`, `entityType`, `description`, `companyName`, `createdAt`) | Signed in, this organization only |

### Companies — `company.graphql`

| # | Query | Returns | Who |
|---|---|---|---|
| 4 | `companies` | `[Company]` (`id`, `orgId`, `name`, `description`, `isActive`, `isCoreBranch`, `createdAt`) | Signed in. Hidden companies are omitted |
| 5 | `company(id: ID!)` | `Company` | Signed in. Not found when the company is outside their list |

`CompanyInput`: `name`, `description`, `isActive`, `isCoreBranch`.

### Categories — `category.graphql`

| # | Query | Returns | Who |
|---|---|---|---|
| 6 | `categories(companyId: ID)` | `[Category]` | Signed in |
| 7 | `category(id: ID!)` | `Category` | Signed in |

`Category` includes `group`, `groupLabel`, `isGlobal`, and `subcategories` (`name`, `items`, `isCustom`).

`CategoryInput`: `companyId`, `name`, `group`, `groupLabel`, `subcategories`.

`SubcategoryInput`: `name`, `items`, `isCustom`.

### Payment accounts — `paymentMethod.graphql`

| # | Query | Returns | Who |
|---|---|---|---|
| 8 | `paymentMethods` | `[PaymentMethod]` | Signed in |
| 9 | `paymentMethod(id: ID!)` | `PaymentMethod` | Signed in |

`PaymentMethodInput`: `name`, `type` (`cash`, `bank`, `card`, `upi`, `other`), `accountNumber`, `isActive`.

### Expenses — `expense.graphql`

| # | Query | Returns | Who |
|---|---|---|---|
| 10 | `expenses(filter: ExpenseFilter, page: Int, limit: Int)` | `ExpensePage` (`expenses`, `totalCount`, `page`, `totalPages`) | Can read expenses |
| 11 | `expense(id: ID!)` | `Expense` | Can read expenses |
| 12 | `expensesByIncome(incomeId: ID!)` | `[Expense]` | Can read expenses |

`ExpenseFilter`: `companyId`, `categoryId`, `incomeId`, `startDate`, `endDate`, `search`, `vendor`, `paymentMethodId`, `sortBy`, `includeDeleted`.

`ExpenseInput`: `companyId`, `date`, `categoryId`, `categoryName`, `subcategory`, `amount`, `vendor`, `paymentMethodId`, `paymentMethodName`, `notes`, `budgetBucketId`, `incomeId`, `incomeIds`, `incomeAllocations`, `makeRecurring`.

`IncomeAllocationInput`: `incomeId`, `amount`, `companyId`.

`makeRecurring` is used only when creating a single expense. It is ignored on edit and on a batch.

### Income — `income.graphql`

| # | Query | Returns | Who |
|---|---|---|---|
| 13 | `incomes(filter: IncomeFilter, page: Int, limit: Int)` | `IncomePage` | Can read income |
| 14 | `income(id: ID!)` | `Income` | Can read income |

`IncomeFilter`: `companyId`, `startDate`, `endDate`, `search`, `includeDeleted`.

`IncomeInput`: `companyId`, `date`, `amount`, `source`, `notes`, `makeRecurring`.

### Vendors, people, locks, schedules — `feature.graphql`

| # | Query | Returns | Who |
|---|---|---|---|
| 15 | `vendorSuggestions(categoryId: ID!, subcategory: String)` | `[String]` | Can read expenses. Empty subcategory returns vendors for the whole category |
| 16 | `orgMembers` | `[OrgMember]` | Owner |
| 17 | `pendingInvites` | `[PendingInvite]` | Owner |
| 18 | `invitePreview(token: String!)` | `InvitePreview` (`orgName`, `email`, `accessSummary`, `expiresAt`) | Public. Used by `/join` |
| 19 | `monthLocks` | `[MonthLockEntry]` (`id`, `year`, `month`) | Signed in |
| 20 | `myRecurringSchedules` | `[RecurringScheduleEntry]` (`id`, `kind`, `companyId`, `dayOfMonth`, `nextRunAt`, `active`, `label`) | Signed in |

`MemberAccessInput`: `email`, `accessScope` (`workspace` or `modules`), `modules`, `companyIds`, `canDeleteExpenses`, `canDeleteIncome`.

`AcceptInviteInput`: `token`, `name`, `password`.

### Budgets — `budget.graphql`

Workspace access is required for these reads.

| # | Query | Returns | Who |
|---|---|---|---|
| 21 | `budgetBuckets(companyId: ID)` | `[BudgetBucket]` | Workspace |
| 22 | `budgetBucket(id: ID!)` | `BudgetBucket` | Workspace |
| 23 | `budgetUsage(bucketId: ID!)` | `BudgetUsage` (`usedAmount`, `remainingAmount`, `percentUsed`, `isOverBudget`, `isNearLimit`, `subcatUsages`) | Workspace |
| 24 | `allBudgetUsages(companyId: ID)` | `[BudgetUsage]` | Workspace |

`BudgetBucketInput`: `companyId`, `categoryId`, `categoryName`, `name`, `limitAmount`, `period` (`monthly`, `quarterly`, `yearly`, `custom`), `startDate`, `endDate`, `alertThreshold`, `subcatBudgets`.

`SubcatBudgetInput`: `subcategory`, `limitAmount`.

### Overview — `dashboard.graphql`

Workspace access is required. A person limited to expenses or income only does not get these.

| # | Query | Returns |
|---|---|---|
| 25 | `dashboardSummary(filter: DashFilter)` | `totalExpenses`, `totalIncome`, `netBalance`, `expenseCount`, `incomeCount`, `topCategory`, `topVendor` |
| 26 | `categoryBreakdown(filter: DashFilter)` | `categoryName`, `amount`, `count`, `percentage` |
| 27 | `monthlyTrend(months: Int, companyId: ID)` | `month`, `year`, `amount` |
| 28 | `incomeVsExpenseTrend(months: Int, companyId: ID)` | `month`, `year`, `expenses`, `income`, `net` |
| 29 | `topVendors(filter: DashFilter, limit: Int)` | `vendor`, `amount`, `count` |
| 30 | `paymentMethodBreakdown(filter: DashFilter)` | `paymentMethodName`, `amount`, `count` |
| 31 | `companySpendBreakdown(filter: DashFilter)` | `companyId`, `companyName`, `expenses`, `income`, `netBalance`, `expenseCount`, `percentage` |
| 32 | `companyIncomeUsage(companyId: ID!)` | One `CompanyIncomeUsageReport` |
| 33 | `allCompaniesIncomeUsage` | `[CompanyIncomeUsageReport]` |

`DashFilter`: `companyId`, `startDate`, `endDate`.

`CompanyIncomeUsageReport`: `companyId`, `companyName`, `totalIncome`, `totalUtilized`, `remainingBalance`, `totalExcessSpending`, `utilizationPercentage`, `incomeEntries`, `incomeCount`, `unlinkedExpensesTotal`, `unlinkedExpenseCount`.

Each `IncomeUsageItem` also has `linkedExpenses` and `linkedExpenseCount`.

### Chat — `chat.graphql`

| # | Query | Returns | Who |
|---|---|---|---|
| 34 | `chatSession(sessionId: String!)` | `ChatSession` or null | Workspace |

### Super admin — `admin.graphql`

These need a super-admin token. An owner or admin token is rejected.

| # | Query | Returns |
|---|---|---|
| 35 | `adminDashboard(search: String, role: String)` | `stats`, `users`, `recentActivities`, `apiMetrics`, `chatbotUsage` |
| 36 | `adminApiMetrics` | Endpoint call counts and recent errors. The stored counter is `errorCount`; the GraphQL field is `errors` |
| 37 | `adminChatbotUsage` | Chat counts per user |
| 38 | `adminActivityLogs(limit: Int)` | Activity across organizations |
| 39 | `adminUserDetail(userId: ID!)` | One user, their companies, and their activity |

## Mutations

### Account — `auth.graphql`

| # | Mutation | Arguments | Who | What it does |
|---|---|---|---|---|
| 1 | `register` | `RegisterInput` (`name`, `email`, `password`, `orgName`) | Public | New organization and an owner. Does not join an existing organization |
| 2 | `login` | `email`, `password` | Public | JWT, user, and organization |
| 3 | `firebaseOAuth` | `FirebaseOAuthInput` (`idToken`, `uid`, `email`, `name`, `avatarUrl`, `orgName`) | Public | Server verifies the Firebase token, then signs in or creates the user |
| 4 | `requestPasswordReset` | `email` | Public | Sends a reset mail when the account exists. Returns a clear message when it does not |
| 5 | `resetPassword` | `token`, `password` | Public | Sets the password when the token is valid and under one hour old |
| 6 | `sendTestEmail` | `email` | Signed in | Sends a test message through Resend |

`register`, `login`, and `firebaseOAuth` return `AuthPayload`: `token`, `user`, `org`, `message`.

### Companies — `company.graphql`

Owner only.

| # | Mutation | Arguments | What it does |
|---|---|---|---|
| 7 | `createCompany` | `CompanyInput` | Adds a company |
| 8 | `updateCompany` | `id`, `CompanyInput` | Edits it |
| 9 | `deleteCompany` | `id` | Soft-deletes its expenses and income, deletes its budgets and categories, then deletes the company |

### Categories — `category.graphql`

| # | Mutation | Arguments | What it does |
|---|---|---|---|
| 10 | `createCategory` | `CategoryInput` | Adds a category |
| 11 | `updateCategory` | `id`, `CategoryInput` | Edits it |
| 12 | `deleteCategory` | `id` | Removes one category |
| 13 | `deleteCategorySection` | `companyId`, `group` | Removes every category in that letter group |
| 14 | `addSubcategory` | `categoryId`, `subcategoryName`, `items` | Adds a subcategory |
| 15 | `updateSubcategoryItems` | `categoryId`, `subcategoryName`, `items` | Replaces the item list |
| 16 | `deleteSubcategory` | `categoryId`, `subcategoryName` | Removes a subcategory |
| 17 | `resetCompanyCategoriesToCore` | `companyId` | Copies the built-in list onto a company that has no categories yet |

### Payment accounts — `paymentMethod.graphql`

| # | Mutation | Arguments | What it does |
|---|---|---|---|
| 18 | `createPaymentMethod` | `PaymentMethodInput` | Adds an account |
| 19 | `updatePaymentMethod` | `id`, `PaymentMethodInput` | Edits it |
| 20 | `deletePaymentMethod` | `id` | Removes it |

### Expenses — `expense.graphql`

The caller must be allowed to write that module for that company, and the month must be unlocked. Delete and restore also need delete permission.

| # | Mutation | Arguments | What it does |
|---|---|---|---|
| 21 | `createExpenses` | `[ExpenseInput]` | Saves one or more. Remembers the vendor. A single row with `makeRecurring` starts a monthly schedule |
| 22 | `updateExpense` | `id`, `ExpenseInput` | Edits one expense. `makeRecurring` is ignored |
| 23 | `deleteExpense` | `id` | Sets `isDeleted` |
| 24 | `restoreExpense` | `id` | Clears `isDeleted` |

When more than one income is linked, the allocation amounts must equal the expense amount.

### Income — `income.graphql`

| # | Mutation | Arguments | What it does |
|---|---|---|---|
| 25 | `createIncomes` | `[IncomeInput]` | Saves one or more. A single row with `makeRecurring` starts a monthly schedule |
| 26 | `updateIncome` | `id`, `IncomeInput` | Edits one income row |
| 27 | `deleteIncome` | `id` | Sets `isDeleted` |
| 28 | `restoreIncome` | `id` | Clears `isDeleted` |

### Budgets — `budget.graphql`

| # | Mutation | Arguments | Who | What it does |
|---|---|---|---|---|
| 29 | `createBudgetBucket` | `BudgetBucketInput` | Owner, admin, or super admin | Creates a limit |
| 30 | `updateBudgetBucket` | `id`, `BudgetBucketInput` | Same | Edits it |
| 31 | `deleteBudgetBucket` | `id` | Same | Removes it |

Crossing `alertThreshold` emails the organization owner once per budget per period.

### Chat — `chat.graphql`

| # | Mutation | Arguments | Who | What it does |
|---|---|---|---|---|
| 32 | `sendChatMessage` | `sessionId`, `message`, `activeCompanyId` | Workspace | Stores the user message and the reply |
| 33 | `clearChatSession` | `sessionId` | Workspace | Deletes that chat |

### People, locks, schedules — `feature.graphql`

| # | Mutation | Arguments | Who | What it does |
|---|---|---|---|---|
| 34 | `inviteMember` | `MemberAccessInput` | Owner | Emails `/join?token=...`. Only a hash of the token is stored |
| 35 | `acceptInvite` | `AcceptInviteInput` | Public | Creates a member in that organization and returns a JWT. Does not call `register` |
| 36 | `updateMemberAccess` | `userId`, `MemberAccessInput` | Owner | Changes modules, companies, and delete flags. Cannot reduce an owner |
| 37 | `removeMember` | `userId` | Owner | Deletes the user document. Their expenses and income stay. Cannot remove the owner |
| 38 | `lockMonth` | `year`, `month` | Owner | Blocks expense and income changes in that UTC month |
| 39 | `unlockMonth` | `year`, `month` | Owner | Opens the month |
| 40 | `stopRecurring` | `id` | Someone who can write that module for that company | Sets the schedule inactive |

### Super admin — `admin.graphql`

| # | Mutation | Arguments | Who | What it does |
|---|---|---|---|---|
| 41 | `adminLogin` | `email`, `password` | Public | Super-admin token. An owner or admin password does not work here |
| 42 | `updateUserRole` | `userId`, `role` | Super admin | Changes `owner`, `admin`, `member`, or `superadmin` |

## REST routes

These are not GraphQL. They live in `server/src/index.js`.

| Method and path | Auth | What it does |
|---|---|---|
| `GET /health` | None | The API is up |
| `GET /export/expenses?token=&companyId=` | Customer JWT in `token` | CSV of expenses the caller may see |
| `GET /export/income?token=&companyId=` | Customer JWT in `token` | CSV of income the caller may see |
| `GET /export/categories?token=` | Customer JWT in `token` | CSV of categories |
| `POST /internal/run-schedules` | Header `x-schedule-secret` must match `SCHEDULE_SECRET` | Creates due recurring rows, then sends the weekly or monthly PDF when the Asia/Kolkata date matches |
| `POST /api/admin/reset-database` | Rejected | Always `403`. It does not delete data |

## Count check

If a new operation is added, update this file in the same change. The schema should stay at the names above until that happens: 39 queries, 42 mutations, 6 REST routes.
