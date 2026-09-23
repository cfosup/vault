# ExpenseFlow SaaS — Complete End-to-End Implementation Plan
**Stack: MERN + GraphQL | Ready for execution by any agent or developer**

---

## 1. Context & Goal

**What we're migrating from:**
A single-user, no-auth HTML/CSS/JS frontend that calls n8n automation webhooks which then talk to Zoho Books (expenses), Supabase (income/chat), and Google Sheets. Companies live in `localStorage`, categories are hardcoded in a JS file, payment methods are hardcoded in HTML, and there is zero backend code we own or control.

**What we're building:**
A production-grade, multi-tenant SaaS web application where an organization can register, log in, manage multiple companies, track expenses and income per company, set budget limits per category, and query their financial data via an AI chatbot — all through a self-owned MERN stack with a GraphQL API. No n8n, no Zoho, no Supabase, no hardcoded data.

**Core user story:**
> A founder or finance manager logs in → selects a company → adds bulk expenses with category/subcategory → views dashboard analytics → creates budget buckets with limits → gets alerts when near the limit → asks the AI assistant "what's my top spending category this month?"

---

## 2. All Decisions — Resolved

| Decision | Choice | Reason |
|---|---|---|
| **Frontend framework** | React + Vite | Fast dev server, modern tooling, easy to learn |
| **Styling** | Vanilla CSS (ported from current `styles.css`) | Already has a great design system, no bloat |
| **State management** | Zustand | Lightweight, simple API, good for auth + global state |
| **GraphQL client** | Apollo Client 3 | Best React integration, caching built-in |
| **Backend runtime** | Node.js + Express | User is comfortable with Node.js |
| **GraphQL server** | Apollo Server 4 (Express middleware) | Industry standard, good DX |
| **Database** | **MongoDB Atlas M0 (Free Tier)** | Natural MERN fit, free tier is sufficient for local dev + first clients, no SQL needed |
| **ODM** | Mongoose | Best-in-class schema validation for MongoDB |
| **Auth** | JWT (jsonwebtoken) + bcrypt | Stateless, simple to implement and understand |
| **AI / LLM** | **Groq API (llama-3.3-70b-versatile)** | Free tier, fast, already proven in current n8n setup |
| **AI framework** | LangChain.js | Handles Groq integration, chat memory, tool use |
| **Chat memory** | MongoDB (chat_sessions collection) | No external service needed, full control |
| **Multi-tenancy** | Org → Multiple Companies → Expenses/Income | One login per org, multiple companies under it |
| **Payment methods** | Per-org configurable in Settings | No hardcoded values |
| **Data migration** | Fresh start | No import from Supabase |
| **Local dev DB** | MongoDB Atlas M0 (free cloud) | Simpler than local Docker for beginners |
| **Deployment (Phase 1)** | Local only | Get it working end-to-end first |
| **Deployment (Phase 2)** | Frontend: Vercel (free) · Backend: Render (free) | Lowest cost, easiest CI/CD |
| **Zoho** | Completely removed | No references anywhere |
| **n8n** | Completely removed | All logic ported to native Node.js services |
| **Google Sheets** | Completely removed | DB is the source of truth |

---

## 3. Architecture Diagram

```
┌──────────────────────────────────────────────────────────┐
│                  BROWSER (React SPA)                     │
│  React Router v6 · Apollo Client · Zustand · Recharts   │
│  Pages: Login, Dashboard, Expenses, Income,              │
│         Budgets, Companies, Categories, Settings         │
└─────────────────────┬────────────────────────────────────┘
                      │  HTTP POST /graphql
                      │  (Apollo Client — JWT in headers)
┌─────────────────────▼────────────────────────────────────┐
│           NODE.JS BACKEND (Express + Apollo Server 4)    │
│                                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │              GraphQL API Layer                  │    │
│  │  typeDefs (SDL) + resolvers per entity          │    │
│  └──────────────────────┬──────────────────────────┘    │
│                         │                                │
│  ┌──────────────┐  ┌────▼──────────┐  ┌─────────────┐  │
│  │ authService  │  │ expenseService │  │ chatService  │  │
│  │ JWT + bcrypt │  │ budget logic   │  │ LangChain   │  │
│  └──────────────┘  └───────────────┘  │ + Groq API  │  │
│                                       └─────────────┘  │
└─────────────────────┬────────────────────────────────────┘
                      │  Mongoose ODM
┌─────────────────────▼────────────────────────────────────┐
│                   MONGODB ATLAS (Free M0)                │
│  organizations · users · companies · categories          │
│  payment_methods · expenses · incomes                    │
│  budget_buckets · chat_sessions                          │
└──────────────────────────────────────────────────────────┘
                      │  Groq SDK
┌─────────────────────▼────────────────────────────────────┐
│             GROQ CLOUD API (External)                    │
│           llama-3.3-70b-versatile (free tier)            │
└──────────────────────────────────────────────────────────┘
```

