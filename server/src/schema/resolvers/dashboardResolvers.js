import mongoose from 'mongoose';
import { Expense, Income, Company } from '../../models/index.js';
import { requireAuth } from '../../middleware/auth.js';

export const dashboardResolvers = {
  Query: {
    dashboardSummary: async (_, { filter = {} }, context) => {
      requireAuth(context);

      const orgObjectId = new mongoose.Types.ObjectId(context.orgId);
      const matchExpense = { orgId: orgObjectId, isDeleted: { $ne: true } };
      const matchIncome = { orgId: orgObjectId, isDeleted: { $ne: true } };

      if (filter.companyId) {
        const compObjectId = new mongoose.Types.ObjectId(filter.companyId);
        matchExpense.companyId = compObjectId;
        matchIncome.companyId = compObjectId;
      }
      if (filter.startDate || filter.endDate) {
        const dateMatch = {};
        if (filter.startDate) dateMatch.$gte = new Date(filter.startDate);
        if (filter.endDate) dateMatch.$lte = new Date(filter.endDate);
        matchExpense.date = dateMatch;
        matchIncome.date = dateMatch;
      }

      const [expenseAgg, incomeAgg, topCatAgg, topVenAgg] = await Promise.all([
        Expense.aggregate([
          { $match: matchExpense },
          { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
        ]),
        Income.aggregate([
          { $match: matchIncome },
          { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
        ]),
        Expense.aggregate([
          { $match: matchExpense },
          { $group: { _id: '$categoryName', total: { $sum: '$amount' } } },
          { $sort: { total: -1 } },
          { $limit: 1 },
        ]),
        Expense.aggregate([
          { $match: { ...matchExpense, vendor: { $ne: '' } } },
          { $group: { _id: '$vendor', total: { $sum: '$amount' } } },
          { $sort: { total: -1 } },
          { $limit: 1 },
        ]),
      ]);

      const totalExpenses = expenseAgg.length > 0 ? expenseAgg[0].total : 0;
      const expenseCount = expenseAgg.length > 0 ? expenseAgg[0].count : 0;
      const totalIncome = incomeAgg.length > 0 ? incomeAgg[0].total : 0;
      const incomeCount = incomeAgg.length > 0 ? incomeAgg[0].count : 0;
      const netBalance = totalIncome - totalExpenses;
      const topCategory = topCatAgg.length > 0 ? topCatAgg[0]._id : null;
      const topVendor = topVenAgg.length > 0 ? topVenAgg[0]._id : null;

      return {
        totalExpenses,
        totalIncome,
        netBalance,
        expenseCount,
        incomeCount,
        topCategory,
        topVendor,
      };
    },

    categoryBreakdown: async (_, { filter = {} }, context) => {
      requireAuth(context);
      const orgObjectId = new mongoose.Types.ObjectId(context.orgId);
      const match = { orgId: orgObjectId, isDeleted: { $ne: true } };

      if (filter.companyId) match.companyId = new mongoose.Types.ObjectId(filter.companyId);
      if (filter.startDate || filter.endDate) {
        match.date = {};
        if (filter.startDate) match.date.$gte = new Date(filter.startDate);
        if (filter.endDate) match.date.$lte = new Date(filter.endDate);
      }

      const results = await Expense.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$categoryName',
            amount: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
        { $sort: { amount: -1 } },
      ]);

      const totalSpend = results.reduce((sum, item) => sum + item.amount, 0);

      return results.map((item) => ({
        categoryName: item._id || 'Uncategorized',
        amount: item.amount,
        count: item.count,
        percentage: totalSpend > 0 ? Number(((item.amount / totalSpend) * 100).toFixed(1)) : 0,
      }));
    },

    monthlyTrend: async (_, { months = 6, companyId }, context) => {
      requireAuth(context);
      const orgObjectId = new mongoose.Types.ObjectId(context.orgId);
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - (months || 6));

      const match = {
        orgId: orgObjectId,
        isDeleted: { $ne: true },
        date: { $gte: startDate },
      };
      if (companyId) {
        match.companyId = new mongoose.Types.ObjectId(companyId);
      }

      const results = await Expense.aggregate([
        { $match: match },
        {
          $group: {
            _id: {
              year: { $year: '$date' },
              month: { $month: '$date' },
            },
            amount: { $sum: '$amount' },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ]);

      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return results.map((item) => ({
        month: monthNames[item._id.month - 1] || `${item._id.month}`,
        year: item._id.year,
        amount: item.amount,
      }));
    },

    incomeVsExpenseTrend: async (_, { months = 6, companyId }, context) => {
      requireAuth(context);
      const orgObjectId = new mongoose.Types.ObjectId(context.orgId);
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - (months || 6));

      const expenseMatch = {
        orgId: orgObjectId,
        isDeleted: { $ne: true },
        date: { $gte: startDate },
      };
      const incomeMatch = {
        orgId: orgObjectId,
        isDeleted: { $ne: true },
        date: { $gte: startDate },
      };

      if (companyId) {
        const compObjectId = new mongoose.Types.ObjectId(companyId);
        expenseMatch.companyId = compObjectId;
        incomeMatch.companyId = compObjectId;
      }

      const [expenses, incomes] = await Promise.all([
        Expense.aggregate([
          { $match: expenseMatch },
          {
            $group: {
              _id: {
                year: { $year: '$date' },
                month: { $month: '$date' },
              },
              total: { $sum: '$amount' },
            },
          },
        ]),
        Income.aggregate([
          { $match: incomeMatch },
          {
            $group: {
              _id: {
                year: { $year: '$date' },
                month: { $month: '$date' },
              },
              total: { $sum: '$amount' },
            },
          },
        ]),
      ]);

      const monthMap = {};
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

      for (const e of expenses) {
        const key = `${e._id.year}-${e._id.month}`;
        monthMap[key] = {
          month: monthNames[e._id.month - 1] || `${e._id.month}`,
          year: e._id.year,
          expenses: e.total,
          income: 0,
        };
      }

      for (const inc of incomes) {
        const key = `${inc._id.year}-${inc._id.month}`;
        if (!monthMap[key]) {
          monthMap[key] = {
            month: monthNames[inc._id.month - 1] || `${inc._id.month}`,
            year: inc._id.year,
            expenses: 0,
            income: inc.total,
          };
        } else {
          monthMap[key].income = inc.total;
        }
      }

      return Object.values(monthMap).map((item) => ({
        ...item,
        net: item.income - item.expenses,
      }));
    },

    topVendors: async (_, { filter = {}, limit = 5 }, context) => {
      requireAuth(context);
      const orgObjectId = new mongoose.Types.ObjectId(context.orgId);
      const match = { orgId: orgObjectId, isDeleted: { $ne: true }, vendor: { $ne: '' } };

      if (filter.companyId) match.companyId = new mongoose.Types.ObjectId(filter.companyId);
      if (filter.startDate || filter.endDate) {
        match.date = {};
        if (filter.startDate) match.date.$gte = new Date(filter.startDate);
        if (filter.endDate) match.date.$lte = new Date(filter.endDate);
      }

      const results = await Expense.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$vendor',
            amount: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
        { $sort: { amount: -1 } },
        { $limit: limit || 5 },
      ]);

      return results.map((item) => ({
        vendor: item._id,
        amount: item.amount,
        count: item.count,
      }));
    },

    paymentMethodBreakdown: async (_, { filter = {} }, context) => {
      requireAuth(context);
      const orgObjectId = new mongoose.Types.ObjectId(context.orgId);
      const match = { orgId: orgObjectId, isDeleted: { $ne: true } };

      if (filter.companyId) match.companyId = new mongoose.Types.ObjectId(filter.companyId);
      if (filter.startDate || filter.endDate) {
        match.date = {};
        if (filter.startDate) match.date.$gte = new Date(filter.startDate);
        if (filter.endDate) match.date.$lte = new Date(filter.endDate);
      }

      const results = await Expense.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$paymentMethodName',
            amount: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
        { $sort: { amount: -1 } },
      ]);

      return results.map((item) => ({
        paymentMethodName: item._id || 'Unspecified',
        amount: item.amount,
        count: item.count,
      }));
    },

    companySpendBreakdown: async (_, { filter = {} }, context) => {
      requireAuth(context);
      const orgObjectId = new mongoose.Types.ObjectId(context.orgId);

      // Fetch all companies under this org
      const companies = await Company.find({ orgId: orgObjectId, isActive: true });
      if (!companies || companies.length === 0) return [];

      const expenseMatch = { orgId: orgObjectId, isDeleted: { $ne: true } };
      const incomeMatch = { orgId: orgObjectId, isDeleted: { $ne: true } };

      if (filter.companyId) {
        const compObjectId = new mongoose.Types.ObjectId(filter.companyId);
        expenseMatch.companyId = compObjectId;
        incomeMatch.companyId = compObjectId;
      }

      if (filter.startDate || filter.endDate) {
        const dateMatch = {};
        if (filter.startDate) dateMatch.$gte = new Date(filter.startDate);
        if (filter.endDate) dateMatch.$lte = new Date(filter.endDate);
        expenseMatch.date = dateMatch;
        incomeMatch.date = dateMatch;
      }

      const [expenseByComp, incomeByComp] = await Promise.all([
        Expense.aggregate([
          { $match: expenseMatch },
          {
            $group: {
              _id: '$companyId',
              expenses: { $sum: '$amount' },
              count: { $sum: 1 },
            },
          },
        ]),
        Income.aggregate([
          { $match: incomeMatch },
          {
            $group: {
              _id: '$companyId',
              income: { $sum: '$amount' },
            },
          },
        ]),
      ]);

      const expMap = new Map(expenseByComp.map((e) => [e._id ? e._id.toString() : '', e]));
      const incMap = new Map(incomeByComp.map((i) => [i._id ? i._id.toString() : '', i]));
      const totalOrgExpenses = expenseByComp.reduce((sum, e) => sum + e.expenses, 0);

      const targetCompanies = filter.companyId
        ? companies.filter((c) => c._id.toString() === filter.companyId)
        : companies;

      return targetCompanies
        .map((c) => {
          const cId = c._id.toString();
          const exp = expMap.get(cId)?.expenses || 0;
          const inc = incMap.get(cId)?.income || 0;
          const count = expMap.get(cId)?.count || 0;
          const percentage = totalOrgExpenses > 0 ? Number(((exp / totalOrgExpenses) * 100).toFixed(1)) : 0;

          return {
            companyId: cId,
            companyName: c.name,
            expenses: exp,
            income: inc,
            netBalance: inc - exp,
            expenseCount: count,
            percentage,
          };
        })
        .sort((a, b) => b.expenses - a.expenses);
    },

  },
};

export default dashboardResolvers;
