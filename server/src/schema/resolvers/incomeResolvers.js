import { GraphQLError } from 'graphql';
import { Income } from '../../models/index.js';
import { requireAuth } from '../../middleware/auth.js';

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
      requireAuth(context);

      const query = {
        orgId: context.orgId,
        isDeleted: { $ne: true },
      };

      if (filter.companyId) {
        query.companyId = filter.companyId;
      }
      if (filter.startDate || filter.endDate) {
        query.date = {};
        if (filter.startDate) query.date.$gte = new Date(filter.startDate);
        if (filter.endDate) query.date.$lte = new Date(filter.endDate);
      }
      if (filter.search) {
        const searchRegex = { $regex: filter.search, $options: 'i' };
        query.$or = [{ source: searchRegex }, { notes: searchRegex }];
      }

      const safePage = Math.max(1, page);
      const safeLimit = Math.min(100, Math.max(1, limit));
      const skip = (safePage - 1) * safeLimit;

      const [incomes, totalCount] = await Promise.all([
        Income.find(query).sort({ date: -1, createdAt: -1 }).skip(skip).limit(safeLimit),
        Income.countDocuments(query),
      ]);

      return {
        incomes,
        totalCount,
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
      requireAuth(context);

      if (!inputs || !Array.isArray(inputs) || inputs.length === 0) {
        throw new GraphQLError('At least one income must be provided.', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
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

      return Income.insertMany(documents);
    },

    updateIncome: async (_, { id, input }, context) => {
      requireAuth(context);

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
      requireAuth(context);

      const income = await Income.findOneAndUpdate(
        { _id: id, orgId: context.orgId, isDeleted: { $ne: true } },
        { $set: { isDeleted: true } }
      );

      return !!income;
    },
  },
};

export default incomeResolvers;
