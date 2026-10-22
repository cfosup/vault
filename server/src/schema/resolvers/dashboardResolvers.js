import { GraphQLError } from 'graphql';
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

    companyIncomeUsage: async (_, { companyId }, context) => {
      requireAuth(context);
      return calculateCompanyIncomeUsage(context.orgId, companyId);
    },

    allCompaniesIncomeUsage: async (_, __, context) => {
      requireAuth(context);
      const orgObjectId = new mongoose.Types.ObjectId(context.orgId);
      const companies = await Company.find({ orgId: orgObjectId }).sort({ name: 1 });

      const reports = await Promise.all(
        companies.map((c) => calculateCompanyIncomeUsage(context.orgId, c._id.toString()))
      );
      return reports;
    },
  },
};

export const calculateCompanyIncomeUsage = async (orgId, companyId) => {
  const orgObjectId = new mongoose.Types.ObjectId(orgId);
  const compObjectId = new mongoose.Types.ObjectId(companyId);

  const company = await Company.findOne({ _id: compObjectId, orgId: orgObjectId });
  if (!company) {
    throw new GraphQLError('Company not found', {
      extensions: { code: 'NOT_FOUND', http: { status: 404 } },
    });
  }

  // 1. Fetch all non-deleted income entries for this company
  const incomes = await Income.find({
    orgId: orgObjectId,
    companyId: compObjectId,
    isDeleted: { $ne: true },
  }).sort({ date: -1, createdAt: -1 });

  // 2. Fetch all non-deleted expenses for this company or linked to this company's incomes
  const incomeIds = incomes.map((i) => i._id);
  const expenses = await Expense.find({
    orgId: orgObjectId,
    $or: [
      { companyId: compObjectId },
      { incomeId: { $in: incomeIds } },
      { incomeIds: { $in: incomeIds } },
    ],
    isDeleted: { $ne: true },
  }).sort({ date: -1, createdAt: -1 });

  // 3. Map expenses by incomeId
  const expensesByIncomeId = new Map();
  let unlinkedExpensesTotal = 0;
  let unlinkedExpenseCount = 0;

  for (const exp of expenses) {
    const linkedIds = (
      exp.incomeIds && exp.incomeIds.length > 0
        ? exp.incomeIds
        : exp.incomeId
        ? [exp.incomeId]
        : []
    ).map((id) => id.toString());

    if (linkedIds.length > 0) {
      for (const id of linkedIds) {
        if (!expensesByIncomeId.has(id)) {
          expensesByIncomeId.set(id, []);
        }
        expensesByIncomeId.get(id).push(exp);
      }
    } else if (exp.companyId.toString() === compObjectId.toString()) {
      unlinkedExpensesTotal += exp.amount;
      unlinkedExpenseCount += 1;
    }
  }

  // 4. Calculate for each individual income entry
  let totalCompanyIncome = 0;
  let totalCompanyLinkedUtilized = 0;

  const incomeEntries = incomes.map((inc) => {
    const incKey = inc._id.toString();
    const linked = expensesByIncomeId.get(incKey) || [];
    const totalUtilized = linked.reduce((sum, e) => {
      if (Array.isArray(e.incomeAllocations) && e.incomeAllocations.length > 0) {
        const alloc = e.incomeAllocations.find((a) => a.incomeId && a.incomeId.toString() === incKey);
        if (alloc && typeof alloc.amount === 'number') {
          return sum + alloc.amount;
        }
      }
      return sum + e.amount;
    }, 0);
    const remainingBalance = Math.max(inc.amount - totalUtilized, 0);
    const excessSpending = Math.max(totalUtilized - inc.amount, 0);
    const utilizationPercentage = inc.amount > 0 ? Number(((totalUtilized / inc.amount) * 100).toFixed(2)) : 0;

    totalCompanyIncome += inc.amount;
    totalCompanyLinkedUtilized += totalUtilized;

    return {
      id: inc._id.toString(),
      companyId: companyId.toString(),
      source: inc.source,
      date: inc.date ? inc.date.toISOString() : new Date().toISOString(),
      amount: inc.amount,
      notes: inc.notes || '',
      totalUtilized,
      remainingBalance,
      excessSpending,
      utilizationPercentage,
      linkedExpenses: linked,
      linkedExpenseCount: linked.length,
    };
  });

  const totalExcessSpending = Math.max(totalCompanyLinkedUtilized - totalCompanyIncome, 0);
  const remainingBalance = Math.max(totalCompanyIncome - totalCompanyLinkedUtilized, 0);
  const companyUtilizationPercentage = totalCompanyIncome > 0
    ? Number(((totalCompanyLinkedUtilized / totalCompanyIncome) * 100).toFixed(2))
    : 0;

  return {
    companyId: companyId.toString(),
    companyName: company.name,
    totalIncome: totalCompanyIncome,
    totalUtilized: totalCompanyLinkedUtilized,
    remainingBalance,
    totalExcessSpending,
    utilizationPercentage: companyUtilizationPercentage,
    incomeEntries,
    incomeCount: incomes.length,
    unlinkedExpensesTotal,
    unlinkedExpenseCount,
  };
};

export default dashboardResolvers;
