# What to test

Test the live app by clicking, and keep the automated server tests on an empty `MONGODB_URI` so they use an in-memory database and do not touch real users.

```
cd server
$env:MONGODB_URI=''
npm test
```

Automated files already in `server/tests/`:

| File | What it covers |
|---|---|
| `phase1.test.js` | Database connection and the global category seed |
| `phase1_enhancements.test.js` | Extra model and seed cases |
| `phase2.test.js` | Register, login, companies, expenses, income, tenant isolation |
| `phase3.test.js` | Dashboard numbers and budget math |
| `phase4.test.js` | Chat session storage |
| `phase5_income_linking_usage.test.js` | Linking an expense to income and the usage report |
| `admin_dashboard.test.js` | Super-admin login and dashboard |
| `admin_resolvers_unit.test.js` | Admin resolver rules |

The checks below are the full pass for a person. Each box is one thing that should be true.

## 1. Sign-in and account

Screen: `/login`. Operations: `register`, `login`, `firebaseOAuth`, `requestPasswordReset`, `resetPassword`, `me`, `checkEmailExists`.

- A new email and organization creates an owner and opens the overview.
- The same email cannot register a second organization.
- A wrong password stays on the login page and does not sign anyone in.
- Sign out, then open `/expenses` directly. The app returns to login.
- Forgot password with an unknown email says the account does not exist and offers Create Account.
- Forgot password asks for the email, then sends the link. The link opens a page with password and repeat password only, then returns to sign in.
- The new password needs 8 characters, a number, and a special character. Create Account uses the same rule.
- A Google-only account can still receive a reset link and set a password.
- Continue with Google signs in only after Firebase accepts the token.
- After login, `me` shows the name, email, role, and access flags. The navbar uses that.

## 2. People and access

Screen: Settings. Operations: `inviteMember`, `invitePreview`, `acceptInvite`, `orgMembers`, `pendingInvites`, `updateMemberAccess`, `removeMember`.

- The owner sees People. An admin or member does not see the invite form.
- Invite with expenses only. The email link opens `/join`, shows the organization, and creates a member in the same organization.
- That person sees Expenses and Settings. They do not see Overview, Income, Budgets, or Companies.
- Invite with income only. They see Income and not Expenses.
- Invite with the whole workspace. They see every customer page except owner-only controls.
- Invite limited to one company. Lists and new rows stay inside that company.
- Leave companies unticked. They can use every company.
- Turn on expense delete. They can delete an expense. Turn it off. The delete control is gone.
- An email that already has an account is rejected.
- Remove a teammate. They can no longer sign in. Their old expenses remain.
- The owner cannot be removed or reduced to a member.

## 3. Companies

Screen: `/companies`. Operations: `companies`, `company`, `createCompany`, `updateCompany`, `deleteCompany`.

- The owner can add, rename, and edit a company.
- An admin can see companies but cannot create or delete one.
- The navbar company list includes the new company, and All companies still shows a combined view.
- Delete a company. Its expenses and income disappear from the active lists, its budgets and categories are gone, and the company is gone.
- A person limited to other companies never sees this company in a list or by guessing its id.

## 4. Categories

There is no Categories page. Categories are edited on the company screen and chosen on an expense.

Operations: `categories`, `category`, `createCategory`, `updateCategory`, `deleteCategory`, `deleteCategorySection`, `addSubcategory`, `updateSubcategoryItems`, `deleteSubcategory`, `resetCompanyCategoriesToCore`.

- A new company can receive the built-in category list once.
- Running that copy again does not duplicate the list.
- Add a category and a subcategory. They appear in the expense form for that company only.
- Add items on a subcategory, then change them.
- Delete a subcategory, then a category, then a whole letter group.
- Another organization's categories never appear.

## 5. Expenses

Screen: `/expenses`. Operations: `expenses`, `expense`, `createExpenses`, `updateExpense`, `deleteExpense`, `restoreExpense`, `expensesByIncome`.

- Add expense opens a blank form. Company stays on the selected company and the date is today. Category, vendor, amount, note, and repeat are empty.
- Save requires company, category, and amount.
- The saved row shows in the list and in the CSV export.
- Edit changes the amount and note. The form is titled Edit expense.
- Search finds the vendor or note. Sort by newest and oldest date works.
- Show deleted hides the row from the normal list. Restore brings it back.
- A member without delete permission cannot delete. A member without expense access cannot open the page.
- A batch of several rows saves together. The batch does not become recurring.
- Link one expense to one income. `expensesByIncome` returns it.
- Link one expense to two incomes. Save is blocked until the split equals the expense amount.
- An expense dated today uses the UTC month of that date for the lock check.

## 6. Vendors

Operation: `vendorSuggestions`.

- After two expenses share a category and vendor, Add expense plus that category shows the vendor as a chip.
- Choosing the subcategory shows only vendors used with that subcategory.
- A vendor used only on another category does not show.
- Clicking a chip fills the vendor field.
- The same names show on a batch row after its category is chosen.

## 7. Income

