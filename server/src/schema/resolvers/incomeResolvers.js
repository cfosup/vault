import { GraphQLError } from 'graphql';
import { Income, RecurringSchedule } from '../../models/index.js';
import { requireAuth } from '../../middleware/auth.js';
import { logActivity } from '../../services/activityService.js';
import { applyDateBounds, sumAmount } from '../../utils/dateRange.js';
import { assertCompaniesInOrg } from '../../utils/tenant.js';
import { assertRead, assertWrite, assertDelete, assertMonthOpen, applyCompanyScope, nextMonthOnDay } from '../../utils/access.js';

const parseDateInput = (val) => {
  if (!val) return new Date();
  if (val instanceof Date) return isNaN(val.getTime()) ? new Date() : val;
  if (typeof val === 'number') return new Date(val);
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return new Date();
    if (/^\d+$/.test(trimmed) && trimmed.length > 8) {
      const d = new Date(Number(trimmed));
      if (!isNaN(d.getTime())) return d;
    }
    const ymd = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (ymd) {
      const d = new Date(Date.UTC(parseInt(ymd[1], 10), parseInt(ymd[2], 10) - 1, parseInt(ymd[3], 10), 12, 0, 0));
      if (!isNaN(d.getTime())) return d;
    }
    const dmy = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (dmy) {
      const d = new Date(Date.UTC(parseInt(dmy[3], 10), parseInt(dmy[2], 10) - 1, parseInt(dmy[1], 10), 12, 0, 0));
      if (!isNaN(d.getTime())) return d;
    }
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) return d;
  }
  return new Date();
};