---

## 4. Complete Project Folder Structure

```
expenseflow-saas/
│
├── README.md
├── .gitignore
│
├── server/                            ← Node.js backend
│   ├── package.json
│   ├── .env                           ← secrets (never commit)
│   ├── .env.example                   ← template to commit
│   └── src/
│       ├── index.js                   ← Entry: Express + Apollo setup
│       │
│       ├── config/
│       │   └── db.js                  ← Mongoose connect to Atlas
│       │
│       ├── models/                    ← 9 Mongoose schemas
│       │   ├── Organization.js
│       │   ├── User.js
│       │   ├── Company.js
│       │   ├── Category.js
│       │   ├── PaymentMethod.js
│       │   ├── Expense.js
│       │   ├── Income.js
│       │   ├── BudgetBucket.js
│       │   └── ChatSession.js
│       │
│       ├── schema/
│       │   ├── typeDefs/              ← GraphQL SDL type definitions
│       │   │   ├── index.js           ← merges all typeDefs
│       │   │   ├── auth.graphql
│       │   │   ├── organization.graphql
│       │   │   ├── company.graphql
│       │   │   ├── category.graphql
│       │   │   ├── paymentMethod.graphql
│       │   │   ├── expense.graphql
│       │   │   ├── income.graphql
│       │   │   ├── budget.graphql
│       │   │   └── chat.graphql
│       │   │
│       │   └── resolvers/             ← One file per entity
│       │       ├── index.js           ← merges all resolvers
│       │       ├── authResolvers.js
│       │       ├── companyResolvers.js
│       │       ├── categoryResolvers.js
│       │       ├── paymentMethodResolvers.js
│       │       ├── expenseResolvers.js
│       │       ├── incomeResolvers.js
│       │       ├── budgetResolvers.js
│       │       └── chatResolvers.js
│       │
│       ├── services/
│       │   ├── authService.js         ← JWT sign/verify, bcrypt hash/compare
│       │   ├── chatService.js         ← LangChain + Groq integration
│       │   ├── budgetService.js       ← Budget usage calculation logic
│       │   └── seedService.js         ← Seeds CORE BRIGHT categories on first run
│       │
│       └── middleware/
│           └── auth.js                ← Express/Apollo JWT context middleware
│
└── client/                            ← React + Vite frontend
    ├── package.json
    ├── vite.config.js
    ├── index.html
    └── src/
        ├── main.jsx                   ← ReactDOM.createRoot + ApolloProvider
        ├── App.jsx                    ← Router + route definitions
        │
        ├── graphql/
        │   ├── client.js              ← Apollo Client setup with auth headers
        │   ├── queries.js             ← All GQL query definitions
        │   └── mutations.js           ← All GQL mutation definitions
        │
        ├── store/
        │   └── authStore.js           ← Zustand: user, token, org, logout
        │
        ├── hooks/
        │   ├── useAuth.js             ← Login/logout/register helpers
        │   ├── useExpenses.js         ← Wrapped Apollo hooks for expenses
        │   ├── useIncome.js
        │   ├── useBudgets.js
        │   └── useChat.js
        │
        ├── components/
        │   ├── layout/
        │   │   ├── Navbar.jsx         ← Top nav (replaces 5× duplicated nav HTML)
        │   │   ├── Sidebar.jsx        ← Optional left sidebar for settings pages
        │   │   └── PageLayout.jsx     ← Wraps pages with nav + footer
        │   │
        │   ├── ui/
        │   │   ├── Button.jsx
        │   │   ├── Modal.jsx
        │   │   ├── Toast.jsx          ← Ports toast.js logic
        │   │   ├── Badge.jsx          ← Status chips (e.g. "80% used" warning)
        │   │   └── LoadingSpinner.jsx
        │   │
        │   ├── forms/
        │   │   ├── ExpenseRowForm.jsx ← Single expense row (replaces createRow() logic)
        │   │   ├── BulkExpenseForm.jsx
        │   │   ├── IncomeRowForm.jsx
        │   │   └── BulkIncomeForm.jsx
        │   │
        │   ├── charts/
        │   │   ├── CategoryPieChart.jsx     ← Recharts: category breakdown
        │   │   ├── MonthlyBarChart.jsx      ← Recharts: monthly trend
        │   │   ├── IncomeVsExpenseChart.jsx ← Recharts: comparison
        │   │   └── BudgetProgressBar.jsx    ← Visual budget usage bar
        │   │
        │   ├── budget/
        │   │   ├── BucketCard.jsx     ← Budget card: limit, used %, alert badge
        │   │   └── CreateBucketModal.jsx
        │   │
        │   └── chat/
        │       ├── ChatPanel.jsx      ← Slide-in chat panel (ports chat.js)
        │       ├── ChatMessage.jsx    ← Single message bubble
        │       └── QuickActions.jsx   ← Quick prompt chips
        │
        ├── pages/
        │   ├── LoginPage.jsx          ← Register + Login form
        │   ├── DashboardPage.jsx      ← Analytics overview (ports dashboard.js)
        │   ├── ExpensesPage.jsx       ← Add + View expenses (ports app.js + expenses.js)
        │   ├── IncomePage.jsx         ← Add + View income (ports income.js + income-list.js)
        │   ├── BudgetsPage.jsx        ← NEW: Budget buckets management
        │   ├── CompaniesPage.jsx      ← NEW: Manage companies per org
        │   ├── CategoriesPage.jsx     ← NEW: Manage categories + subcategories
        │   └── SettingsPage.jsx       ← NEW: Payment methods, org profile
        │
        ├── utils/
        │   ├── formatCurrency.js      ← ₹ formatter (reuse from current JS)
        │   ├── dateHelpers.js
        │   └── exportToCSV.js         ← NEW: Download expenses/income as CSV
        │
        └── assets/
            └── css/
                ├── global.css         ← Ported from styles.css (design tokens)
                └── dashboard.css      ← Ported from dashboard.css
```

