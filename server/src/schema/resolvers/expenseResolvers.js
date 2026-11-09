import { GraphQLError } from 'graphql';
import { Expense, Income, BudgetBucket, Company, User, RecurringSchedule } from '../../models/index.js';
import { requireAuth } from '../../middleware/auth.js';
import { notifyBudgetThresholds } from '../../services/scheduleService.js';
import { logActivity } from '../../services/activityService.js';
import { applyDateBounds } from '../../utils/dateRange.js';
import { assertCompaniesInOrg } from '../../utils/tenant.js';
import { assertRead, assertWrite, assertDelete, assertMonthOpen, applyCompanyScope, rememberVendor, nextMonthOnDay } from '../../utils/access.js';

const parseDateInput = (val) => {
  if (!val) return new Date();
  if (val instanceof Date) return isNaN(val.getTime()) ? new Date() : val;
  if (typeof val === 'number') return new Date(val);
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return new Date();
    // Numeric timestamp string (e.g. milliseconds)
    if (/^\d+$/.test(trimmed) && trimmed.length > 8) {
      const d = new Date(Number(trimmed));
      if (!isNaN(d.getTime())) return d;
    }
    // YYYY-MM-DD (set to noon 12:00 UTC to prevent any timezone shift across borders)
    const ymd = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (ymd) {
      const d = new Date(Date.UTC(parseInt(ymd[1], 10), parseInt(ymd[2], 10) - 1, parseInt(ymd[3], 10), 12, 0, 0));
      if (!isNaN(d.getTime())) return d;
    }
    // DD/MM/YYYY or DD-MM-YYYY
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

export const expenseResolvers = {
  IncomeAllocation: {
    income: async (parent) => {
      if (!parent.incomeId) return null;
      return Income.findOne({ _id: parent.incomeId, isDeleted: { $ne: true } });
    },
  },

  Expense: {
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
    income: async (parent) => {
      if (!parent.incomeId) return null;
      return Income.findOne({ _id: parent.incomeId, isDeleted: { $ne: true } });
    },
    incomeIds: (parent) => {
      if (parent.incomeIds && parent.incomeIds.length > 0) {
        return parent.incomeIds.map((id) => id.toString());
      }
      return parent.incomeId ? [parent.incomeId.toString()] : [];
    },
    incomeAllocations: (parent) => {
      if (Array.isArray(parent.incomeAllocations) && parent.incomeAllocations.length > 0) {
        return parent.incomeAllocations;
      }
      if (parent.incomeId) {
        return [
          {
            incomeId: parent.incomeId,
            amount: parent.amount || 0,
            companyId: parent.companyId || null,
          },
        ];
      }
      return [];
    },
    incomes: async (parent) => {
      const ids = (parent.incomeIds && parent.incomeIds.length > 0)
        ? parent.incomeIds
        : (parent.incomeId ? [parent.incomeId] : []);
      if (ids.length === 0) return [];
      return Income.find({ _id: { $in: ids }, isDeleted: { $ne: true } });
    },
  },

  Query: {
    expenses: async (_, { filter = {}, page = 1, limit = 20 }, context) => {
      const access = await assertRead(context, 'expenses');

      const query = {
        orgId: context.orgId,
        isDeleted: filter.includeDeleted ? true : { $ne: true },
      };

      if (filter.companyId) query.companyId = filter.companyId;
      applyCompanyScope(query, access, filter.companyId);
      if (filter.categoryId) {
        query.categoryId = filter.categoryId;
      }
      if (filter.paymentMethodId) {
        query.paymentMethodId = filter.paymentMethodId;
      }
      if (filter.incomeId) {
        query.$and = [
          ...(query.$and || []),
          {
            $or: [
              { incomeId: filter.incomeId },
              { incomeIds: filter.incomeId },
              { 'incomeAllocations.incomeId': filter.incomeId },
            ],
          },
        ];
      }
      if (filter.vendor) {
        query.vendor = { $regex: filter.vendor, $options: 'i' };
      }
      applyDateBounds(query, filter.startDate, filter.endDate);
      if (filter.search) {
        const searchRegex = { $regex: filter.search, $options: 'i' };
        query.$or = [
          { vendor: searchRegex },
          { categoryName: searchRegex },
          { subcategory: searchRegex },
          { notes: searchRegex },
        ];
      }

      const safePage = Math.max(1, page);
      const safeLimit = Math.min(100, Math.max(1, limit));
      const skip = (safePage - 1) * safeLimit;

      let sortCriteria = { date: -1, createdAt: -1 };
      if (filter.sortBy === 'createdAt_desc') {
        sortCriteria = { createdAt: -1, date: -1 };
      } else if (filter.sortBy === 'date_asc') {
        sortCriteria = { date: 1, createdAt: 1 };
      } else if (filter.sortBy === 'amount_desc') {
        sortCriteria = { amount: -1, date: -1 };
      }

      const [expenses, totalCount] = await Promise.all([
        Expense.find(query).sort(sortCriteria).skip(skip).limit(safeLimit),
        Expense.countDocuments(query),
      ]);

      return {
        expenses,
        totalCount,
        page: safePage,
        totalPages: Math.ceil(totalCount / safeLimit) || 1,
      };
    },

    expense: async (_, { id }, context) => {
      requireAuth(context);
      const expense = await Expense.findOne({
        _id: id,
        orgId: context.orgId,
        isDeleted: { $ne: true },
      });

      if (!expense) {
        throw new GraphQLError('Expense not found', {
          extensions: { code: 'NOT_FOUND', http: { status: 404 } },
        });
      }
      return expense;
    },

    expensesByIncome: async (_, { incomeId }, context) => {
      const access = await assertRead(context, 'expenses');
      const query = {
        orgId: context.orgId,
        $or: [{ incomeId }, { incomeIds: incomeId }],
        isDeleted: { $ne: true },
      };
      applyCompanyScope(query, access);
      return Expense.find(query).sort({ date: -1, createdAt: -1 });
    },
  },

  Mutation: {
    createExpenses: async (_, { inputs }, context) => {
      await assertWrite(context, 'expenses');

      if (!inputs || !Array.isArray(inputs) || inputs.length === 0) {
        throw new GraphQLError('At least one expense must be provided.', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      await assertCompaniesInOrg(inputs.map((input) => input.companyId), context.orgId);
      for (const input of inputs) {
        await assertWrite(context, 'expenses', input.companyId);
        await assertMonthOpen(context.orgId, parseDateInput(input.date));
      }

      // Validate all provided incomeIds strictly against orgId and companyId
      const incomeIdsToValidate = [
        ...new Set(
          inputs.flatMap((i) => [
            i.incomeId,
            ...(Array.isArray(i.incomeIds) ? i.incomeIds : []),
            ...(Array.isArray(i.incomeAllocations) ? i.incomeAllocations.map((a) => a.incomeId) : []),
          ]).filter(Boolean)
        ),
      ];
      if (incomeIdsToValidate.length > 0) {
        const validIncomes = await Income.find({
          _id: { $in: incomeIdsToValidate },
          orgId: context.orgId,
          isDeleted: { $ne: true },
        }).select('_id companyId');

        const incomeMap = new Map(
          validIncomes.map((inc) => [inc._id.toString(), inc.companyId.toString()])
        );

        for (const input of inputs) {
          const allIds = [
            input.incomeId,
            ...(Array.isArray(input.incomeIds) ? input.incomeIds : []),
            ...(Array.isArray(input.incomeAllocations) ? input.incomeAllocations.map((a) => a.incomeId) : []),
          ].filter(Boolean);

          // Cross-entity / cross-company income linking is supported within the organization.
          // Validate that all referenced income entries exist within the current organization.
          for (const incId of allIds) {
            const targetCompId = incomeMap.get(incId.toString());
            if (!targetCompId) {
              throw new GraphQLError(
                'Invalid income entry. The income entry does not exist or belongs to another organization.',
                { extensions: { code: 'BAD_USER_INPUT' } }
              );
            }
          }
        }
      }

      const validIncomesList = incomeIdsToValidate.length > 0
        ? await Income.find({
            _id: { $in: incomeIdsToValidate },
            orgId: context.orgId,
            isDeleted: { $ne: true },
          }).select('_id companyId')
        : [];
      const incomeMap = new Map(validIncomesList.map((inc) => [inc._id.toString(), inc.companyId.toString()]));

      const documents = inputs.map((input) => {
        if (!input.companyId || !input.categoryId || input.amount === undefined) {
          throw new GraphQLError('companyId, categoryId, and amount are required for each expense.', {
            extensions: { code: 'BAD_USER_INPUT' },
          });
        }

        const expAmount = Math.max(0, Number(input.amount));
        let normalizedAllocations = [];
        let allIncomeIds = [];
        let primaryIncomeId = null;

        if (input.incomeAllocations && Array.isArray(input.incomeAllocations) && input.incomeAllocations.length > 0) {
          const totalAllocated = input.incomeAllocations.reduce(
            (sum, a) => sum + Math.max(0, Number(a.amount || 0)),
            0
          );
          if (Math.abs(totalAllocated - expAmount) > 0.05) {
            throw new GraphQLError(
              `The sum of income allocations (₹${totalAllocated.toLocaleString('en-IN')}) must equal the total expense amount (₹${expAmount.toLocaleString('en-IN')}).`,
              { extensions: { code: 'BAD_USER_INPUT' } }
            );
          }

          normalizedAllocations = input.incomeAllocations.map((a) => ({
            incomeId: a.incomeId,
            amount: Math.max(0, Number(a.amount || 0)),
            companyId: incomeMap.get(a.incomeId.toString()) || a.companyId || null,
          }));
          allIncomeIds = normalizedAllocations.map((a) => a.incomeId);
          primaryIncomeId = allIncomeIds[0] || null;
        } else {
          primaryIncomeId =
            input.incomeId ||
            (Array.isArray(input.incomeIds) && input.incomeIds.length > 0
              ? input.incomeIds[0]
              : null) ||
            null;
          allIncomeIds = Array.isArray(input.incomeIds) && input.incomeIds.length > 0
            ? input.incomeIds
            : primaryIncomeId
            ? [primaryIncomeId]
            : [];

          if (allIncomeIds.length === 1) {
            normalizedAllocations = [
              {
                incomeId: allIncomeIds[0],
                amount: expAmount,
                companyId: incomeMap.get(allIncomeIds[0].toString()) || input.companyId || null,
              },
            ];
          } else if (allIncomeIds.length > 1) {
            const perItem = Number((expAmount / allIncomeIds.length).toFixed(2));
            let runningSum = 0;
            normalizedAllocations = allIncomeIds.map((id, idx) => {
              const isLast = idx === allIncomeIds.length - 1;
              const allocAmount = isLast
                ? Math.max(0, Number((expAmount - runningSum).toFixed(2)))
                : perItem;
              runningSum += allocAmount;
              return {
                incomeId: id,
                amount: allocAmount,
                companyId: incomeMap.get(id.toString()) || input.companyId || null,
              };
            });
          }
        }

        return {
          orgId: context.orgId,
          companyId: input.companyId,
          date: parseDateInput(input.date),
          categoryId: input.categoryId,
          categoryName: input.categoryName || '',
          subcategory: input.subcategory || '',
          amount: expAmount,
          vendor: input.vendor || '',
          paymentMethodId: input.paymentMethodId || null,
          paymentMethodName: input.paymentMethodName || '',
          notes: input.notes || '',
          budgetBucketId: input.budgetBucketId || null,
          incomeId: primaryIncomeId,
          incomeIds: allIncomeIds,
          incomeAllocations: normalizedAllocations,
          createdBy: context.userId,
          isDeleted: false,
        };
      });

      const createdExpenses = await Expense.insertMany(documents);

      logActivity({
        orgId: context.orgId,
        userId: context.userId,
        action: 'CREATE_EXPENSE',
        entityType: 'Expense',
        description: `Logged ${createdExpenses.length} expense transaction${createdExpenses.length > 1 ? 's' : ''}`,
        metadata: { count: createdExpenses.length },
      });

      for (const expense of createdExpenses) {
        await rememberVendor({
          orgId: context.orgId,
          categoryId: expense.categoryId,
          subcategory: expense.subcategory,
          name: expense.vendor,
        });
      }

      if (inputs.length === 1 && inputs[0].makeRecurring && createdExpenses[0]) {
        const first = createdExpenses[0];
        const runDate = first.date instanceof Date ? first.date : new Date(first.date);
        await RecurringSchedule.create({
          orgId: context.orgId,
          companyId: first.companyId,
          createdBy: context.userId,
          kind: 'expense',
          dayOfMonth: runDate.getUTCDate(),
          nextRunAt: nextMonthOnDay(runDate, runDate.getUTCDate()),
          payload: {
            categoryId: first.categoryId,
            categoryName: first.categoryName,
            subcategory: first.subcategory,
            amount: first.amount,
            vendor: first.vendor,
            paymentMethodId: first.paymentMethodId,
            paymentMethodName: first.paymentMethodName,
            notes: first.notes,
          },
        });
      }

      notifyBudgetThresholds(context.orgId, [...new Set(documents.map((row) => row.categoryId))]).catch((alertErr) =>
        console.error('[Budget Alert Check Error]:', alertErr.message)
      );

      return createdExpenses;
    },

    updateExpense: async (_, { id, input }, context) => {
      const existingExpense = await Expense.findOne({
        _id: id,
        orgId: context.orgId,
        isDeleted: { $ne: true },
      });

      if (!existingExpense) {
        throw new GraphQLError('Expense not found', {
          extensions: { code: 'NOT_FOUND', http: { status: 404 } },
        });
      }
      await assertWrite(context, 'expenses', existingExpense.companyId);
      await assertMonthOpen(context.orgId, input.date ? parseDateInput(input.date) : existingExpense.date);

      if (input.companyId) {
        await assertCompaniesInOrg([input.companyId], context.orgId);
      }

      const updateData = { ...input, updatedBy: context.userId };
      delete updateData.makeRecurring;
      if (input.date) updateData.date = parseDateInput(input.date);
      if (input.amount !== undefined) updateData.amount = Math.max(0, Number(input.amount));

      const targetAmount = input.amount !== undefined ? Math.max(0, Number(input.amount)) : existingExpense.amount;

      // Validate and sync incomeId, incomeIds & incomeAllocations
      if (input.incomeAllocations !== undefined) {
        const allocs = Array.isArray(input.incomeAllocations)
          ? input.incomeAllocations.filter((a) => a && a.incomeId)
          : [];
        if (allocs.length > 0) {
          const ids = allocs.map((a) => a.incomeId);
          const validIncomes = await Income.find({
            _id: { $in: ids },
            orgId: context.orgId,
            isDeleted: { $ne: true },
          }).select('_id companyId');

          if (validIncomes.length !== ids.length) {
            throw new GraphQLError(
              'Invalid income entry. One or more selected incomes do not exist or belong to another organization.',
              { extensions: { code: 'BAD_USER_INPUT' } }
            );
          }

          const incCompMap = new Map(validIncomes.map((inc) => [inc._id.toString(), inc.companyId.toString()]));

          const totalAllocated = allocs.reduce(
            (sum, a) => sum + Math.max(0, Number(a.amount || 0)),
            0
          );
          if (Math.abs(totalAllocated - targetAmount) > 0.05) {
            throw new GraphQLError(
              `The sum of income allocations (₹${totalAllocated.toLocaleString('en-IN')}) must equal the total expense amount (₹${targetAmount.toLocaleString('en-IN')}).`,
              { extensions: { code: 'BAD_USER_INPUT' } }
            );
          }

          updateData.incomeAllocations = allocs.map((a) => ({
            incomeId: a.incomeId,
            amount: Math.max(0, Number(a.amount || 0)),
            companyId: incCompMap.get(a.incomeId.toString()) || a.companyId || null,
          }));
          updateData.incomeIds = ids;
          updateData.incomeId = ids[0];
        } else {
          updateData.incomeAllocations = [];
          updateData.incomeIds = [];
          updateData.incomeId = null;
        }
      } else if (input.incomeIds !== undefined) {
        const ids = Array.isArray(input.incomeIds) ? input.incomeIds.filter(Boolean) : [];
        if (ids.length > 0) {
          const validIncomes = await Income.find({
            _id: { $in: ids },
            orgId: context.orgId,
            isDeleted: { $ne: true },
          }).select('_id companyId');

          if (validIncomes.length !== ids.length) {
            throw new GraphQLError(
              'Invalid income entry. One or more selected incomes do not exist or belong to another organization.',
              { extensions: { code: 'BAD_USER_INPUT' } }
            );
          }

          const perItem = Number((targetAmount / ids.length).toFixed(2));
          let runningSum = 0;
          updateData.incomeAllocations = ids.map((id, idx) => {
            const isLast = idx === ids.length - 1;
            const allocAmount = isLast
              ? Math.max(0, Number((targetAmount - runningSum).toFixed(2)))
              : perItem;
            runningSum += allocAmount;
            return {
              incomeId: id,
              amount: allocAmount,
              companyId: validIncomes.find((i) => i._id.toString() === id.toString())?.companyId || null,
            };
          });
          updateData.incomeIds = ids;
          updateData.incomeId = input.incomeId || ids[0] || null;
        } else {
          updateData.incomeAllocations = [];
          updateData.incomeIds = [];
          updateData.incomeId = null;
        }
      } else if (input.incomeId !== undefined) {
        if (input.incomeId) {
          const validIncome = await Income.findOne({
            _id: input.incomeId,
            orgId: context.orgId,
            isDeleted: { $ne: true },
          });

          if (!validIncome) {
            throw new GraphQLError(
              'Invalid income entry. The income entry does not exist or belongs to another organization.',
              { extensions: { code: 'BAD_USER_INPUT' } }
            );
          }
          updateData.incomeId = input.incomeId;
          updateData.incomeIds = [input.incomeId];
          updateData.incomeAllocations = [
            {
              incomeId: input.incomeId,
              amount: targetAmount,
              companyId: validIncome.companyId,
            },
          ];
        } else {
          updateData.incomeId = null;
          updateData.incomeIds = [];
          updateData.incomeAllocations = [];
        }
      } else if (input.amount !== undefined && existingExpense.incomeId) {
        if (existingExpense.incomeAllocations && existingExpense.incomeAllocations.length === 1) {
          updateData.incomeAllocations = [
            {
              incomeId: existingExpense.incomeAllocations[0].incomeId,
              amount: targetAmount,
              companyId: existingExpense.incomeAllocations[0].companyId,
            },
          ];
        }
      }

      const expense = await Expense.findOneAndUpdate(
        { _id: id, orgId: context.orgId, isDeleted: { $ne: true } },
        { $set: updateData },
        { new: true }
      );

      if (expense) {
        await rememberVendor({
          orgId: context.orgId,
          categoryId: expense.categoryId,
          subcategory: expense.subcategory,
          name: expense.vendor,
        });
      }

      return expense;
    },

    deleteExpense: async (_, { id }, context) => {
      const existing = await Expense.findOne({ _id: id, orgId: context.orgId, isDeleted: { $ne: true } });
      if (!existing) return false;
      await assertDelete(context, 'expenses', existing.companyId);
      await assertMonthOpen(context.orgId, existing.date);
      existing.isDeleted = true;
      existing.updatedBy = context.userId;
      await existing.save();
      logActivity({
        orgId: context.orgId,
        userId: context.userId,
        action: 'DELETE_EXPENSE',
        entityType: 'Expense',
        entityId: existing._id,
        companyId: existing.companyId,
        description: `Deleted expense of ₹${Number(existing.amount || 0).toLocaleString()} (${existing.categoryName})`,
      });
      return true;
    },

    restoreExpense: async (_, { id }, context) => {
      const existing = await Expense.findOne({ _id: id, orgId: context.orgId, isDeleted: true });
      if (!existing) return false;
      await assertWrite(context, 'expenses', existing.companyId);
      await assertMonthOpen(context.orgId, existing.date);
      existing.isDeleted = false;
      existing.updatedBy = context.userId;
      await existing.save();
      logActivity({
        orgId: context.orgId,
        userId: context.userId,
        action: 'RESTORE_EXPENSE',
        entityType: 'Expense',
        entityId: existing._id,
        companyId: existing.companyId,
        description: `Restored expense of ₹${Number(existing.amount || 0).toLocaleString()} (${existing.categoryName})`,
      });
      return true;
    },
  },
};

export default expenseResolvers;
