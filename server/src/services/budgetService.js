import { Expense } from '../models/Expense.js';

export const calculateBudgetUsage = async (bucket) => {
  const query = {
    orgId: bucket.orgId,
    companyId: bucket.companyId,
    categoryId: bucket.categoryId,
    isDeleted: { $ne: true },
  };

  if (bucket.startDate || bucket.endDate) {
    query.date = {};
    if (bucket.startDate) query.date.$gte = new Date(bucket.startDate);
    if (bucket.endDate) query.date.$lte = new Date(bucket.endDate);
  }

  const result = await Expense.aggregate([
    { $match: query },
    { $group: { _id: null, totalSpent: { $sum: '$amount' } } },
  ]);

  const usedAmount = result.length > 0 ? result[0].totalSpent : 0;
  const limitAmount = bucket.limitAmount || 0;
  const remainingAmount = Math.max(0, limitAmount - usedAmount);
  const percentUsed = limitAmount > 0 ? (usedAmount / limitAmount) * 100 : 0;
  const isOverBudget = usedAmount > limitAmount;
  const isNearLimit = percentUsed >= (bucket.alertThreshold || 80);

  let subcatUsages = [];
  if (bucket.subcatBudgets && bucket.subcatBudgets.length > 0) {
    const subcatResult = await Expense.aggregate([
      { $match: { ...query, subcategory: { $ne: '' } } },
      { $group: { _id: '$subcategory', totalSpent: { $sum: '$amount' } } },
    ]);

    const subcatSpendMap = new Map(subcatResult.map((r) => [r._id, r.totalSpent]));

    subcatUsages = bucket.subcatBudgets.map((sub) => {
      const subSpent = subcatSpendMap.get(sub.subcategory) || 0;
      const subLimit = sub.limitAmount || 0;
      const subRemaining = Math.max(0, subLimit - subSpent);
      const subPercent = subLimit > 0 ? Number(((subSpent / subLimit) * 100).toFixed(2)) : 0;
      return {
        subcategory: sub.subcategory,
        limitAmount: subLimit,
        usedAmount: subSpent,
        remainingAmount: subRemaining,
        percentUsed: subPercent,
        isOverBudget: subSpent > subLimit,
      };
    });
  }

  return {
    bucket,
    usedAmount,
    remainingAmount,
    percentUsed: Number(percentUsed.toFixed(2)),
    isOverBudget,
    isNearLimit,
    subcatUsages,
  };
};

export default {
  calculateBudgetUsage,
};
