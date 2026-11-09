import mongoose from 'mongoose';
import { Expense, Income, Company, User, BudgetBucket, BudgetAlertSent, RecurringSchedule, MonthLock, ReportDispatch, Organization } from '../models/index.js';
import { calculateBudgetUsage } from './budgetService.js';
import { sendBudgetAlertEmail, sendReportEmail } from './emailService.js';
import { buildTextPdf } from './pdfReport.js';
import { inr, nextMonthOnDay, rememberVendor } from '../utils/access.js';

function budgetPeriodKey(bucket) {
  const now = new Date();
  if (bucket.startDate && bucket.endDate) {
    return `${new Date(bucket.startDate).toISOString().slice(0, 10)}_${new Date(bucket.endDate).toISOString().slice(0, 10)}`;
  }
  if (bucket.period === 'yearly') return String(now.getUTCFullYear());
  if (bucket.period === 'quarterly') return `${now.getUTCFullYear()}-Q${Math.floor(now.getUTCMonth() / 3) + 1}`;
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

export async function notifyBudgetThresholds(orgId, categoryIds) {
  if (!categoryIds?.length) return;
  const buckets = await BudgetBucket.find({ orgId, categoryId: { $in: categoryIds } });
  const owner = await User.findOne({ orgId, role: 'owner' });
  if (!owner?.email || !buckets.length) return;

  for (const bucket of buckets) {
    const usage = await calculateBudgetUsage(bucket);
    const percent = Math.round(usage.percentUsed || 0);
    const threshold = bucket.alertThreshold || 80;
    if (percent < threshold) continue;
    const periodKey = budgetPeriodKey(bucket);
    try {
      await BudgetAlertSent.create({ orgId, bucketId: bucket._id, periodKey });
    } catch (err) {
      if (err?.code === 11000) continue;
      console.error('[Budget Alert] Could not record alert:', err.message);
      continue;
    }
    const company = await Company.findById(bucket.companyId);
    const remaining = Math.max(0, Number(bucket.limitAmount || 0) - Number(usage.usedAmount || 0));
    sendBudgetAlertEmail({
      to: owner.email,
      userName: owner.name,
      companyName: company?.name || 'Company',
      categoryName: bucket.categoryName,
      bucketName: bucket.name,
      limitAmount: bucket.limitAmount,
      currentSpend: usage.usedAmount || 0,
      percentUsed: percent,
      remainingAmount: remaining,
      threshold,
      periodLabel: periodKey,
      status: percent >= 100 ? 'Over budget' : 'Threshold reached',
    }).catch((error) => console.error('[Resend Error] Budget alert error:', error.message));
  }
}

async function monthIsLocked(orgId, date) {
  return MonthLock.exists({
    orgId,
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
  });
}

async function runRecurring() {
  const due = await RecurringSchedule.find({ active: true, nextRunAt: { $lte: new Date() } }).limit(200);
  let created = 0;
  for (const schedule of due) {
    const runDate = new Date(schedule.nextRunAt);
    const locked = await monthIsLocked(schedule.orgId, runDate);
    schedule.nextRunAt = nextMonthOnDay(runDate, schedule.dayOfMonth);
    if (locked) {
      await schedule.save();
      continue;
    }
    const payload = schedule.payload || {};
    if (schedule.kind === 'expense') {
      await Expense.create({
        orgId: schedule.orgId,
        companyId: schedule.companyId,
        date: runDate,
        categoryId: payload.categoryId,
        categoryName: payload.categoryName,
        subcategory: payload.subcategory || '',
        amount: payload.amount,
        vendor: payload.vendor || '',
        paymentMethodId: payload.paymentMethodId || null,
        paymentMethodName: payload.paymentMethodName || '',
        notes: payload.notes || '',
        createdBy: schedule.createdBy,
        isDeleted: false,
      });
      await rememberVendor({
        orgId: schedule.orgId,
        categoryId: payload.categoryId,
        subcategory: payload.subcategory,
        name: payload.vendor,
      });
      await notifyBudgetThresholds(schedule.orgId, [payload.categoryId]);
    } else {
      await Income.create({
        orgId: schedule.orgId,
        companyId: schedule.companyId,
        date: runDate,
        amount: payload.amount,
        source: payload.source,
        notes: payload.notes || '',
        createdBy: schedule.createdBy,
        isDeleted: false,
      });
    }
    await schedule.save();
    created += 1;
  }
  return created;
}

function kolkataParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).formatToParts(now);
  const read = (type) => parts.find((part) => part.type === type)?.value;
  return {
    year: Number(read('year')),
    month: Number(read('month')),
    day: Number(read('day')),
    weekday: read('weekday'),
  };
}

