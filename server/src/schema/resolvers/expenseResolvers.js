import { GraphQLError } from 'graphql';
import { Expense, Income, BudgetBucket, Company, User } from '../../models/index.js';
import { requireAuth } from '../../middleware/auth.js';
import { sendBudgetAlertEmail } from '../../services/emailService.js';

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
      requireAuth(context);

      const query = {
        orgId: context.orgId,
        isDeleted: { $ne: true },
      };

      if (filter.companyId) {
        query.companyId = filter.companyId;
      }
      if (filter.categoryId) {
        query.categoryId = filter.categoryId;
      }
      if (filter.paymentMethodId) {
        query.paymentMethodId = filter.paymentMethodId;
      }
      if (filter.incomeId) {
        query.incomeId = filter.incomeId;
      }
      if (filter.vendor) {
        query.vendor = { $regex: filter.vendor, $options: 'i' };
      }
      if (filter.startDate || filter.endDate) {
        query.date = {};
        if (filter.startDate) query.date.$gte = new Date(filter.startDate);
        if (filter.endDate) query.date.$lte = new Date(filter.endDate);
      }
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
      requireAuth(context);
      return Expense.find({
        orgId: context.orgId,
        $or: [{ incomeId }, { incomeIds: incomeId }],
        isDeleted: { $ne: true },
      }).sort({ date: -1, createdAt: -1 });
    },
  },

  Mutation: {
    createExpenses: async (_, { inputs }, context) => {
      requireAuth(context);

      if (!inputs || !Array.isArray(inputs) || inputs.length === 0) {
        throw new GraphQLError('At least one expense must be provided.', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
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

          const hasMultiIncomes = allIds.length > 1;

          if (!hasMultiIncomes && input.incomeId && (!input.incomeIds || input.incomeIds.length <= 1) && (!input.incomeAllocations || input.incomeAllocations.length <= 1)) {
            // Standard single-income linking: ensure it matches the selected company (Phase 5 Step 4a)
            const targetCompId = incomeMap.get(input.incomeId.toString());
            if (!targetCompId || targetCompId !== input.companyId.toString()) {
              throw new GraphQLError(
                'Invalid income entry for this company. The income entry does not exist or belongs to another entity.',
                { extensions: { code: 'BAD_USER_INPUT' } }
              );
            }
          } else {
            // Multi-income linking across multiple companies: ensure all selected incomes exist within this organization!
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

      // Asynchronously evaluate budget limits and dispatch Resend email alerts
      (async () => {
        try {
          const catIds = [...new Set(documents.map((d) => d.categoryId))];
          const buckets = await BudgetBucket.find({
            orgId: context.orgId,
            categoryId: { $in: catIds },
          });

          if (buckets.length > 0) {
            const user = await User.findById(context.userId);
            if (user?.email) {
              for (const bucket of buckets) {
                const totalSpentAgg = await Expense.aggregate([
                  {
                    $match: {
                      orgId: bucket.orgId,
                      companyId: bucket.companyId,
                      categoryId: bucket.categoryId,
                      isDeleted: { $ne: true },
                    },
                  },
                  { $group: { _id: null, total: { $sum: '$amount' } } },
                ]);
                const totalSpent = totalSpentAgg[0]?.total || 0;
                const percent = Math.round((totalSpent / bucket.limitAmount) * 100);
                const threshold = bucket.alertThreshold || 80;

                if (percent >= threshold) {
                  const comp = await Company.findById(bucket.companyId);
                  sendBudgetAlertEmail({
                    to: user.email,
                    userName: user.name,
                    companyName: comp?.name || 'Company',
                    categoryName: bucket.categoryName,
                    limitAmount: bucket.limitAmount,
                    currentSpend: totalSpent,
                    percentUsed: percent,
                  }).catch((e) => console.error('[Resend Error] Budget alert error:', e.message));
                }
              }
            }
          }
        } catch (alertErr) {
          console.error('[Budget Alert Check Error]:', alertErr.message);
        }
      })();

      return createdExpenses;
    },

    updateExpense: async (_, { id, input }, context) => {
      requireAuth(context);

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

      const updateData = { ...input, updatedBy: context.userId };
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

          if (ids.length === 1) {
            const targetCompanyId = input.companyId || existingExpense.companyId;
            if (validIncomes[0].companyId.toString() !== targetCompanyId.toString()) {
              throw new GraphQLError(
                'Invalid income entry for this company. The income entry does not exist or belongs to another entity.',
                { extensions: { code: 'BAD_USER_INPUT' } }
              );
            }
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

          if (ids.length === 1) {
            const targetCompanyId = input.companyId || existingExpense.companyId;
            if (validIncomes[0].companyId.toString() !== targetCompanyId.toString()) {
              throw new GraphQLError(
                'Invalid income entry for this company. The income entry does not exist or belongs to another entity.',
                { extensions: { code: 'BAD_USER_INPUT' } }
              );
            }
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
          const targetCompanyId = input.companyId || existingExpense.companyId;
          const validIncome = await Income.findOne({
            _id: input.incomeId,
            orgId: context.orgId,
            companyId: targetCompanyId,
            isDeleted: { $ne: true },
          });

          if (!validIncome) {
            throw new GraphQLError(
              'Invalid income entry for this company. The income entry does not exist or belongs to another entity.',
              { extensions: { code: 'BAD_USER_INPUT' } }
            );
          }
          updateData.incomeId = input.incomeId;
          updateData.incomeIds = [input.incomeId];
          updateData.incomeAllocations = [
            {
              incomeId: input.incomeId,
              amount: targetAmount,
              companyId: targetCompanyId,
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

      return expense;
    },

    deleteExpense: async (_, { id }, context) => {
      requireAuth(context);

      const expense = await Expense.findOneAndUpdate(
        { _id: id, orgId: context.orgId, isDeleted: { $ne: true } },
        { $set: { isDeleted: true, updatedBy: context.userId } }
      );

      return !!expense;
    },
  },
};

export default expenseResolvers;
