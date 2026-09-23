import { GraphQLError } from 'graphql';
import { Expense } from '../../models/index.js';
import { requireAuth } from '../../middleware/auth.js';

export const expenseResolvers = {
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

      const [expenses, totalCount] = await Promise.all([
        Expense.find(query).sort({ date: -1, createdAt: -1 }).skip(skip).limit(safeLimit),
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
  },

  Mutation: {
    createExpenses: async (_, { inputs }, context) => {
      requireAuth(context);

      if (!inputs || !Array.isArray(inputs) || inputs.length === 0) {
        throw new GraphQLError('At least one expense must be provided.', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      const documents = inputs.map((input) => {
        if (!input.companyId || !input.categoryId || input.amount === undefined) {
          throw new GraphQLError('companyId, categoryId, and amount are required for each expense.', {
            extensions: { code: 'BAD_USER_INPUT' },
          });
        }

        return {
          orgId: context.orgId,
          companyId: input.companyId,
          date: input.date ? new Date(input.date) : new Date(),
          categoryId: input.categoryId,
          categoryName: input.categoryName || '',
          subcategory: input.subcategory || '',
          amount: Math.max(0, Number(input.amount)),
          vendor: input.vendor || '',
          paymentMethodId: input.paymentMethodId || null,
          paymentMethodName: input.paymentMethodName || '',
          notes: input.notes || '',
          budgetBucketId: input.budgetBucketId || null,
          createdBy: context.userId,
          isDeleted: false,
        };
      });

      return Expense.insertMany(documents);
    },

    updateExpense: async (_, { id, input }, context) => {
      requireAuth(context);

      const updateData = { ...input, updatedBy: context.userId };
      if (input.date) updateData.date = new Date(input.date);
      if (input.amount !== undefined) updateData.amount = Math.max(0, Number(input.amount));

      const expense = await Expense.findOneAndUpdate(
        { _id: id, orgId: context.orgId, isDeleted: { $ne: true } },
        { $set: updateData },
        { new: true }
      );

      if (!expense) {
        throw new GraphQLError('Expense not found', {
          extensions: { code: 'NOT_FOUND', http: { status: 404 } },
        });
      }

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
