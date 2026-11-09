import { GraphQLError } from 'graphql';
import { Company, User, Expense, Income, BudgetBucket, Category } from '../../models/index.js';
import { requireAuth, requireOwner } from '../../middleware/auth.js';
import { seedCompanyCoreCategories } from '../../services/seedService.js';
import { logActivity } from '../../services/activityService.js';
import { loadActor, accessOf, companyAllowed } from '../../utils/access.js';

export const companyResolvers = {
  Query: {
    companies: async (_, __, context) => {
      requireAuth(context);
      let orgId = context.orgId;
      if (!orgId && context.userId) {
        const u = await User.findById(context.userId).select('orgId');
        if (u) orgId = u.orgId?.toString();
      }
      return Company.find({ orgId }).sort({ createdAt: -1 }).then(async (companies) => {
        const access = accessOf(await loadActor(context));
        if (!access.companyIds.length) return companies;
        return companies.filter((company) => access.companyIds.includes(company._id.toString()));
      });
    },

    company: async (_, { id }, context) => {
      requireAuth(context);
      let orgId = context.orgId;
      if (!orgId && context.userId) {
        const u = await User.findById(context.userId).select('orgId');
        if (u) orgId = u.orgId?.toString();
      }
      const company = await Company.findOne({ _id: id, orgId });
      if (!company) {
        throw new GraphQLError('Company not found', {
          extensions: { code: 'NOT_FOUND', http: { status: 404 } },
        });
      }
      const access = accessOf(await loadActor(context));
      if (!companyAllowed(access, company._id)) {
        throw new GraphQLError('Company not found', {
          extensions: { code: 'NOT_FOUND', http: { status: 404 } },
        });
      }
      return company;
    },
  },

  Mutation: {
    createCompany: async (_, { input }, context) => {
      requireOwner(context);
      let orgId = context.orgId;
      if (!orgId && context.userId) {
        const u = await User.findById(context.userId).select('orgId');
        if (u) orgId = u.orgId?.toString();
      }

      if (!orgId) {
        throw new GraphQLError('Organization profile not found. Please log in again.', {
          extensions: { code: 'UNAUTHENTICATED', http: { status: 401 } },
        });
      }

      const { name, description, isActive, isCoreBranch } = input;

      if (!name || !name.trim()) {
        throw new GraphQLError('Company name is required.', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      const company = await Company.create({
        orgId,
        name: name.trim(),
        description: (description || '').trim(),
        isActive: isActive !== undefined ? isActive : true,
        isCoreBranch: !!isCoreBranch,
        createdBy: context.userId,
      });

      if (isCoreBranch) {
        await seedCompanyCoreCategories(orgId, company._id);
      }

      logActivity({
        orgId,
        userId: context.userId,
        action: 'CREATE_COMPANY',
        entityType: 'Company',
        entityId: company._id,
        companyId: company._id,
        companyName: company.name,
        description: `Created company entity "${company.name}"`,
      });

      return company;
    },

    updateCompany: async (_, { id, input }, context) => {
      requireOwner(context);
      let orgId = context.orgId;
      if (!orgId && context.userId) {
        const u = await User.findById(context.userId).select('orgId');
        if (u) orgId = u.orgId?.toString();
      }

      const updateData = {};
      if (input.name !== undefined) updateData.name = input.name.trim();
      if (input.description !== undefined) updateData.description = input.description.trim();
      if (input.isActive !== undefined) updateData.isActive = input.isActive;
      if (input.isCoreBranch !== undefined) {
        updateData.isCoreBranch = input.isCoreBranch;
        if (input.isCoreBranch && orgId) {
          await seedCompanyCoreCategories(orgId, id);
        }
      }

      const company = await Company.findOneAndUpdate(
        { _id: id, orgId },
        { $set: updateData },
        { new: true }
      );

      if (!company) {
        throw new GraphQLError('Company not found', {
          extensions: { code: 'NOT_FOUND', http: { status: 404 } },
        });
      }

      logActivity({
        orgId,
        userId: context.userId,
        action: 'UPDATE_COMPANY',
        entityType: 'Company',
        entityId: company._id,
        companyId: company._id,
        companyName: company.name,
        description: `Updated company entity "${company.name}"`,
      });

      return company;
    },

    deleteCompany: async (_, { id }, context) => {
      requireOwner(context);
      let orgId = context.orgId;
      if (!orgId && context.userId) {
        const u = await User.findById(context.userId).select('orgId');
        if (u) orgId = u.orgId?.toString();
      }
      const company = await Company.findOne({ _id: id, orgId });
      if (!company) return false;

      await Promise.all([
        Expense.updateMany(
          { orgId, companyId: id, isDeleted: { $ne: true } },
          { $set: { isDeleted: true } }
        ),
        Income.updateMany(
          { orgId, companyId: id, isDeleted: { $ne: true } },
          { $set: { isDeleted: true } }
        ),
        BudgetBucket.deleteMany({ orgId, companyId: id }),
        Category.deleteMany({ orgId, companyId: id }),
      ]);
      await Company.deleteOne({ _id: id, orgId });
      return true;
    },
  },
};

export default companyResolvers;
