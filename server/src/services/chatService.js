import { ChatGroq } from '@langchain/groq';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import mongoose from 'mongoose';
import { Expense, Income, Company, BudgetBucket, Category } from '../models/index.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Fetches relevant financial summaries for an organization to ground the AI model.
 */
export const getOrgFinancialContext = async (orgId) => {
  const orgObjectId = new mongoose.Types.ObjectId(orgId);

  const [expenseAgg, incomeAgg, catAgg, vendorAgg, companies, budgets] = await Promise.all([
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
    Company.find({ orgId: orgObjectId }).select('name isActive'),
    BudgetBucket.find({ orgId: orgObjectId }).select('name categoryName limitAmount alertThreshold'),
  ]);

  const totalExpenses = expenseAgg.length > 0 ? expenseAgg[0].total : 0;
  const expenseCount = expenseAgg.length > 0 ? expenseAgg[0].count : 0;
  const totalIncome = incomeAgg.length > 0 ? incomeAgg[0].total : 0;
  const incomeCount = incomeAgg.length > 0 ? incomeAgg[0].count : 0;
  const netBalance = totalIncome - totalExpenses;

  return {
    totalExpenses,
    expenseCount,
    totalIncome,
    incomeCount,
    netBalance,
    topCategories: catAgg.map((c) => ({ category: c._id, amount: c.total, count: c.count })),
    topVendors: vendorAgg.map((v) => ({ vendor: v._id, amount: v.total, count: v.count })),
    companies: companies.map((c) => c.name),
    budgets: budgets.map((b) => ({ name: b.name, category: b.categoryName, limit: b.limitAmount })),
  };
};

/**
 * Fallback financial analyzer when no valid GROQ_API_KEY is available (e.g. offline tests or setup).
 */
const generateDeterministicReply = (message, context) => {
  const query = message.toLowerCase();

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
    return `Hello! I am your Vault AI finance assistant. I can summarize your expenses, income, net balance, top categories, and budget limits. How can I assist you today?`;
  }

  // Generic financial summary fallback
  return `Based on your records, you have ₹${context.totalExpenses.toLocaleString('en-IN')} in expenses and ₹${context.totalIncome.toLocaleString('en-IN')} in income, leaving a net balance of ₹${context.netBalance.toLocaleString('en-IN')}. Ask me about specific categories, vendors, or budgets!`;
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

    const systemPrompt = `You are a professional financial AI assistant for Vault SaaS.
You have access to the following real-time financial data for this organization:
- Total Expenses: ₹${context.totalExpenses.toLocaleString('en-IN')} (${context.expenseCount} entries)
- Total Income: ₹${context.totalIncome.toLocaleString('en-IN')} (${context.incomeCount} entries)
- Net Balance: ₹${context.netBalance.toLocaleString('en-IN')}
- Top Spending Categories: ${JSON.stringify(context.topCategories)}
- Top Vendors: ${JSON.stringify(context.topVendors)}
- Active Companies: ${JSON.stringify(context.companies)}
- Budgets: ${JSON.stringify(context.budgets)}

Rules:
1. Ground your answers strictly in the financial facts above.
2. Format all monetary values with ₹ (Indian Rupee).
3. If asked questions unrelated to finance or Vault, reply: "I can only help with finance tracking data."
4. If asked for information not present in the data, reply: "I cannot find data for that."
5. Be concise and helpful.`;

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
};