export const incomeResolvers = {
  Income: {
    date: (parent) => {
      if (!parent.date) return new Date().toISOString();
      if (parent.date instanceof Date) {
        return isNaN(parent.date.getTime()) ? new Date().toISOString() : parent.date.toISOString();
      }
      if (typeof parent.date === 'number' || /^\d+$/.test(String(parent.date).trim())) {
        const d = new Date(Number(parent.date));
        if (!isNaN(d.getTime())) return d.toISOString();
      }
      const d = new Date(parent.date);
      if (!isNaN(d.getTime())) return d.toISOString();
      return new Date().toISOString();
    },
  },
  Query: {
    incomes: async (_, { filter = {}, page = 1, limit = 20 }, context) => {
      const access = await assertRead(context, 'income');

      const query = {
        orgId: context.orgId,
        isDeleted: filter.includeDeleted ? true : { $ne: true },
      };

      if (filter.companyId) query.companyId = filter.companyId;
      applyCompanyScope(query, access, filter.companyId);
      applyDateBounds(query, filter.startDate, filter.endDate);
      if (filter.search) {
        const searchRegex = { $regex: filter.search, $options: 'i' };
        query.$or = [{ source: searchRegex }, { notes: searchRegex }];
      }

      const safePage = Math.max(1, page);
      const safeLimit = Math.min(100, Math.max(1, limit));
      const skip = (safePage - 1) * safeLimit;

      const [incomes, totalCount, totalAmount] = await Promise.all([
        Income.find(query).sort({ date: -1, createdAt: -1 }).skip(skip).limit(safeLimit),
        Income.countDocuments(query),
        sumAmount(Income, query),
      ]);

      return {
        incomes,
        totalCount,
        totalAmount,
        page: safePage,
        totalPages: Math.ceil(totalCount / safeLimit) || 1,
      };
    },

    income: async (_, { id }, context) => {
      requireAuth(context);
      const income = await Income.findOne({
        _id: id,
        orgId: context.orgId,
        isDeleted: { $ne: true },
      });

      if (!income) {
        throw new GraphQLError('Income not found', {
          extensions: { code: 'NOT_FOUND', http: { status: 404 } },
        });
      }
      return income;
    },
  },

  Mutation: {
    createIncomes: async (_, { inputs }, context) => {
      await assertWrite(context, 'income');

      if (!inputs || !Array.isArray(inputs) || inputs.length === 0) {
        throw new GraphQLError('At least one income must be provided.', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      await assertCompaniesInOrg(inputs.map((input) => input.companyId), context.orgId);
      for (const input of inputs) {
        await assertWrite(context, 'income', input.companyId);
        await assertMonthOpen(context.orgId, parseDateInput(input.date));
      }

      const documents = inputs.map((input) => {
        if (!input.companyId || !input.source || input.amount === undefined) {
          throw new GraphQLError('companyId, source, and amount are required for each income entry.', {
            extensions: { code: 'BAD_USER_INPUT' },
          });
        }

        return {
          orgId: context.orgId,
          companyId: input.companyId,
          date: parseDateInput(input.date),
          amount: Math.max(0, Number(input.amount)),
          source: input.source.trim(),
          notes: input.notes || '',
          createdBy: context.userId,
          isDeleted: false,
        };
      });

      const createdIncomes = await Income.insertMany(documents);

      logActivity({
        orgId: context.orgId,
        userId: context.userId,
        action: 'CREATE_INCOME',
        entityType: 'Income',
        description: `Logged ${createdIncomes.length} income receipt${createdIncomes.length > 1 ? 's' : ''}`,
        metadata: { count: createdIncomes.length },
      });

      if (inputs.length === 1 && inputs[0].makeRecurring && createdIncomes[0]) {
        const first = createdIncomes[0];
        const runDate = first.date instanceof Date ? first.date : new Date(first.date);
        await RecurringSchedule.create({
          orgId: context.orgId,
          companyId: first.companyId,
          createdBy: context.userId,
          kind: 'income',
          dayOfMonth: runDate.getUTCDate(),
          nextRunAt: nextMonthOnDay(runDate, runDate.getUTCDate()),
          payload: { amount: first.amount, source: first.source, notes: first.notes },
        });
      }

      return createdIncomes;
    },

    updateIncome: async (_, { id, input }, context) => {
      const current = await Income.findOne({ _id: id, orgId: context.orgId, isDeleted: { $ne: true } });
      if (!current) {
        throw new GraphQLError('Income not found', { extensions: { code: 'NOT_FOUND' } });
      }
      await assertWrite(context, 'income', input.companyId || current.companyId);
      await assertMonthOpen(context.orgId, input.date ? parseDateInput(input.date) : current.date);

      if (input.companyId) {
        await assertCompaniesInOrg([input.companyId], context.orgId);
      }

      const updateData = {};
      if (input.companyId) updateData.companyId = input.companyId;
      if (input.date) updateData.date = parseDateInput(input.date);
      if (input.amount !== undefined) updateData.amount = Math.max(0, Number(input.amount));
      if (input.source) updateData.source = input.source.trim();
      if (input.notes !== undefined) updateData.notes = input.notes.trim();

      const income = await Income.findOneAndUpdate(
        { _id: id, orgId: context.orgId, isDeleted: { $ne: true } },
        { $set: updateData },
        { new: true }
      );

      if (!income) {
        throw new GraphQLError('Income not found', {
          extensions: { code: 'NOT_FOUND', http: { status: 404 } },
        });
      }

      return income;
    },

    deleteIncome: async (_, { id }, context) => {
      const current = await Income.findOne({ _id: id, orgId: context.orgId, isDeleted: { $ne: true } });
      if (!current) return false;
      await assertDelete(context, 'income', current.companyId);
      await assertMonthOpen(context.orgId, current.date);
      current.isDeleted = true;
      await current.save();
      logActivity({
        orgId: context.orgId,
        userId: context.userId,
        action: 'DELETE_INCOME',
        entityType: 'Income',
        entityId: current._id,
        companyId: current.companyId,
        description: `Deleted income receipt of ₹${Number(current.amount || 0).toLocaleString()} (${current.source})`,
      });
      return true;
    },

    restoreIncome: async (_, { id }, context) => {
      const current = await Income.findOne({ _id: id, orgId: context.orgId, isDeleted: true });
      if (!current) return false;
      await assertWrite(context, 'income', current.companyId);
      await assertMonthOpen(context.orgId, current.date);
      current.isDeleted = false;
      await current.save();
      logActivity({
        orgId: context.orgId,
        userId: context.userId,
        action: 'RESTORE_INCOME',
        entityType: 'Income',
        entityId: current._id,
        companyId: current.companyId,
        description: `Restored income receipt of ₹${Number(current.amount || 0).toLocaleString()} (${current.source})`,
      });
      return true;
    },
  },
};

export default incomeResolvers;