---

## 5. Database Schema — All 9 Collections

### `organizations`
```js
{
  _id: ObjectId,
  name: String,          // "Acme Corp"
  slug: String,          // "acme-corp" (unique, used in URLs)
  plan: { type: String, enum: ['free', 'pro'], default: 'free' },
  createdAt: Date,
  updatedAt: Date
}
```

### `users`
```js
{
  _id: ObjectId,
  orgId: ObjectId,       // ref: Organization
  name: String,
  email: String,         // unique
  passwordHash: String,  // bcrypt
  role: { type: String, enum: ['owner', 'admin', 'member'], default: 'owner' },
  createdAt: Date,
  lastLogin: Date
}
```

### `companies`
```js
{
  _id: ObjectId,
  orgId: ObjectId,       // ref: Organization
  name: String,          // "BRIGHT DIGITAL PVT LTD"
  description: String,
  isActive: { type: Boolean, default: true },
  createdAt: Date,
  createdBy: ObjectId    // ref: User
}
```

### `categories`
```js
{
  _id: ObjectId,
  orgId: ObjectId,                  // null = global seed data (available to all)
  name: String,                     // "Infrastructure & Utilities"
  group: String,                    // "O" (from CORE BRIGHT: C/O/R/E/B/I/G/H/T)
  groupLabel: String,               // "O — Operations"
  subcategories: [{
    name: String,                   // "Office Space"
    items: [String],               // ["Rent", "Water bill", ...]
    isCustom: { type: Boolean, default: false }
  }],
  isGlobal: { type: Boolean, default: false },
  createdAt: Date
}
```
> **Note:** On first server start, `seedService.js` imports all 50+ categories from the current `categories.js` file into MongoDB with `isGlobal: true, orgId: null`. Every org gets these automatically.

### `payment_methods`
```js
{
  _id: ObjectId,
  orgId: ObjectId,       // ref: Organization
  name: String,          // "HDFC Current Account"
  type: { type: String, enum: ['cash', 'bank', 'card', 'upi', 'other'] },
  accountNumber: String, // optional last 4 digits
  isActive: { type: Boolean, default: true },
  createdAt: Date
}
```

### `budget_buckets`
```js
{
  _id: ObjectId,
  orgId: ObjectId,
  companyId: ObjectId,          // which company this budget is for
  categoryId: ObjectId,         // which category being budgeted
  categoryName: String,         // denormalized for display
  name: String,                 // "Marketing Q1 Budget"
  limitAmount: Number,          // ₹50000
  period: { type: String, enum: ['monthly', 'quarterly', 'yearly', 'custom'] },
  startDate: Date,
  endDate: Date,
  alertThreshold: { type: Number, default: 80 },  // alert at 80%
  createdAt: Date,
  createdBy: ObjectId
}
```