Screen: `/income`. Operations: `incomes`, `income`, `createIncomes`, `updateIncome`, `deleteIncome`, `restoreIncome`.

- Add income opens blank except for the company and today's date.
- Save requires company, who paid, and amount.
- Edit, search, show deleted, and restore work.
- A person with income-only access can do this and cannot open Expenses.
- CSV export matches the rows they are allowed to see.

## 8. Repeating entries

Operations: `createExpenses` or `createIncomes` with `makeRecurring`, `myRecurringSchedules`, `stopRecurring`, `POST /internal/run-schedules`.

- One expense with repeat creates a schedule for that day of the month. The row just saved is the first one.
- The schedule appears in Settings.
- Stop removes it from the active list. The old expense stays.
- Call `POST /internal/run-schedules` with the right `x-schedule-secret` when `nextRunAt` is due. One new row appears, and the next date moves one month ahead.
- A second call the same day does not create a second row.
- A wrong or missing secret returns 403 and creates nothing.
- Day 31 in a short month lands on the last day of that month.
- If the target month is locked, no row is created and the schedule still moves forward one month.

## 9. Closed months

Operations: `lockMonth`, `unlockMonth`, `monthLocks`.

- The owner locks the current month from Settings. It appears in the locked list.
- Create, edit, delete, and restore of an expense or income in that month fail, including for the owner.
- A row in another month can still be saved.
- Unlock allows changes again.
- An admin cannot lock or unlock.

## 10. Budgets

Screen: `/budgets`. Operations: `budgetBuckets`, `budgetBucket`, `budgetUsage`, `allBudgetUsages`, `createBudgetBucket`, `updateBudgetBucket`, `deleteBudgetBucket`.

- Create a monthly budget for a category at a known limit and an 80 percent alert.
- An expense in that category increases the used amount and the percent.
- The bar shows a warning near the alert and a clear over-budget state past 100 percent.
- A subcategory limit shows its own used and remaining amounts.
- Edit the limit. Delete the budget.
- A module-only user cannot open Budgets.
- The first time the percent crosses the alert, the owner receives one email. A second expense in the same period does not send a second email.

## 11. Overview

Screen: `/`. Operations 25 through 33 in [QUERIES_AND_MUTATIONS.md](QUERIES_AND_MUTATIONS.md).

- This month, last month, quarter, year to date, and all time change the totals.
- Income, expenses, and net match the rows saved in that period.
- Spending by category, who you paid most, by company, and recent activity include the new rows.
- How income was used shows linked expenses, remaining balance, and unlinked expenses.
- The navbar company filter limits every card to that company.
- A module-only user is not shown this page.
- Export CSV from the overview downloads the expense file.

## 12. Chat

Operations: `chatSession`, `sendChatMessage`, `clearChatSession`.

- A workspace user can ask a question and see the reply.
- Refreshing keeps the same session messages.
- Clear removes them.
- A module-only user cannot open chat.
- With no Groq key, the screen fails gently and does not crash the page.

## 13. Settings and payment accounts

Operations: `paymentMethods`, `paymentMethod`, `createPaymentMethod`, `updatePaymentMethod`, `deletePaymentMethod`, `myActivityLogs`, and the three export routes.

- Payment accounts sit under the profile. Add a card, edit it, and delete it.
- The new account appears in the expense form.
- Activity is at the bottom and shows the latest changes.
- Download expenses, income, and categories. Open each file and confirm the columns.
- An expenses-only user downloading expenses does not receive other companies or income rows.

## 14. Mail

Needs `RESEND_API_KEY`, `RESEND_FROM_EMAIL` on the verified domain, and the six `RESEND_TEMPLATE_*` ids.

- Welcome mail on register and on accepting an invite.
- Invite mail contains a working `/join` link.
- Password reset mail contains a working reset link.
- Budget alert mail includes the category, spent, remaining, percent, and period.
- Weekly and monthly reports attach a PDF and are not sent twice for the same period.
- `POST /internal/run-schedules` is what sends those reports. The first successful call on Monday sends the weekly report. The first successful call on the 1st sends the monthly report.

## 15. Super admin

Screen: `/admin`. Operations: `adminLogin`, `adminDashboard`, `adminApiMetrics`, `adminChatbotUsage`, `adminActivityLogs`, `adminUserDetail`, `updateUserRole`.

- The owner password does not open this screen.
- The super-admin email and password do.
- User search and role filter work.
- API metrics and chat usage load.
- Opening one user shows their organization and activity.
- Changing a role updates the user. It does not rewrite their password or delete their rows.
- `POST /api/admin/reset-database` returns 403.

## 16. Isolation and safety

Run these after the modules above, with two organizations.

- Organization A never sees organization B companies, expenses, income, budgets, categories, or invites.
- A copied expense id from A returns not found for B.
- Soft-deleted rows stay in the database and reappear with Show deleted.
- Existing users are not rewritten when the API restarts. The category seed skips when global categories already exist.
- Server tests with `MONGODB_URI` set to empty do not change the live database.
