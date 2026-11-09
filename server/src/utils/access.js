import { GraphQLError } from 'graphql';
import { User } from '../models/User.js';
import { MonthLock } from '../models/MonthLock.js';
import { VendorMemory } from '../models/VendorMemory.js';

const forbid = (message) => {
  throw new GraphQLError(message || 'You do not have permission to change these records.', {
    extensions: { code: 'FORBIDDEN', http: { status: 403 } },
  });
};

export async function loadActor(context) {
  if (!context?.userId) {
    throw new GraphQLError('Authentication required. Please provide a valid Bearer token.', {
      extensions: { code: 'UNAUTHENTICATED', http: { status: 401 } },
    });
  }
  if (context._actor) return context._actor;
  const user = await User.findById(context.userId);
  if (!user) forbid('User not found');
  context._actor = user;
  return user;
}

export function accessOf(user) {
  const role = (user?.role || '').toLowerCase();
  const owner = role === 'owner' || role === 'superadmin';
  const legacyStaff = !user?.accessScope && (role === 'admin' || owner);
  const scoped = user?.accessScope === 'modules' ? 'modules' : 'workspace';
  const scope = owner || legacyStaff || !user?.accessScope ? 'workspace' : scoped;
  const modules = scope === 'modules' ? user.modules || [] : ['expenses', 'income'];
  const companyIds = !user?.accessScope || owner ? [] : (user.companyIds || []).map((id) => id.toString());
  const canWrite = owner || legacyStaff || !!user?.accessScope;
  const canDeleteExpenses = owner || legacyStaff || !!user?.canDeleteExpenses;
  const canDeleteIncome = owner || legacyStaff || !!user?.canDeleteIncome;
  return { role, owner, scope, modules, companyIds, canWrite, canDeleteExpenses, canDeleteIncome };
}

export function allowsModule(access, moduleName) {
  if (access.scope === 'workspace') return true;
  if (moduleName === 'expenses' || moduleName === 'income') return access.modules.includes(moduleName);
  return false;
}

export function companyAllowed(access, companyId) {
  if (!access.companyIds.length) return true;
  if (!companyId) return false;
  return access.companyIds.includes(String(companyId));
}

export function applyCompanyScope(query, access, requestedId) {
  if (requestedId) {
    if (!companyAllowed(access, requestedId)) query.companyId = { $in: [] };
    return;
  }
  if (access.companyIds.length) query.companyId = { $in: access.companyIds };
}

export async function assertRead(context, moduleName) {
  const access = accessOf(await loadActor(context));
  if (!allowsModule(access, moduleName)) forbid('This area is not included in your access.');
  return access;
}

export async function assertWorkspace(context) {
  const access = accessOf(await loadActor(context));
  if (access.scope !== 'workspace') forbid('This area is not included in your access.');
  return access;
}

export async function assertWrite(context, moduleName, companyId) {
  const access = accessOf(await loadActor(context));
  if (!access.canWrite || !allowsModule(access, moduleName)) forbid();
  if (companyId && !companyAllowed(access, companyId)) forbid('That company is outside your access.');
  return access;
}

export async function assertDelete(context, kind, companyId) {
  const access = accessOf(await loadActor(context));
  const moduleName = kind === 'income' ? 'income' : 'expenses';
  if (!allowsModule(access, moduleName) || (companyId && !companyAllowed(access, companyId))) forbid();
  const allowed = kind === 'income' ? access.canDeleteIncome : access.canDeleteExpenses;
  if (!allowed) forbid('You do not have permission to delete these records.');
  return access;
}

export async function assertMonthOpen(orgId, date) {
  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) return;
  const year = value.getUTCFullYear();
  const month = value.getUTCMonth() + 1;
  const lock = await MonthLock.findOne({ orgId, year, month });
  if (lock) {
    throw new GraphQLError(`${year}-${String(month).padStart(2, '0')} is locked. Unlock the month before changing it.`, {
      extensions: { code: 'FORBIDDEN', http: { status: 403 } },
    });
  }
}

export async function rememberVendor({ orgId, categoryId, subcategory, name }) {
  const vendor = (name || '').trim();
  if (!orgId || !categoryId || !vendor) return;
  await VendorMemory.updateOne(
    { orgId, categoryId, subcategory: (subcategory || '').trim(), name: vendor },
    { $inc: { useCount: 1 }, $set: { lastUsedAt: new Date() } },
    { upsert: true }
  );
}

export function inr(amount) {
  return `₹${Number(amount || 0).toLocaleString('en-IN')}`;
}

export function nextMonthOnDay(fromDate, dayOfMonth) {
  const base = fromDate instanceof Date ? fromDate : new Date(fromDate);
  const cursor = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 1, 12, 0, 0));
  const lastDay = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0)).getUTCDate();
  const day = Math.min(dayOfMonth, lastDay);
  return new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), day, 12, 0, 0));
}