### `expenses`
```js
{
  _id: ObjectId,
  orgId: ObjectId,
  companyId: ObjectId,         // ref: Company
  date: Date,
  categoryId: ObjectId,        // ref: Category
  categoryName: String,        // denormalized
  subcategory: String,
  amount: Number,
  vendor: String,
  paymentMethodId: ObjectId,   // ref: PaymentMethod
  paymentMethodName: String,   // denormalized
  notes: String,
  budgetBucketId: ObjectId,    // optional: link expense to a bucket
  createdAt: Date,
  createdBy: ObjectId,
  updatedAt: Date,
  updatedBy: ObjectId,
  isDeleted: { type: Boolean, default: false }   // soft delete
}
```

### `incomes`
```js
{
  _id: ObjectId,
  orgId: ObjectId,
  companyId: ObjectId,
  date: Date,
  amount: Number,
  source: String,
  notes: String,
  createdAt: Date,
  createdBy: ObjectId,
  isDeleted: { type: Boolean, default: false }
}
```

### `chat_sessions`
```js
{
  _id: ObjectId,
  orgId: ObjectId,
  userId: ObjectId,
  sessionId: String,           // client-generated session key
  messages: [{
    role: { type: String, enum: ['user', 'assistant'] },
    content: String,
    timestamp: Date
  }],
  createdAt: Date,
  updatedAt: Date
}
```

---

## 6. Full GraphQL API Surface

### Type Definitions (key types)

```graphql
type AuthPayload {
  token: String!
  user: User!
  org: Organization!
}

type BudgetUsage {
  bucket: BudgetBucket!
  usedAmount: Float!
  remainingAmount: Float!
  percentUsed: Float!
  isOverBudget: Boolean!
  isNearLimit: Boolean!   # true when percentUsed >= alertThreshold
}

type DashboardSummary {
  totalExpenses: Float!
  totalIncome: Float!
  netBalance: Float!
  expenseCount: Int!
  incomeCount: Int!
  topCategory: String
  topVendor: String
}
```

### All Queries

```graphql
type Query {
  # Auth
  me: User!

  # Companies
  companies: [Company!]!
  company(id: ID!): Company!

  # Categories (global + org custom merged)
  categories: [Category!]!

  # Payment Methods
  paymentMethods: [PaymentMethod!]!

  # Expenses
  expenses(filter: ExpenseFilter, page: Int, limit: Int): ExpensePage!
  expense(id: ID!): Expense!

  # Income
  incomes(filter: IncomeFilter, page: Int, limit: Int): IncomePage!
  income(id: ID!): Income!

  # Budget Buckets
  budgetBuckets(companyId: ID): [BudgetBucket!]!
  budgetUsage(bucketId: ID!): BudgetUsage!
  allBudgetUsages(companyId: ID): [BudgetUsage!]!

  # Dashboard Aggregations
  dashboardSummary(filter: DashFilter!): DashboardSummary!
  categoryBreakdown(filter: DashFilter!): [CategoryBreakdown!]!
  monthlyTrend(months: Int!): [MonthlyTrend!]!
  incomeVsExpenseTrend(months: Int!): [IncomeExpenseTrend!]!
  topVendors(filter: DashFilter!, limit: Int): [VendorStat!]!
  paymentMethodBreakdown(filter: DashFilter!): [PaymentMethodStat!]!

  # Chat
  chatSession(sessionId: String!): ChatSession
}
```

### All Mutations

```graphql
type Mutation {
  # Auth
  register(input: RegisterInput!): AuthPayload!
  login(email: String!, password: String!): AuthPayload!

  # Companies
  createCompany(input: CompanyInput!): Company!
  updateCompany(id: ID!, input: CompanyInput!): Company!
  deleteCompany(id: ID!): Boolean!

  # Categories
  createCategory(input: CategoryInput!): Category!
  addSubcategory(categoryId: ID!, subcategoryName: String!, items: [String]): Category!
  updateSubcategoryItems(categoryId: ID!, subcategoryName: String!, items: [String!]!): Category!
  deleteSubcategory(categoryId: ID!, subcategoryName: String!): Category!

  # Payment Methods
  createPaymentMethod(input: PaymentMethodInput!): PaymentMethod!
  updatePaymentMethod(id: ID!, input: PaymentMethodInput!): PaymentMethod!
  deletePaymentMethod(id: ID!): Boolean!

  # Expenses (bulk create for the multi-row form)
  createExpenses(inputs: [ExpenseInput!]!): [Expense!]!
  updateExpense(id: ID!, input: ExpenseInput!): Expense!
  deleteExpense(id: ID!): Boolean!

  # Income (bulk create)
  createIncomes(inputs: [IncomeInput!]!): [Income!]!
  updateIncome(id: ID!, input: IncomeInput!): Income!
  deleteIncome(id: ID!): Boolean!

  # Budget Buckets
  createBudgetBucket(input: BudgetBucketInput!): BudgetBucket!
  updateBudgetBucket(id: ID!, input: BudgetBucketInput!): BudgetBucket!
  deleteBudgetBucket(id: ID!): Boolean!

  # Chat
  sendChatMessage(sessionId: String!, message: String!): ChatMessage!
  clearChatSession(sessionId: String!): Boolean!
}
```

