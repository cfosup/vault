import { Expense, Income, Company, Category, User } from '../models/index.js';
import { verifyToken } from '../services/authService.js';
import { applyDateBounds } from '../utils/dateRange.js';
import { accessOf, allowsModule, applyCompanyScope } from '../utils/access.js';

const authenticateExportReq = (req) => {
  let token = null;
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.replace('Bearer ', '').trim();
  } else if (req.query.token) {
    token = req.query.token;
  }

  if (!token) return null;
  return verifyToken(token);
};

export const exportExpensesCSV = async (req, res) => {
  try {
    const decoded = authenticateExportReq(req);
    if (!decoded || !decoded.orgId) {
      return res.status(401).json({ error: 'Unauthorized. Valid token required.' });
    }
    const actor = await User.findById(decoded.userId);
    if (!actor) return res.status(401).json({ error: 'Unauthorized. Valid token required.' });
    const access = accessOf(actor);
    if (!allowsModule(access, 'expenses')) {
      return res.status(403).json({ error: 'Expenses are not included in your access.' });
    }

    const { companyId, startDate, endDate } = req.query;
    const query = { orgId: actor.orgId, isDeleted: { $ne: true } };

    if (companyId) query.companyId = companyId;
    applyCompanyScope(query, access, companyId);
    applyDateBounds(query, startDate, endDate);

    const expenses = await Expense.find(query).sort({ date: -1 }).populate('companyId', 'name');

    // CSV Header
    let csv = 'Date,Company,Category,Subcategory,Amount (INR),Vendor,Payment Method,Notes\r\n';

    for (const exp of expenses) {
      const dateStr = exp.date ? new Date(exp.date).toISOString().split('T')[0] : '';
      const compName = exp.companyId?.name || '';
      const catName = `"${(exp.categoryName || '').replace(/"/g, '""')}"`;
      const subcat = `"${(exp.subcategory || '').replace(/"/g, '""')}"`;
      const amount = exp.amount || 0;
      const vendor = `"${(exp.vendor || '').replace(/"/g, '""')}"`;
      const pm = `"${(exp.paymentMethodName || '').replace(/"/g, '""')}"`;
      const notes = `"${(exp.notes || '').replace(/"/g, '""')}"`;

      csv += `${dateStr},"${compName}",${catName},${subcat},${amount},${vendor},${pm},${notes}\r\n`;
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="expenses_export.csv"');
    return res.status(200).send(csv);
  } catch (error) {
    console.error('[Export Expenses Error]:', error);
    return res.status(500).json({ error: 'Failed to export expenses CSV' });
  }
};

export const exportIncomeCSV = async (req, res) => {
  try {
    const decoded = authenticateExportReq(req);
    if (!decoded || !decoded.orgId) {
      return res.status(401).json({ error: 'Unauthorized. Valid token required.' });
    }
    const actor = await User.findById(decoded.userId);
    if (!actor) return res.status(401).json({ error: 'Unauthorized. Valid token required.' });
    const access = accessOf(actor);
    if (!allowsModule(access, 'income')) {
      return res.status(403).json({ error: 'Income is not included in your access.' });
    }

    const { companyId, startDate, endDate } = req.query;
    const query = { orgId: actor.orgId, isDeleted: { $ne: true } };

    if (companyId) query.companyId = companyId;
    applyCompanyScope(query, access, companyId);
    applyDateBounds(query, startDate, endDate);

    const incomes = await Income.find(query).sort({ date: -1 }).populate('companyId', 'name');

    let csv = 'Date,Company,Source,Amount (INR),Notes\r\n';

    for (const inc of incomes) {
      const dateStr = inc.date ? new Date(inc.date).toISOString().split('T')[0] : '';
      const compName = inc.companyId?.name || '';
      const source = `"${(inc.source || '').replace(/"/g, '""')}"`;
      const amount = inc.amount || 0;
      const notes = `"${(inc.notes || '').replace(/"/g, '""')}"`;

      csv += `${dateStr},"${compName}",${source},${amount},${notes}\r\n`;
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="income_export.csv"');
    return res.status(200).send(csv);
  } catch (error) {
    console.error('[Export Income Error]:', error);
    return res.status(500).json({ error: 'Failed to export income CSV' });
  }
};

export const exportCategoriesCSV = async (req, res) => {
  try {
    const user = authenticateExportReq(req);
    if (!user || !user.orgId) {
      return res.status(401).json({ error: 'Unauthorized. Valid token required.' });
    }

    const { companyId } = req.query;
    let query = {
      $or: [
        { isGlobal: true },
        { orgId: user.orgId },
      ],
    };

    if (companyId) {
      query = {
        $or: [
          { orgId: user.orgId, companyId },
          { isGlobal: true },
        ],
      };
    }

    const categories = await Category.find(query).sort({ group: 1, name: 1 }).populate('companyId', 'name');

    let csv = 'Section Letter,Section Label,Category Name,Subcategories,Scope\r\n';

    for (const cat of categories) {
      const group = `"${(cat.group || '').replace(/"/g, '""')}"`;
      const groupLabel = `"${(cat.groupLabel || '').replace(/"/g, '""')}"`;
      const catName = `"${(cat.name || '').replace(/"/g, '""')}"`;
      const subcats = `"${(cat.subcategories?.map((s) => s.name).join('; ') || '').replace(/"/g, '""')}"`;
      const scope = cat.companyId ? `"${(cat.companyId?.name || '').replace(/"/g, '""')}"` : '"Global Template"';

      csv += `${group},${groupLabel},${catName},${subcats},${scope}\r\n`;
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="chart_of_accounts.csv"');
    return res.status(200).send(csv);
  } catch (error) {
    console.error('[Export Categories Error]:', error);
    return res.status(500).json({ error: 'Failed to export categories CSV' });
  }
};

export default {
  exportExpensesCSV,
  exportIncomeCSV,
  exportCategoriesCSV,
};

