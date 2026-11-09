# Database

Vault uses one MongoDB database. Mongoose models are in `server/src/models/`. Every customer row that belongs to a customer is tied to an organization with `orgId`. The API always takes `orgId` from the JWT. A query that forgets `orgId` would leak data across customers, so new queries must filter on it.

MongoDB collection names are the plural lowercase form of the model name (`User` is stored in `users`).

```
Organization
  ├── User
  ├── Company
  │     ├── Category          (companyId set; global seed rows have companyId null)
  │     ├── Expense
  │     ├── Income
  │     ├── BudgetBucket
  │     └── RecurringSchedule
  ├── PaymentMethod
  ├── Invite
  ├── MonthLock
  ├── VendorMemory
  ├── ActivityLog
  ├── ChatSession
  ├── BudgetAlertSent
  └── ReportDispatch
```

`ApiEndpointMetric`, `ApiErrorLogEntry`, and `ApiTotals` are global. They are not tied to one organization. They are defined in `server/src/services/apiMetricsService.js`.

Dates on expenses and income are stored at noon UTC. That keeps the calendar day stable. Month locks compare the UTC year and month of that date.

## Organization

`server/src/models/Organization.js`

| Field | Meaning |
|---|---|
| `name` | Display name |
| `slug` | Unique URL-safe name |
| `plan` | `free` or `pro`. New organizations start as `free` |

## User

`server/src/models/User.js`. `email` is unique in the whole database, so one email belongs to one organization.

| Field | Meaning |
|---|---|
| `orgId` | Organization |
| `name`, `email` | Identity |
| `passwordHash` | bcrypt hash. Empty for a Google-only account |
| `firebaseUid`, `authProvider`, `avatarUrl` | Google sign-in. Provider is `local`, `google`, or `firebase` |
| `role` | `owner`, `admin`, `member`, or `superadmin` |
| `accessScope` | Missing on older accounts. `workspace` or `modules` on invited people |
| `modules` | `expenses` and/or `income` when scope is `modules` |
| `companyIds` | Companies they may open. Empty means all companies |
| `canDeleteExpenses`, `canDeleteIncome` | Extra delete permission. Default false |
| `passwordResetToken`, `passwordResetExpires` | SHA-256 hash of the reset token, and when it stops working |
| `lastLogin`, `isEmailVerified` | Account bookkeeping |

An owner and a super admin ignore `accessScope` and the delete flags. An admin with no `accessScope` keeps full write and delete inside the organization. A member with no `accessScope` stays read-only. Do not backfill `accessScope` onto old users.

## Company

`server/src/models/Company.js`

| Field | Meaning |
|---|---|
| `orgId`, `name`, `description` | The company |
| `isActive` | Still in use |
| `isCoreBranch` | Marks a primary company when the product cares about one |
| `createdBy` | User who added it |

Index: `orgId + name`.

## Category

`server/src/models/Category.js`

| Field | Meaning |
|---|---|
| `orgId` | Null on the global seed |
| `companyId` | Null on the global seed. Set when the category belongs to one company |
| `name` | Category name |
| `group`, `groupLabel` | Letter group such as `O` and `O — Operations` |
| `isGlobal` | True for the shared seed list |
| `subcategories` | Embedded list, no separate collection |

Each subcategory has `name`, `items` (string list), and `isCustom`.

On first boot, `seedCategories` inserts the global list only when no global categories exist. It does not rewrite categories that are already there.

## Expense

`server/src/models/Expense.js`

| Field | Meaning |
|---|---|
| `orgId`, `companyId`, `date`, `amount` | The payment |
| `categoryId`, `categoryName`, `subcategory` | Category at the time of entry. The name is copied so a later rename does not rewrite history |
| `vendor` | Who was paid |
| `paymentMethodId`, `paymentMethodName` | Which account paid |
| `notes` | Free text |
| `budgetBucketId` | Budget touched by this expense, when one matched |
| `incomeId` | Primary linked income |
| `incomeIds` | Every linked income |
| `incomeAllocations` | `{ incomeId, amount, companyId }` split. The amounts must equal the expense when more than one income is linked |
| `createdBy`, `updatedBy` | Users |
| `isDeleted` | Soft delete. Lists hide these unless `includeDeleted` is set |