---

## 7. AI Chatbot — How It Works (No n8n)

The chatbot is ported 1:1 from the n8n workflow but runs natively in Node.js using LangChain.js.

**Current n8n flow:**
```
Chat Trigger → AI Agent (system prompt) → Groq LLM + Postgres SQL tool + Chat Memory
```

**New native flow:**
```
GraphQL sendChatMessage mutation
  → chatResolvers.js
    → chatService.js
      → LangChain ConversationChain
          ├── ChatGroq (llama-3.3-70b-versatile)
          ├── MongoDB chat memory (BufferMemory from DB)
          └── MongooseQueryTool (runs Mongoose aggregations instead of raw SQL)
```

**System prompt (updated for MongoDB):**
```
You are a finance AI assistant for ExpenseFlow.

Available Mongoose models: Expense, Income, Company

Rules:
- Only read data, never write/delete.
- Always filter by the current user's orgId.
- Support filters: company name, category, subcategory, vendor, paymentMethod, date range.
- Understand: expenses, spend, payments, income, revenue, earnings.
- Prefer summaries unless details requested.
- Format money with ₹.
- If no data: "I cannot find data for that."
- If unrelated: "I can only help with finance tracking data."
```

---

## 8. Budget Buckets Feature — Logic

```
Budget Bucket = {
  company: "BRIGHT DIGITAL",
  category: "Infrastructure & Utilities",
  limit: ₹50,000,
  period: "monthly",
  alertThreshold: 80%
}

Budget Usage Query:
  usedAmount = SUM of expenses WHERE
    companyId = bucket.companyId AND
    categoryId = bucket.categoryId AND
    date BETWEEN bucket.startDate AND bucket.endDate AND
    isDeleted = false

  percentUsed = (usedAmount / limitAmount) * 100
  isNearLimit = percentUsed >= alertThreshold
  isOverBudget = usedAmount > limitAmount
  remainingAmount = limitAmount - usedAmount
```

**Frontend display:**
- 🟢 Green bar: 0–60% used
- 🟡 Yellow bar: 60–80% used
- 🔴 Red bar: 80–100% used
- ⚠️ Red badge: Over budget

---

## 9. Auth Flow

```
Register:
  POST /graphql → register(input) mutation
  → Validate email unique
  → Create Organization record
  → Create User record (role: 'owner')
  → Hash password with bcrypt (rounds: 12)
  → Sign JWT ({ userId, orgId, role }, secret, 7d expiry)
  → Return { token, user, org }

Login:
  POST /graphql → login(email, password) mutation
  → Find user by email
  → bcrypt.compare(password, hash)
  → Sign JWT
  → Return { token, user, org }

Every protected request:
  Apollo Client → adds Authorization: Bearer <token> header
  Apollo Server context() → verifies JWT → injects { userId, orgId, role } into context
  Resolvers → check context.userId, filter all DB queries by context.orgId
```

---

## 10. Environment Variables

### `server/.env.example`
```env
# MongoDB
MONGODB_URI=mongodb+srv://<user>:<password>@cluster0.mongodb.net/expenseflow?retryWrites=true&w=majority

# JWT
JWT_SECRET=your_super_secret_key_min_32_chars
JWT_EXPIRY=7d

# Groq
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Server
PORT=4000
NODE_ENV=development

# CORS
CLIENT_URL=http://localhost:5173
```

### `client/.env.example`
```env
VITE_GRAPHQL_URL=http://localhost:4000/graphql
```

---

## 11. NPM Dependencies