function utcNoon(year, month, day) {
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

async function reportForOrg({ org, owner, kind, start, end, periodKey, periodLabel }) {
  const already = await ReportDispatch.findOne({ orgId: org._id, kind, periodKey });
  if (already) return false;
  const range = { $gte: new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate())), $lte: new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate(), 23, 59, 59)) };
  const [expenses, incomes] = await Promise.all([
    Expense.find({ orgId: org._id, isDeleted: { $ne: true }, date: range }).sort({ date: -1 }).limit(40),
    Income.find({ orgId: org._id, isDeleted: { $ne: true }, date: range }).sort({ date: -1 }).limit(40),
  ]);
  const totalExpenses = expenses.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const totalIncome = incomes.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const byCategory = new Map();
  const byVendor = new Map();
  for (const row of expenses) {
    byCategory.set(row.categoryName, (byCategory.get(row.categoryName) || 0) + Number(row.amount || 0));
    if (row.vendor) byVendor.set(row.vendor, (byVendor.get(row.vendor) || 0) + Number(row.amount || 0));
  }
  const topCategory = [...byCategory.entries()].sort((a, b) => b[1] - a[1])[0];
  const topVendor = [...byVendor.entries()].sort((a, b) => b[1] - a[1])[0];
  const attachmentName = kind === 'monthly' ? `vault-monthly-${periodKey}.pdf` : `vault-weekly-${periodKey}.pdf`;
  const lines = [
    `Organization: ${org.name}`,
    `Period: ${periodLabel}`,
    `Income: ${inr(totalIncome)} (${incomes.length} rows in this file)`,
    `Expenses: ${inr(totalExpenses)} (${expenses.length} rows in this file)`,
    `Net: ${inr(totalIncome - totalExpenses)}`,
    topCategory ? `Top category: ${topCategory[0]} ${inr(topCategory[1])}` : 'Top category: none',
    topVendor ? `Top vendor: ${topVendor[0]} ${inr(topVendor[1])}` : 'Top vendor: none',
    '',
    'Expenses',
    ...expenses.slice(0, 18).map((row) => `${row.date.toISOString().slice(0, 10)}  ${row.categoryName}  ${row.vendor || '-'}  ${inr(row.amount)}`),
    '',
    'Income',
    ...incomes.slice(0, 12).map((row) => `${row.date.toISOString().slice(0, 10)}  ${row.source}  ${inr(row.amount)}`),
  ];
  const pdf = buildTextPdf({ title: kind === 'monthly' ? 'Vault monthly report' : 'Vault weekly report', lines });
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  await sendReportEmail({
    to: owner.email,
    kind,
    pdf,
    variables: {
      NAME: owner.name || 'there',
      ORG_NAME: org.name,
      PERIOD_LABEL: periodLabel,
      TOTAL_INCOME: inr(totalIncome),
      TOTAL_EXPENSES: inr(totalExpenses),
      NET: inr(totalIncome - totalExpenses),
      EXPENSE_COUNT: String(expenses.length),
      INCOME_COUNT: String(incomes.length),
      TOP_CATEGORY: topCategory ? `${topCategory[0]} · ${inr(topCategory[1])}` : 'None',
      TOP_VENDOR: topVendor ? `${topVendor[0]} · ${inr(topVendor[1])}` : 'None',
      ATTACHMENT_NAME: attachmentName,
      DASHBOARD_URL: `${clientUrl}/`,
    },
  });
  await ReportDispatch.create({ orgId: org._id, kind, periodKey });
  return true;
}

async function runReports() {
  const today = kolkataParts();
  const todayNoon = utcNoon(today.year, today.month, today.day);
  const orgs = await Organization.find({});
  let sent = 0;
  for (const org of orgs) {
    const owner = await User.findOne({ orgId: org._id, role: 'owner' });
    if (!owner?.email) continue;
    if (today.weekday === 'Mon') {
      const end = addDays(todayNoon, -1);
      const start = addDays(end, -6);
      const periodKey = start.toISOString().slice(0, 10);
      const label = `${start.toISOString().slice(0, 10)} to ${end.toISOString().slice(0, 10)}`;
      if (await reportForOrg({ org, owner, kind: 'weekly', start, end, periodKey, periodLabel: label })) sent += 1;
    }
    if (today.day === 1) {
      const end = addDays(todayNoon, -1);
      const start = utcNoon(end.getUTCFullYear(), end.getUTCMonth() + 1, 1);
      const periodKey = start.toISOString().slice(0, 7);
      const label = start.toLocaleString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
      if (await reportForOrg({ org, owner, kind: 'monthly', start, end, periodKey, periodLabel: label })) sent += 1;
    }
  }
  return sent;
}

export async function runSchedules() {
  const recurringCreated = await runRecurring();
  const reportsSent = await runReports();
  return { recurringCreated, reportsSent };
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function vendorNames(orgId, categoryId, subcategory) {
  if (!orgId || !categoryId) return [];
  if (!mongoose.Types.ObjectId.isValid(String(orgId)) || !mongoose.Types.ObjectId.isValid(String(categoryId))) return [];

  const match = {
    orgId: new mongoose.Types.ObjectId(String(orgId)),
    categoryId: new mongoose.Types.ObjectId(String(categoryId)),
    isDeleted: { $ne: true },
    vendor: { $nin: [null, ''] },
  };
  const sub = (subcategory || '').trim();
  if (sub) match.subcategory = new RegExp(`^${escapeRegex(sub)}$`, 'i');

  const rows = await Expense.aggregate([
    { $match: match },
    {
      $group: {
        _id: { $toLower: { $trim: { input: '$vendor' } } },
        name: { $first: { $trim: { input: '$vendor' } } },
        count: { $sum: 1 },
        last: { $max: '$date' },
      },
    },
    { $sort: { count: -1, last: -1 } },
    { $limit: 12 },
  ]);
  return rows.map((row) => row.name).filter(Boolean);
}