Indexes include `orgId + companyId + date`, `orgId + isDeleted`, and the income link.

## Income

`server/src/models/Income.js`

| Field | Meaning |
|---|---|
| `orgId`, `companyId`, `date`, `amount` | The receipt |
| `source` | Who paid |
| `notes` | Free text |
| `createdBy` | User |
| `isDeleted` | Soft delete |

## PaymentMethod

`server/src/models/PaymentMethod.js`

`orgId`, `name`, `type` (`cash`, `bank`, `card`, `upi`, `other`), `accountNumber`, `isActive`.

## BudgetBucket

`server/src/models/BudgetBucket.js`

| Field | Meaning |
|---|---|
| `orgId`, `companyId`, `categoryId`, `categoryName`, `name` | Which category is limited |
| `limitAmount` | Cap |
| `period` | `monthly`, `quarterly`, `yearly`, or `custom` |
| `startDate`, `endDate` | Used when the period is custom |
| `alertThreshold` | Percent that sends one email. Default 80 |
| `subcatBudgets` | Optional `{ subcategory, limitAmount }` splits |
| `createdBy` | User |

## Invite

`server/src/models/Invite.js`

`orgId`, `email`, `tokenHash` (never the raw token), `expiresAt` (7 days), `acceptedAt`, `accessScope`, `modules`, `companyIds`, `canDeleteExpenses`, `canDeleteIncome`, `invitedBy`.

The raw token exists only in the email link.

## MonthLock

`server/src/models/MonthLock.js`

`orgId`, `year`, `month` (1–12), `lockedBy`. Unique on `orgId + year + month`. While a row exists, nobody can create, edit, delete, or restore an expense or income in that month.

## RecurringSchedule

`server/src/models/RecurringSchedule.js`

| Field | Meaning |
|---|---|
| `orgId`, `companyId`, `createdBy` | Who it belongs to |
| `kind` | `expense` or `income` |
| `dayOfMonth` | 1–31. Day 31 uses the last day of a shorter month |
| `nextRunAt` | Next noon-UTC date the job should create a row |
| `active` | False after `stopRecurring` |
| `payload` | The fields copied onto each new expense or income |

The job creates at most one missed run, then moves `nextRunAt` forward one month. If that month is locked, it skips the row and still moves forward.

## VendorMemory

`server/src/models/VendorMemory.js`

`orgId`, `categoryId`, `subcategory`, `name`, `useCount`, `lastUsedAt`. Unique on organization, category, subcategory, and name.

The suggestion list the form shows is read from past `Expense` rows, not only from this collection. Saving an expense still updates this collection.

## ActivityLog

`server/src/models/ActivityLog.js`

`orgId`, `userId`, `userName`, `userEmail`, `action`, `entityType`, `entityId`, `companyId`, `companyName`, `description`, `metadata`. Written by `server/src/services/activityService.js` after important changes.

## ChatSession

`server/src/models/ChatSession.js`

`orgId`, `userId`, `sessionId`, and `messages`. Each message has `role` (`user` or `assistant`), `content`, and `timestamp`.

## Mail bookkeeping

These exist so a job can be called more than once and still send once.

| Model | Unique key | Meaning |
|---|---|---|
| `BudgetAlertSent` | `bucketId + periodKey` | The 80% email already went out for this budget and period |
| `ReportDispatch` | `orgId + kind + periodKey` | The weekly or monthly report already went out. `kind` is `weekly` or `monthly` |

## API metrics

Defined in `server/src/services/apiMetricsService.js`, not in `models/`.

| Model | Fields |
|---|---|
| `ApiEndpointMetric` | `key`, `endpoint`, `path`, `method`, `calls`, `errorCount`, `lastCalledAt` |
| `ApiErrorLogEntry` | `endpoint`, `statusCode`, `errorMessage`, `timestamp` |
| `ApiTotals` | One row: `singleton`, `totalCalls`, `totalErrors` |

The counter is stored as `errorCount` because Mongoose treats a field named `errors` as reserved. The GraphQL field is still called `errors`.

## What is not deleted when a person is removed

`removeMember` deletes the `User` document only. Expenses, income, and logs they created stay, with `createdBy` still pointing at the old id.