### Backend (`server/package.json`)
```json
{
  "dependencies": {
    "express": "^4.18.2",
    "@apollo/server": "^4.10.0",
    "graphql": "^16.8.1",
    "@graphql-tools/merge": "^9.0.0",
    "graphql-tag": "^2.12.6",
    "mongoose": "^8.3.0",
    "jsonwebtoken": "^9.0.2",
    "bcryptjs": "^2.4.3",
    "@langchain/groq": "^0.1.0",
    "langchain": "^0.2.0",
    "dotenv": "^16.4.5",
    "cors": "^2.8.5",
    "express-rate-limit": "^7.3.0"
  },
  "devDependencies": {
    "nodemon": "^3.1.0"
  }
}
```

### Frontend (`client/package.json`)
```json
{
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-router-dom": "^6.23.0",
    "@apollo/client": "^3.10.0",
    "graphql": "^16.8.1",
    "zustand": "^4.5.0",
    "recharts": "^2.12.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.0",
    "vite": "^5.2.0"
  }
}
```

---

## 12. Phased Execution Plan

> Each phase builds on the previous. Do NOT skip phases. Each phase ends with a working, testable deliverable.

---

### ✅ Phase 1 — Backend: Project Setup + Database (Day 1)

**Goal:** Server runs, connects to MongoDB, all models defined.

**Tasks:**
1. `mkdir expenseflow-saas && cd expenseflow-saas`
2. `mkdir server client`
3. In `server/`: `npm init -y` → install all backend dependencies
4. Create `server/src/index.js` — Express app, port 4000, basic health check route `GET /health`
5. Create `server/src/config/db.js` — `mongoose.connect(process.env.MONGODB_URI)`
6. Create all 9 Mongoose models (files listed in structure above)
7. Create `server/.env` with real MongoDB Atlas URI (M0 free cluster)
8. Create `server/src/services/seedService.js`:
   - Reads the CORE BRIGHT category data (port from `categories.js`)
   - Inserts into `categories` collection with `isGlobal: true` only if collection is empty
   - Called once on server startup
9. Run server: `node src/index.js` → verify DB connection logs + seed runs

**Deliverable:** `GET http://localhost:4000/health` returns `{ status: 'ok', db: 'connected' }`

---

### ✅ Phase 2 — Backend: GraphQL API Core (Days 2–4)

**Goal:** All CRUD operations working via GraphQL Playground.

**Tasks:**
1. Add Apollo Server 4 as Express middleware in `index.js`
2. Create `schema/typeDefs/` — write all `.graphql` SDL files
3. Create `schema/typeDefs/index.js` — merge all typeDefs using `@graphql-tools/merge`
4. Create `middleware/auth.js` — JWT context middleware
5. Create `services/authService.js` — `hashPassword`, `comparePassword`, `signToken`, `verifyToken`
6. Write resolvers in order:
   - `authResolvers.js`: `register`, `login`, `me`
   - `companyResolvers.js`: `companies`, `company`, `createCompany`, `updateCompany`, `deleteCompany`
   - `categoryResolvers.js`: all category + subcategory resolvers
   - `paymentMethodResolvers.js`: CRUD
   - `expenseResolvers.js`: `createExpenses` (bulk), `expenses` (filtered, paginated), `expense`, `updateExpense`, `deleteExpense` (soft)
   - `incomeResolvers.js`: same pattern
7. Create `schema/resolvers/index.js` — merge all resolvers

**Test in Apollo Sandbox (`http://localhost:4000/graphql`):**
- Register an org
- Login → get token
- Add token to Sandbox headers
- Create a company → verify in MongoDB Atlas
- Create expenses (bulk 3 rows) → verify
- Query expenses with filter

**Deliverable:** Full CRUD working for auth, companies, categories, payment methods, expenses, income.

---

### ✅ Phase 3 — Backend: Dashboard Aggregations + Budget Buckets (Days 5–6)

**Goal:** Dashboard queries return real analytics; budget buckets track spend.

**Tasks:**
1. Write `dashboardSummary` resolver:
   - `SUM expenses.amount` filtered by orgId, date range, optional companyId
   - `SUM incomes.amount` same filters
   - `netBalance = totalIncome - totalExpenses`
   - Return top category, top vendor
2. Write `categoryBreakdown` resolver:
   - `GROUP BY categoryName, SUM amount` → sorted descending
3. Write `monthlyTrend` resolver:
   - `GROUP BY year+month, SUM amount` for last N months
4. Write `incomeVsExpenseTrend` resolver:
   - Same but returns both income and expense per month
5. Write `budgetResolvers.js`:
   - `createBudgetBucket`, `updateBudgetBucket`, `deleteBudgetBucket`
   - `budgetBuckets(companyId)` — list buckets
   - `budgetUsage(bucketId)` — aggregate actual spend vs limit (logic from section 8)
   - `allBudgetUsages(companyId)` — all buckets with usage for a company

