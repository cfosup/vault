import { GraphQLError } from 'graphql';
import { BudgetBucket, Category } from '../../models/index.js';
import { calculateBudgetUsage } from '../../services/budgetService.js';
import { requireAuth } from '../../middleware/auth.js';

export const budgetResolvers = {
  Query: {
    budgetBuckets: async (_, { companyId }, context) => {
      requireAuth(context);
      const query = { orgId: context.orgId };
      if (companyId) query.companyId = companyId;
      return BudgetBucket.find(query).sort({ createdAt: -1 });
    },

    budgetBucket: async (_, { id }, context) => {
      requireAuth(context);
      const bucket = await BudgetBucket.findOne({ _id: id, orgId: context.orgId });
      if (!bucket) {
        throw new GraphQLError('Budget bucket not found', {
          extensions: { code: 'NOT_FOUND', http: { status: 404 } },
        });
      }
      return bucket;
    },

    budgetUsage: async (_, { bucketId }, context) => {
      requireAuth(context);
      const bucket = await BudgetBucket.findOne({ _id: bucketId, orgId: context.orgId });
      if (!bucket) {
        throw new GraphQLError('Budget bucket not found', {
          extensions: { code: 'NOT_FOUND', http: { status: 404 } },
        });
      }
      return calculateBudgetUsage(bucket);
    },

    allBudgetUsages: async (_, { companyId }, context) => {
      requireAuth(context);
      const query = { orgId: context.orgId };
      if (companyId) query.companyId = companyId;

      const buckets = await BudgetBucket.find(query);
      return Promise.all(buckets.map((b) => calculateBudgetUsage(b)));
    },
  },

  Mutation: {
    createBudgetBucket: async (_, { input }, context) => {
      requireAuth(context);
      const { companyId, categoryId, name, limitAmount, period, startDate, endDate, alertThreshold } = input;

      if (!companyId || !categoryId || !name || limitAmount === undefined) {
        throw new GraphQLError('companyId, categoryId, name, and limitAmount are required.', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      let categoryName = input.categoryName;
      if (!categoryName) {
        const cat = await Category.findById(categoryId);
        categoryName = cat?.name || 'Uncategorized';
      }

      return BudgetBucket.create({
        orgId: context.orgId,
        companyId,
        categoryId,
        categoryName,
        name: name.trim(),
        limitAmount: Math.max(0, Number(limitAmount)),
        period: period || 'monthly',
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        alertThreshold: alertThreshold !== undefined ? Number(alertThreshold) : 80,
        subcatBudgets: (input.subcatBudgets || []).map((s) => ({
          subcategory: s.subcategory.trim(),
          limitAmount: Math.max(0, Number(s.limitAmount)),
        })),
        createdBy: context.userId,
      });
    },

    updateBudgetBucket: async (_, { id, input }, context) => {
      requireAuth(context);
      const updateData = { ...input };
      if (input.limitAmount !== undefined) updateData.limitAmount = Math.max(0, Number(input.limitAmount));
      if (input.startDate) updateData.startDate = new Date(input.startDate);
      if (input.endDate) updateData.endDate = new Date(input.endDate);
      if (input.subcatBudgets) {
        updateData.subcatBudgets = input.subcatBudgets.map((s) => ({
          subcategory: s.subcategory.trim(),
          limitAmount: Math.max(0, Number(s.limitAmount)),
        }));
      }

      const bucket = await BudgetBucket.findOneAndUpdate(
        { _id: id, orgId: context.orgId },
        { $set: updateData },
        { new: true }
      );

      if (!bucket) {
        throw new GraphQLError('Budget bucket not found', {
          extensions: { code: 'NOT_FOUND', http: { status: 404 } },
        });
      }

      return bucket;
    },

    deleteBudgetBucket: async (_, { id }, context) => {
      requireAuth(context);
      const result = await BudgetBucket.findOneAndDelete({ _id: id, orgId: context.orgId });
      return !!result;
    },
  },
};

export default budgetResolvers;
