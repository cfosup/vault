# How Vault works

Vault is a multi-company finance app. One organization has many companies. People in that organization record expenses and income, set budgets, and read an overview. Amounts are shown in Indian rupees.

Read this first. Then use [QUERIES_AND_MUTATIONS.md](QUERIES_AND_MUTATIONS.md) for the API and [DATABASE.md](DATABASE.md) for how rows are stored.

## What you run

| Piece | Folder | What it is |
|---|---|---|
| Web app | `client/` | React 19, Vite, Apollo Client, Zustand |
| API | `server/` | Express, Apollo Server 4, GraphQL, Mongoose |
| Database | MongoDB | One database shared by every organization. Rows are separated by `orgId`. |

The browser talks to `POST /graphql`. CSV downloads use three REST routes. A daily job uses one private REST route.

```
Browser (localhost:5173)
  -> GraphQL  POST /graphql
  -> CSV      GET  /export/expenses | /export/income | /export/categories
API (port from server/.env, often 10000 locally)
  -> MongoDB
  -> Resend (email)
  -> Groq (chat)
  -> Firebase (Google sign-in token check)
```

## Start it locally

1. `cd server` and `npm install`. Then `cd ../client` and `npm install`.
2. Copy `server/.env.example` to `server/.env` and fill in real values. Never commit `.env`.
3. Copy `client/.env.example` to `client/.env` if you want the app to call a port other than 4000.
4. Start the API: `cd server` then `npm run dev`.
5. Start the web app. If the API port in `.env` is `10000`, start the client with:

```
$env:VITE_GRAPHQL_URL='http://localhost:10000/graphql'
$env:VITE_API_URL='http://localhost:10000'
npm run dev
```

Open `http://localhost:5173`.

`npm test` inside `server` is meant to use an in-memory database. Set `MONGODB_URI` to an empty string in that terminal before `npm test`, so the tests do not write to the live database.

## Pages

| URL | Who sees it | File |
|---|---|---|
| `/login` | Everyone | `client/src/pages/LoginPage.jsx` |
| `/join?token=` | Invited person | `client/src/pages/JoinPage.jsx` |
| `/` | Workspace access | `client/src/pages/DashboardPage.jsx` |
| `/expenses` | Expenses access | `client/src/pages/ExpensesPage.jsx` |
| `/income` | Income access | `client/src/pages/IncomePage.jsx` |
| `/budgets` | Workspace access | `client/src/pages/BudgetsPage.jsx` |
| `/companies` | Workspace access | `client/src/pages/CompaniesPage.jsx` |
| `/settings` | Everyone signed in | `client/src/pages/SettingsPage.jsx` |
| `/admin` | Super admin only | `client/src/pages/AdminDashboardPage.jsx` |

The menu is `client/src/components/layout/Navbar.jsx`. It hides pages the signed-in person cannot open.

## Sign-in

- Email and password: `login`. The password is stored as a bcrypt hash on `User.passwordHash`.
- New organization: `register`. This creates an `Organization` and a `User` with role `owner`. It does not join an existing organization.
- Google: the browser gets a Firebase ID token. `firebaseOAuth` checks that token on the server for project `vault-cbf53`. The server does not trust an email sent by the browser on its own.
- Forgot password: `requestPasswordReset` always returns the same success sentence, so it does not reveal whether the email exists. The link is `/login?resetToken=...` and lasts one hour. `resetPassword` sets the new password.
- Invite: the owner calls `inviteMember`. The email contains `/join?token=...`. `acceptInvite` creates a `member` in the same organization. It does not call `register`.

The customer token is stored as `vault_token`. The super-admin token is a different key, `vault_admin_token`.

## Who can do what

The JWT carries `userId`, `orgId`, and `role`. Resolvers read the organization from the token, not from the client.

| Role | Day-to-day writes | Companies, invites, month lock | Delete expenses or income |
|---|---|---|---|
| `owner`, `superadmin` | Yes | Yes | Yes |
| `admin` with no `accessScope` | Yes | No | Yes |
| `member` with no `accessScope` | No | No | No |
| Invited person | Only the modules and companies on their user row | No | Only if those delete flags are on |

`accessScope` is either `workspace` (the whole app) or `modules` (`expenses`, `income`, or both). An empty `companyIds` list means every company. A filled list means only those companies.

A locked month blocks create, edit, delete, and restore for expenses and income in that UTC month. The owner can unlock it. Delete permission does not override a lock.

Server rules live in `server/src/middleware/auth.js` and `server/src/utils/access.js`. The menu uses the matching helpers in `client/src/utils/access.js`.

## Main flows

**Expense.** Pick company, category, optional subcategory, amount, and optional vendor. The vendor list comes from earlier expenses with the same category, then narrows when a subcategory is chosen. One expense can be linked to one or more income rows. If it is linked to several, the split amounts must add up to the expense. Checking "repeat" stores one `RecurringSchedule`. The first row is the expense just saved. Later months are created by the schedule job.

**Income.** Company, date, who paid, and amount. The same repeat checkbox exists.

**Company delete.** Expenses and income for that company are soft-deleted. Budgets and company categories are removed. Then the company row is removed.

**Budget alert.** When spending on a budget reaches `alertThreshold` (default 80), one email goes to the organization owner for that budget and period. `BudgetAlertSent` stops a second email.

**Reports.** Weekly (Monday, previous Monday–Sunday, Asia/Kolkata) and monthly (day 1, previous month) emails go to the owner with a PDF attached. `ReportDispatch` stops a second send for the same period.

**Schedules.** Render sleeps, so nothing runs inside the process on a timer for this. Something must call `POST /internal/run-schedules` once a day with header `x-schedule-secret` equal to `SCHEDULE_SECRET`. That call creates due recurring rows, then sends a weekly or monthly report when the Kolkata date matches.

**Chat.** `sendChatMessage` is only for workspace access. The reply uses Groq when `GROQ_API_KEY` is set, and the organization's own numbers as context. Messages are stored on `ChatSession`.

## Where to edit

| Change | Start here |
|---|---|
| A screen | `client/src/pages/` |
| A GraphQL call from the browser | `client/src/graphql/queries.js` or `mutations.js` |
| The API shape | `server/src/schema/typeDefs/*.graphql` |
| What the API does | `server/src/schema/resolvers/` |
| A stored field | `server/src/models/` |
| Email text or template ids | `server/src/services/emailService.js` and `RESEND_TEMPLATE_*` in `.env` |
| Who may see or change a row | `server/src/utils/access.js` |

## Environment variables that matter

Server (`server/.env`): `MONGODB_URI`, `JWT_SECRET`, `JWT_EXPIRY`, `CLIENT_URL`, `PORT`, `GROQ_API_KEY`, `GROQ_MODEL`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, the six `RESEND_TEMPLATE_*` ids, `SCHEDULE_SECRET`, `FIREBASE_PROJECT_ID`, `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD`.

`SUPER_ADMIN_PASSWORD` is used only when that email does not already exist. Existing users are never overwritten.

Client: `VITE_GRAPHQL_URL` and `VITE_API_URL`. The names are `URL`, not `URI`.