**Deliverable:** Query `dashboardSummary` → returns correct totals. Create a budget bucket → add expenses → query `budgetUsage` → see correct % used.

---

### ✅ Phase 4 — Backend: AI Chatbot (Day 7)

**Goal:** AI assistant answers financial questions using live org data, with session memory.

**Tasks:**
1. Install `@langchain/groq` and `langchain`
2. Create `services/chatService.js`:
   - Initialize `ChatGroq` with model `llama-3.3-70b-versatile`
   - Create a custom LangChain tool `QueryFinancialData` that:
     - Takes natural language → converts to a Mongoose query
     - Queries `Expense` and `Income` models filtered by `orgId`
     - Returns formatted results
   - Build system prompt (section 7)
   - Load/save chat history from `ChatSession` MongoDB document
3. Write `chatResolvers.js`:
   - `sendChatMessage(sessionId, message)`:
     1. Load existing session from DB (or create new)
     2. Call `chatService.chat(orgId, userId, sessionId, message, history)`
     3. Save updated session to DB
     4. Return `{ role: 'assistant', content: reply, timestamp }`
   - `clearChatSession(sessionId)`: delete session from DB
   - `chatSession(sessionId)`: return full history

**Deliverable:** Send "What are my total expenses this month?" via GraphQL → get correct ₹ response from Groq.

---

### ✅ Phase 5 — Frontend: React + Vite App (Days 8–13)

**Goal:** Full working React SPA connected to the GraphQL backend.

**Sub-phase 5A — Setup (Day 8)**
1. In `client/`: `npm create vite@latest . -- --template react`
2. Install all frontend dependencies
3. Create `src/graphql/client.js` — Apollo Client with auth link (reads JWT from Zustand store)
4. Create `src/store/authStore.js` — Zustand store: `{ user, token, org, login, logout }`
5. Create `src/App.jsx` — React Router with routes and protected route wrapper
6. Port `css/styles.css` and `css/dashboard.css` as `src/assets/css/global.css` and `dashboard.css`
7. Import global CSS in `main.jsx`

**Sub-phase 5B — Auth Pages (Day 8)**
1. Build `LoginPage.jsx` — Login + Register tabs, calls `login` / `register` mutations, stores token

**Sub-phase 5C — Shared Components (Day 9)**
1. `Navbar.jsx` — Single shared nav, reads from Zustand for user info
2. `PageLayout.jsx` — Wraps every page
3. `Toast.jsx` — Port `toast.js` logic
4. `Modal.jsx` — Generic modal component
5. `Button.jsx`, `Badge.jsx`, `LoadingSpinner.jsx`

**Sub-phase 5D — Expenses Pages (Day 10)**
1. `ExpenseRowForm.jsx` — Single row with: Date, Company (dropdown), Category (dropdown), Subcategory (dynamic), Amount, Vendor, Payment Method (dropdown), Notes
2. `BulkExpenseForm.jsx` — Add/Remove rows, running total, Submit → `createExpenses` mutation
3. `ExpensesPage.jsx` — Table with filters (date range, company, search), sort, pagination

**Sub-phase 5E — Income Pages (Day 10)**
1. `IncomeRowForm.jsx` — Date, Company, Amount, Source, Notes
2. `BulkIncomeForm.jsx`
3. `IncomePage.jsx` — Table with filters

**Sub-phase 5F — Dashboard (Days 11–12)**
1. `DashboardPage.jsx` — Summary KPI cards (Total Expenses, Income, Net Balance)
2. `CategoryPieChart.jsx` — `categoryBreakdown` query → Recharts PieChart
3. `MonthlyBarChart.jsx` — `monthlyTrend` query → Recharts BarChart
4. `IncomeVsExpenseChart.jsx` — `incomeVsExpenseTrend` → Recharts ComposedChart
5. Date preset filters: This Month, Last Month, Last 3M, Last 6M, YTD, All Time
6. Company filter dropdown

**Sub-phase 5G — Budget Buckets Page (Day 12)**
1. `BudgetsPage.jsx` — Grid of `BucketCard` components per company
2. `BucketCard.jsx` — Shows: Name, Category, Limit, Used ₹, Remaining ₹, % bar (color-coded)
3. `CreateBucketModal.jsx` — Form: Company, Category, Name, Limit, Period, Alert %
4. Connect to `allBudgetUsages`, `createBudgetBucket`, `deleteBudgetBucket`

