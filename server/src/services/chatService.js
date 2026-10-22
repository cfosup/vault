import { ChatGroq } from '@langchain/groq';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import mongoose from 'mongoose';
import { Expense, Income, Company, BudgetBucket, Category } from '../models/index.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Fetches relevant financial summaries and company income usage data for an organization to ground the AI model.
 */
export const getOrgFinancialContext = async (orgId) => {
  const orgObjectId = new mongoose.Types.ObjectId(orgId);

  const [
    expenseAgg,
    incomeAgg,
    catAgg,
    vendorAgg,
    companies,
    budgets,
    allIncomes,
    allExpenses,
  ] = await Promise.all([
    Expense.aggregate([
      { $match: { orgId: orgObjectId, isDeleted: { $ne: true } } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    Income.aggregate([
      { $match: { orgId: orgObjectId, isDeleted: { $ne: true } } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    Expense.aggregate([
      { $match: { orgId: orgObjectId, isDeleted: { $ne: true } } },
      { $group: { _id: '$categoryName', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
      { $limit: 10 },
    ]),
    Expense.aggregate([
      { $match: { orgId: orgObjectId, isDeleted: { $ne: true }, vendor: { $ne: '' } } },
      { $group: { _id: '$vendor', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
      { $limit: 10 },
    ]),
    Company.find({ orgId: orgObjectId }).select('name isActive isCoreBranch'),
    BudgetBucket.find({ orgId: orgObjectId }).select('name categoryName limitAmount alertThreshold'),
    Income.find({ orgId: orgObjectId, isDeleted: { $ne: true } }).sort({ date: -1, createdAt: -1 }),
    Expense.find({ orgId: orgObjectId, isDeleted: { $ne: true } }).sort({ date: -1, createdAt: -1 }),
  ]);

  const totalExpenses = expenseAgg.length > 0 ? expenseAgg[0].total : 0;
  const expenseCount = expenseAgg.length > 0 ? expenseAgg[0].count : 0;
  const totalIncome = incomeAgg.length > 0 ? incomeAgg[0].total : 0;
  const incomeCount = incomeAgg.length > 0 ? incomeAgg[0].count : 0;
  const netBalance = totalIncome - totalExpenses;

  // Map expenses by incomeId
  const expensesByIncomeId = new Map();
  let unlinkedExpensesTotal = 0;
  let unlinkedExpenseCount = 0;

  for (const exp of allExpenses) {
    if (exp.incomeId) {
      const incKey = exp.incomeId.toString();
      if (!expensesByIncomeId.has(incKey)) {
        expensesByIncomeId.set(incKey, []);
      }
      expensesByIncomeId.get(incKey).push({
        id: exp._id.toString(),
        companyId: exp.companyId.toString(),
        vendor: exp.vendor || 'Unknown Payee',
        amount: exp.amount,
        categoryName: exp.categoryName,
        subcategory: exp.subcategory || '',
        date: exp.date ? exp.date.toISOString().split('T')[0] : '',
      });
    } else {
      unlinkedExpensesTotal += exp.amount;
      unlinkedExpenseCount += 1;
    }
  }

  // Calculate usage per company and per income entry
  const companyUsageMap = new Map();
  for (const comp of companies) {
    companyUsageMap.set(comp._id.toString(), {
      companyId: comp._id.toString(),
      companyName: comp.name,
      totalIncome: 0,
      totalUtilized: 0,
      remainingBalance: 0,
      totalExcessSpending: 0,
      utilizationPercentage: 0,
      incomeEntries: [],
      unlinkedExpensesTotal: 0,
      unlinkedExpenseCount: 0,
    });
  }

  for (const exp of allExpenses) {
    if (!exp.incomeId) {
      const compRecord = companyUsageMap.get(exp.companyId.toString());
      if (compRecord) {
        compRecord.unlinkedExpensesTotal += exp.amount;
        compRecord.unlinkedExpenseCount += 1;
      }
    }
  }

  const allProcessedIncomes = [];
  let orgTotalExcessSpending = 0;

  for (const inc of allIncomes) {
    const incIdStr = inc._id.toString();
    const compIdStr = inc.companyId.toString();
    const linked = expensesByIncomeId.get(incIdStr) || [];
    const totalUtilized = linked.reduce((sum, e) => {
      if (Array.isArray(e.incomeAllocations) && e.incomeAllocations.length > 0) {
        const alloc = e.incomeAllocations.find((a) => a.incomeId && a.incomeId.toString() === incIdStr);
        if (alloc && typeof alloc.amount === 'number') {
          return sum + alloc.amount;
        }
      }
      return sum + e.amount;
    }, 0);
    const remainingBalance = Math.max(inc.amount - totalUtilized, 0);
    const excessSpending = Math.max(totalUtilized - inc.amount, 0);
    const utilizationPercentage = inc.amount > 0 ? Number(((totalUtilized / inc.amount) * 100).toFixed(2)) : 0;

    orgTotalExcessSpending += excessSpending;

    const compRecord = companyUsageMap.get(compIdStr);
    const compName = compRecord ? compRecord.companyName : 'Unknown Company';

    const item = {
      id: incIdStr,
      companyId: compIdStr,
      companyName: compName,
      source: inc.source,
      date: inc.date ? inc.date.toISOString().split('T')[0] : '',
      amount: inc.amount,
      totalUtilized,
      remainingBalance,
      excessSpending,
      utilizationPercentage,
      linkedExpenses: linked,
      linkedExpenseCount: linked.length,
    };

    allProcessedIncomes.push(item);

    if (compRecord) {
      compRecord.totalIncome += inc.amount;
      compRecord.totalUtilized += totalUtilized;
      compRecord.incomeEntries.push(item);
    }
  }

  const companyUsageList = [];
  for (const compRecord of companyUsageMap.values()) {
    compRecord.remainingBalance = Math.max(compRecord.totalIncome - compRecord.totalUtilized, 0);
    compRecord.totalExcessSpending = Math.max(compRecord.totalUtilized - compRecord.totalIncome, 0);
    compRecord.utilizationPercentage = compRecord.totalIncome > 0
      ? Number(((compRecord.totalUtilized / compRecord.totalIncome) * 100).toFixed(2))
      : 0;
    companyUsageList.push(compRecord);
  }

  const excessSpendingIncomes = allProcessedIncomes.filter((i) => i.excessSpending > 0);
  const lowBalanceIncomes = allProcessedIncomes.filter(
    (i) => i.amount > 0 && (i.remainingBalance / i.amount <= 0.2 || i.remainingBalance === 0)
  );

  return {
    totalExpenses,
    expenseCount,
    totalIncome,
    incomeCount,
    netBalance,
    topCategories: catAgg.map((c) => ({ category: c._id, amount: c.total, count: c.count })),
    topVendors: vendorAgg.map((v) => ({ vendor: v._id, amount: v.total, count: v.count })),
    companies: companies.map((c) => ({ id: c._id.toString(), name: c.name })),
    budgets: budgets.map((b) => ({ name: b.name, category: b.categoryName, limit: b.limitAmount })),
    allIncomes: allProcessedIncomes,
    companyUsage: companyUsageList,
    excessSpendingIncomes,
    lowBalanceIncomes,
    orgTotalExcessSpending,
    unlinkedExpensesTotal,
    unlinkedExpenseCount,
  };
};

/**
 * Robust deterministic financial analyzer supporting all 10 prompt questions and proactive insights.
 */
export const generateDeterministicReply = (message, context) => {
  const query = message.toLowerCase().trim();

  // Helper: Find company by name in query
  const matchedCompany = context.companyUsage.find((c) =>
    query.includes(c.companyName.toLowerCase())
  );

  // Helper: Find income by source name in query
  const matchedIncome = context.allIncomes.find((inc) =>
    query.includes(inc.source.toLowerCase())
  );

  // 1. "Which company has the highest linked expense utilization?"
  if (
    query.includes('highest') &&
    (query.includes('utilization') || query.includes('utilized')) &&
    query.includes('company')
  ) {
    if (context.companyUsage.length === 0) {
      return 'No company income or expense data is currently available.';
    }
    const sorted = [...context.companyUsage].sort(
      (a, b) => b.utilizationPercentage - a.utilizationPercentage
    );
    const top = sorted[0];
    let reply = `**${top.companyName}** has the highest linked expense utilization at **${top.utilizationPercentage}%** (Total Income: ₹${top.totalIncome.toLocaleString('en-IN')}, Linked Expenses Utilized: ₹${top.totalUtilized.toLocaleString('en-IN')}, Remaining Balance: ₹${top.remainingBalance.toLocaleString('en-IN')}).`;
    if (top.totalExcessSpending > 0) {
      reply += `\n\n⚠️ **Notice**: This company has recorded **₹${top.totalExcessSpending.toLocaleString('en-IN')}** in excess spending beyond received income.`;
    }
    return reply;
  }

  // 2. "How much excess spending do I have across all my income entries?"
  if (
    (query.includes('how much excess') || query.includes('total excess')) &&
    (query.includes('all') || query.includes('across') || query.includes('entries') || query.includes('entry') || query.includes('spending'))
  ) {
    if (context.orgTotalExcessSpending === 0) {
      return 'You currently have **₹0** in excess spending across all your income entries. All linked disbursements are within their respective income amounts.';
    }
    const count = context.excessSpendingIncomes.length;
    let reply = `You have a total of **₹${context.orgTotalExcessSpending.toLocaleString('en-IN')}** in excess spending across ${count} income ${count === 1 ? 'entry' : 'entries'}.`;
    if (count > 0) {
      const breakdown = context.excessSpendingIncomes
        .map(
          (i) =>
            `- **${i.source}** (${i.companyName}): ₹${i.amount.toLocaleString('en-IN')} received, ₹${i.totalUtilized.toLocaleString('en-IN')} utilized (Excess: **₹${i.excessSpending.toLocaleString('en-IN')}**)`
        )
        .join('\n');
      reply += `\n\n${breakdown}`;
    }
    return reply;
  }

  // 3. "Which income entries have excess spending?"
  if (
    query.includes('excess') &&
    (query.includes('which') || query.includes('list') || query.includes('show') || query.includes('what'))
  ) {
    if (context.excessSpendingIncomes.length === 0) {
      return 'None of your income entries currently have excess spending. All linked disbursements remain within allocated income limits.';
    }
    const breakdown = context.excessSpendingIncomes
      .map(
        (i) =>
          `- **${i.source}** (${i.companyName}): Original Amount: ₹${i.amount.toLocaleString('en-IN')} | Utilized: ₹${i.totalUtilized.toLocaleString('en-IN')} | Excess Spending: **₹${i.excessSpending.toLocaleString('en-IN')}** (${i.utilizationPercentage}%)`
      )
      .join('\n');
    return `The following income entries have exceeded their received amounts:\n\n${breakdown}\n\n💡 *Tip: Consider reassigning expenses or recording additional income for these entries.*`;
  }

  // 4. "Which income entries have a low remaining balance?"
  if (
    (query.includes('low') || query.includes('nearing') || query.includes('depleted') || query.includes('critical')) &&
    (query.includes('balance') || query.includes('remaining') || query.includes('income'))
  ) {
    if (context.lowBalanceIncomes.length === 0) {
      return 'All your income entries currently maintain a healthy balance (greater than 20% remaining).';
    }
    const breakdown = context.lowBalanceIncomes
      .map(
        (i) =>
          `- **${i.source}** (${i.companyName}): Original Amount: ₹${i.amount.toLocaleString('en-IN')} | Remaining: **₹${i.remainingBalance.toLocaleString('en-IN')}** (${(100 - i.utilizationPercentage).toFixed(1)}% remaining | Utilized: ${i.utilizationPercentage}%)`
      )
      .join('\n');
    return `The following income entries have a low remaining balance (under 20% remaining):\n\n${breakdown}`;
  }

  // 5. "How much of Company A's income has been utilized?"
  if (
    matchedCompany &&
    (query.includes('utilized') || query.includes('utilised') || query.includes('used') || query.includes('how much of')) &&
    query.includes('income')
  ) {
    let reply = `**${matchedCompany.companyName}** has utilized **₹${matchedCompany.totalUtilized.toLocaleString('en-IN')}** (**${matchedCompany.utilizationPercentage}%**) of its total income through linked disbursements.`;
    reply += `\n- **Total Income Received**: ₹${matchedCompany.totalIncome.toLocaleString('en-IN')}`;
    reply += `\n- **Remaining Balance**: ₹${matchedCompany.remainingBalance.toLocaleString('en-IN')}`;
    reply += `\n- **Excess Spending**: ₹${matchedCompany.totalExcessSpending.toLocaleString('en-IN')}`;
    if (matchedCompany.unlinkedExpensesTotal > 0) {
      reply += `\n\n💡 *Note: There are also ${matchedCompany.unlinkedExpenseCount} unlinked disbursements totaling ₹${matchedCompany.unlinkedExpensesTotal.toLocaleString('en-IN')} for this company.*`;
    }
    return reply;
  }

  // 6. "How much income has Company A received?"
  if (
    matchedCompany &&
    (query.includes('how much income') || query.includes('total income') || query.includes('income received') || query.includes('revenue received'))
  ) {
    let reply = `**${matchedCompany.companyName}** has received a total income of **₹${matchedCompany.totalIncome.toLocaleString('en-IN')}** across ${matchedCompany.incomeEntries.length} recorded income entries.`;
    if (matchedCompany.totalUtilized > 0) {
      reply += `\n- **Amount Utilized**: ₹${matchedCompany.totalUtilized.toLocaleString('en-IN')} (${matchedCompany.utilizationPercentage}%)`;
      reply += `\n- **Remaining Balance**: ₹${matchedCompany.remainingBalance.toLocaleString('en-IN')}`;
    }
    return reply;
  }

  // 7. "Show me the expenses associated with Company A's income."
  if (
    matchedCompany &&
    (query.includes('expense') || query.includes('disbursement')) &&
    (query.includes('associated') || query.includes('linked') || query.includes('with') || query.includes('show') || query.includes('list'))
  ) {
    const linkedExps = matchedCompany.incomeEntries.flatMap((i) =>
      i.linkedExpenses.map((e) => ({ ...e, incomeSource: i.source }))
    );

    if (linkedExps.length === 0) {
      return `There are currently no expenses linked to **${matchedCompany.companyName}**'s income entries.`;
    }

    const listStr = linkedExps
      .slice(0, 10)
      .map(
        (e) =>
          `- **${e.vendor}**: ₹${e.amount.toLocaleString('en-IN')} (${e.categoryName}${e.subcategory ? ` • ${e.subcategory}` : ''}) linked to *${e.incomeSource}* on ${e.date}`
      )
      .join('\n');

    let reply = `Found **${linkedExps.length}** expense(s) linked to income for **${matchedCompany.companyName}** (Total Linked: ₹${matchedCompany.totalUtilized.toLocaleString('en-IN')}):\n\n${listStr}`;
    if (linkedExps.length > 10) {
      reply += `\n- ...and ${linkedExps.length - 10} more.`;
    }
    return reply;
  }

  // 8. "Which expenses are linked to this income entry?" (matches specific income or asks for clarification)
  if (
    query.includes('which expenses') ||
    query.includes('what expenses') ||
    (query.includes('expenses') && (query.includes('linked to') || query.includes('associated with')))
  ) {
    if (matchedIncome) {
      if (matchedIncome.linkedExpenses.length === 0) {
        return `There are no expenses linked to income entry "**${matchedIncome.source}**" (₹${matchedIncome.amount.toLocaleString('en-IN')}). The full amount of ₹${matchedIncome.remainingBalance.toLocaleString('en-IN')} remains available.`;
      }
      const listStr = matchedIncome.linkedExpenses
        .map(
          (e) =>
            `- **${e.vendor}**: ₹${e.amount.toLocaleString('en-IN')} (${e.categoryName}${e.subcategory ? ` • ${e.subcategory}` : ''}) on ${e.date}`
        )
        .join('\n');
      return `The following ${matchedIncome.linkedExpenses.length} expense(s) are linked to "**${matchedIncome.source}**" (Total Utilized: ₹${matchedIncome.totalUtilized.toLocaleString('en-IN')} of ₹${matchedIncome.amount.toLocaleString('en-IN')}):\n\n${listStr}\n\n- **Remaining Balance**: ₹${matchedIncome.remainingBalance.toLocaleString('en-IN')}\n- **Excess Spending**: ₹${matchedIncome.excessSpending.toLocaleString('en-IN')}`;
    }

    if (context.allIncomes.length === 1) {
      const sole = context.allIncomes[0];
      if (sole.linkedExpenses.length === 0) {
        return `There are no expenses linked to your income entry "**${sole.source}**".`;
      }
      const listStr = sole.linkedExpenses
        .map((e) => `- **${e.vendor}**: ₹${e.amount.toLocaleString('en-IN')} (${e.categoryName})`)
        .join('\n');
      return `Expenses linked to "**${sole.source}**" (${sole.companyName}):\n\n${listStr}`;
    }

    return `Please specify which income entry you would like to inspect (for example: "${context.allIncomes[0]?.source || 'Client Retainer'}"). Available entries: ${context.allIncomes.slice(0, 5).map((i) => `"${i.source}"`).join(', ')}.`;
  }

  // 9. "What percentage of this income has been utilized?"
  if (query.includes('percentage') && (query.includes('utilized') || query.includes('used') || query.includes('income'))) {
    if (matchedIncome) {
      let reply = `Income entry "**${matchedIncome.source}**" has a utilization rate of **${matchedIncome.utilizationPercentage}%** (₹${matchedIncome.totalUtilized.toLocaleString('en-IN')} utilized out of ₹${matchedIncome.amount.toLocaleString('en-IN')}).`;
      reply += `\n- Remaining Balance: ₹${matchedIncome.remainingBalance.toLocaleString('en-IN')}`;
      if (matchedIncome.excessSpending > 0) {
        reply += `\n- ⚠️ Excess Spending: ₹${matchedIncome.excessSpending.toLocaleString('en-IN')}`;
      }
      return reply;
    }
    if (matchedCompany) {
      return `**${matchedCompany.companyName}** has an overall income utilization rate of **${matchedCompany.utilizationPercentage}%** (₹${matchedCompany.totalUtilized.toLocaleString('en-IN')} spent out of ₹${matchedCompany.totalIncome.toLocaleString('en-IN')}).`;
    }
    return `Please specify which income entry or company you would like to check the utilization percentage for.`;
  }

  // 10. "How much money remains from this income entry?"
  if (
    query.includes('remains') ||
    query.includes('remaining') ||
    query.includes('left from') ||
    (query.includes('balance') && query.includes('income'))
  ) {
    if (matchedIncome) {
      let reply = `From income entry "**${matchedIncome.source}**" (Original Amount: ₹${matchedIncome.amount.toLocaleString('en-IN')}), **₹${matchedIncome.remainingBalance.toLocaleString('en-IN')}** remains available.`;
      reply += `\n- Total Utilized: ₹${matchedIncome.totalUtilized.toLocaleString('en-IN')} (${matchedIncome.utilizationPercentage}%)`;
      if (matchedIncome.excessSpending > 0) {
        reply += `\n- ⚠️ Excess Spending: ₹${matchedIncome.excessSpending.toLocaleString('en-IN')}`;
      }
      return reply;
    }
    if (matchedCompany) {
      return `For **${matchedCompany.companyName}**, the total remaining balance across all income entries is **₹${matchedCompany.remainingBalance.toLocaleString('en-IN')}** (Total Income: ₹${matchedCompany.totalIncome.toLocaleString('en-IN')}, Linked Utilized: ₹${matchedCompany.totalUtilized.toLocaleString('en-IN')}).`;
    }
    return `Please specify which income entry or company you want to check the remaining balance for.`;
  }

  // General fallbacks
  if (query.includes('total expense') || query.includes('how much spent') || query.includes('total spend')) {
    return `Your organization's total recorded expenses are ₹${context.totalExpenses.toLocaleString('en-IN')} across ${context.expenseCount} entries.`;
  }
  if (query.includes('total income') || query.includes('revenue') || query.includes('earnings')) {
    return `Your total recorded income is ₹${context.totalIncome.toLocaleString('en-IN')} across ${context.incomeCount} entries.`;
  }
  if (query.includes('net balance') || query.includes('profit') || query.includes('balance')) {
    return `Your current net balance is ₹${context.netBalance.toLocaleString('en-IN')} (Total Income: ₹${context.totalIncome.toLocaleString('en-IN')} - Total Expenses: ₹${context.totalExpenses.toLocaleString('en-IN')}).`;
  }
  if (query.includes('top category') || query.includes('top spending') || query.includes('highest category')) {
    if (context.topCategories.length === 0) return 'No expense categories recorded yet.';
    const top = context.topCategories[0];
    return `Your top spending category is "${top.category}" with a total expenditure of ₹${top.amount.toLocaleString('en-IN')}.`;
  }
  if (query.includes('top vendor') || query.includes('highest vendor')) {
    if (context.topVendors.length === 0) return 'No vendors recorded yet.';
    const top = context.topVendors[0];
    return `Your top vendor by spend is "${top.vendor}" with a total of ₹${top.amount.toLocaleString('en-IN')}.`;
  }
  if (query.includes('budget')) {
    if (context.budgets.length === 0) return 'You do not have any budget buckets configured yet.';
    return `You have ${context.budgets.length} budget bucket(s) configured: ${context.budgets.map((b) => `${b.name} (₹${b.limit.toLocaleString('en-IN')})`).join(', ')}.`;
  }
  if (query.includes('hello') || query.includes('hi') || query.includes('hey')) {
    return `Hello! I am your Vault AI finance assistant. I can summarize your expenses, income, net balance, company income utilization, excess spending, remaining balances, and budget limits. How can I assist you today?`;
  }

  let fallbackReply = `Based on your records, you have ₹${context.totalExpenses.toLocaleString('en-IN')} in expenses and ₹${context.totalIncome.toLocaleString('en-IN')} in income, leaving a net balance of ₹${context.netBalance.toLocaleString('en-IN')}.`;
  if (context.orgTotalExcessSpending > 0) {
    fallbackReply += `\n\n⚠️ **Notice**: You have **₹${context.orgTotalExcessSpending.toLocaleString('en-IN')}** in excess spending across ${context.excessSpendingIncomes.length} income entries.`;
  }
  return fallbackReply;
};

/**
 * Main chat handler: Uses Groq llama-3.3-70b-versatile via LangChain if key is configured,
 * or falls back to deterministic financial analyzer.
 */
export const generateChatReply = async (orgId, userId, sessionId, message, history = []) => {
  const context = await getOrgFinancialContext(orgId);

  const groqApiKey = process.env.GROQ_API_KEY;
  const isGroqConfigured = groqApiKey && !groqApiKey.includes('your_groq_api_key') && groqApiKey.startsWith('gsk_');

  if (!isGroqConfigured) {
    return generateDeterministicReply(message, context);
  }

  try {
    const modelName = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
    const model = new ChatGroq({
      apiKey: groqApiKey,
      model: modelName,
      temperature: 0.2,
    });

    const companyUsageSummary = context.companyUsage.map((c) => ({
      companyName: c.companyName,
      totalIncome: c.totalIncome,
      totalUtilized: c.totalUtilized,
      remainingBalance: c.remainingBalance,
      totalExcessSpending: c.totalExcessSpending,
      utilizationPercentage: c.utilizationPercentage,
      incomeEntries: c.incomeEntries.map((i) => ({
        source: i.source,
        amount: i.amount,
        totalUtilized: i.totalUtilized,
        remainingBalance: i.remainingBalance,
        excessSpending: i.excessSpending,
        utilizationPercentage: i.utilizationPercentage,
        linkedExpenses: i.linkedExpenses,
      })),
      unlinkedExpensesTotal: c.unlinkedExpensesTotal,
      unlinkedExpenseCount: c.unlinkedExpenseCount,
    }));

    const systemPrompt = `You are a professional financial AI assistant for Vault SaaS.
You have access to the following real-time, authorized financial data for this organization:
- Total Expenses: ₹${context.totalExpenses.toLocaleString('en-IN')} (${context.expenseCount} entries)
- Total Income: ₹${context.totalIncome.toLocaleString('en-IN')} (${context.incomeCount} entries)
- Net Balance: ₹${context.netBalance.toLocaleString('en-IN')}
- Total Excess Spending Across All Income Entries: ₹${context.orgTotalExcessSpending.toLocaleString('en-IN')}
- Company Income Usage & Linked Disbursements: ${JSON.stringify(companyUsageSummary)}
- Top Spending Categories: ${JSON.stringify(context.topCategories)}
- Top Vendors: ${JSON.stringify(context.topVendors)}
- Active Companies: ${JSON.stringify(context.companies.map((c) => c.name))}
- Budgets: ${JSON.stringify(context.budgets)}

Rules & Calculation Formulas:
1. Ground your answers strictly in the financial facts above.
2. Remaining balance = MAX(Income Amount - Total Utilized, 0).
3. Excess spending = MAX(Total Utilized - Income Amount, 0).
4. Utilization percentage = (Total Utilized / Income Amount) * 100 (safely 0 when income is 0).
5. Format all monetary values with ₹ (Indian Rupee) and commas (e.g. ₹50,000).
6. Never expose or invent financial data for other organizations or users.
7. Ask for clarification if a company or income entry name cannot be identified unambiguously.
8. If asked for information not present in the records, state clearly: "I cannot find data for that."
9. Offer proactive context-aware insights when excess spending or low remaining balance (< 20%) is detected.
10. Be concise, precise, and executive-ready.`;

    const messages = [new SystemMessage(systemPrompt)];

    // Add up to last 6 messages from history
    const recentHistory = history.slice(-6);
    for (const h of recentHistory) {
      if (h.role === 'user') {
        messages.push(new HumanMessage(h.content));
      } else if (h.role === 'assistant') {
        messages.push(new AIMessage(h.content));
      }
    }

    messages.push(new HumanMessage(message));

    const response = await model.invoke(messages);
    return response.content || 'I could not generate a response at this time.';
  } catch (error) {
    console.warn('[ChatService] Groq API call encountered an issue, falling back to deterministic answer:', error.message);
    return generateDeterministicReply(message, context);
  }
};

export default {
  getOrgFinancialContext,
  generateChatReply,
  generateDeterministicReply,
};