**Sub-phase 5H — Settings Pages (Day 13)**
1. `CompaniesPage.jsx` — List, Add, Edit, Delete companies
2. `CategoriesPage.jsx` — List global categories, add custom subcategories per category
3. `SettingsPage.jsx` — Payment Methods (Add/Edit/Delete bank accounts, card, cash, UPI)

**Sub-phase 5I — AI Chat Widget (Day 13)**
1. `ChatPanel.jsx` — Slide-in panel (exact port of current chat panel UI)
2. `ChatMessage.jsx` — User/Bot bubbles with timestamp, rich text rendering, copy-on-click
3. `QuickActions.jsx` — Quick prompt chips
4. Connect to `sendChatMessage` and `clearChatSession` GraphQL mutations

**Deliverable:** Full app running at `http://localhost:5173` with all pages working.

---

### ✅ Phase 6 — Polish, Validation & Export (Day 14)

**Goal:** Production-ready error handling, validation, and data export.

**Tasks:**
1. **Server-side validation:** Add Zod validators for all mutation inputs
2. **Error handling:** Consistent GraphQL error format `{ code, message, field }`
3. **Rate limiting:** `express-rate-limit` — 100 req/15min per IP, 10 req/min for chat
4. **CSV Export:** REST endpoint `GET /export/expenses` and `GET /export/income` with query params (filter by company, date). Returns CSV download.
5. **Export button** in Expenses and Income table pages
6. **Empty states:** All pages show helpful empty state messages when no data
7. **Responsive design:** Ensure mobile-friendly layout
8. **README.md:** Setup guide with step-by-step instructions

**Deliverable:** End-to-end working SaaS. Any new developer can clone repo, add `.env`, run `npm install && npm run dev` and have it working.

---

## 13. What's Removed vs What's Kept

| Item | Action | Reason |
|---|---|---|
| `index.html`, `dashboard.html`, etc. | 🗑️ Removed | Replaced by React SPA |
| `js/config.js` | 🗑️ Removed | Replaced by Apollo Client + `.env` |
| `js/app.js` | 🔄 Ported → `BulkExpenseForm.jsx` | Logic preserved, React-ified |
| `js/income.js` | 🔄 Ported → `BulkIncomeForm.jsx` | |
| `js/categories.js` | 🔄 Seeded to MongoDB | Data preserved, no longer hardcoded |
| `js/companies.js` | 🔄 Ported → `CompaniesPage.jsx` | DB-backed instead of localStorage |
| `js/chat.js` | 🔄 Ported → `ChatPanel.jsx` | Connected to GraphQL instead of n8n webhook |
| `js/dashboard.js` | 🔄 Ported → `DashboardPage.jsx` + Recharts | Canvas charts replaced by Recharts |
| `css/styles.css` | ✅ Kept | Design system ported as-is |
| `css/dashboard.css` | ✅ Kept | Ported as-is |
| Zoho Books | 🗑️ Removed entirely | All `zoho_account_id`, `zoho_organization_id` gone |
| n8n webhooks | 🗑️ Removed entirely | Native Node.js + GraphQL |
| Supabase | 🗑️ Removed entirely | MongoDB is DB |
| Google Sheets | 🗑️ Removed entirely | Never used directly in UI |
| `zoho_account_mappings` table | 🗑️ Removed | No Zoho |
| `system_settings` table | 🗑️ Removed | Replaced by org profile + settings page |
| `n8n_chat_histories` table | 🗑️ Removed | Replaced by `chat_sessions` MongoDB collection |
| Hardcoded `ICICI`, `HDFC`, `Petty Cash` | 🔄 Moved to Settings → Payment Methods | User-configurable per org |
| Hardcoded Zoho org ID `60061889304` | 🗑️ Removed | |

---

## 14. Quick-Start Commands (for execution)

```bash
# 1. Create project root
mkdir expenseflow-saas && cd expenseflow-saas

# 2. Init backend
mkdir server && cd server
npm init -y
npm install express @apollo/server graphql @graphql-tools/merge graphql-tag \
  mongoose jsonwebtoken bcryptjs @langchain/groq langchain \
  dotenv cors express-rate-limit
npm install -D nodemon
cd ..

# 3. Init frontend
cd client
npm create vite@latest . -- --template react
npm install @apollo/client graphql react-router-dom zustand recharts
cd ..

# 4. Copy .env files
cp server/.env.example server/.env
cp client/.env.example client/.env
# → Fill in MONGODB_URI, JWT_SECRET, GROQ_API_KEY

# 5. Run dev
# Terminal 1:
cd server && npx nodemon src/index.js
# Terminal 2:
cd client && npm run dev
```
