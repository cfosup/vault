import { GraphQLError } from 'graphql';
import { Company } from '../../models/index.js';
import { requireAuth } from '../../middleware/auth.js';
import { seedCompanyCoreCategories } from '../../services/seedService.js';

export const companyResolvers = {
  Query: {
    companies: async (_, __, context) => {
      requireAuth(context);
      return Company.find({ orgId: context.orgId }).sort({ createdAt: -1 });
    },

    company: async (_, { id }, context) => {
      requireAuth(context);
      const company = await Company.findOne({ _id: id, orgId: context.orgId });
      if (!company) {
        throw new GraphQLError('Company not found', {
          extensions: { code: 'NOT_FOUND', http: { status: 404 } },
        });
      }
      return company;
    },
  },

  Mutation: {
    createCompany: async (_, { input }, context) => {
      requireAuth(context);
      const { name, description, isActive, isCoreBranch } = input;

      if (!name || !name.trim()) {
        throw new GraphQLError('Company name is required.', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      const company = await Company.create({
        orgId: context.orgId,
        name: name.trim(),
        description: (description || '').trim(),
        isActive: isActive !== undefined ? isActive : true,
        isCoreBranch: !!isCoreBranch,
        createdBy: context.userId,
      });

      if (isCoreBranch) {
        await seedCompanyCoreCategories(context.orgId, company._id);
      }

      return company;
    },

    updateCompany: async (_, { id, input }, context) => {
      requireAuth(context);
      const updateData = {};
      if (input.name !== undefined) updateData.name = input.name.trim();
      if (input.description !== undefined) updateData.description = input.description.trim();
      if (input.isActive !== undefined) updateData.isActive = input.isActive;
      if (input.isCoreBranch !== undefined) {
        updateData.isCoreBranch = input.isCoreBranch;
        if (input.isCoreBranch) {
          await seedCompanyCoreCategories(context.orgId, id);
        }
      }

      const company = await Company.findOneAndUpdate(
        { _id: id, orgId: context.orgId },
        { $set: updateData },
        { new: true }
      );

      if (!company) {
        throw new GraphQLError('Company not found', {
          extensions: { code: 'NOT_FOUND', http: { status: 404 } },
        });
      }

      return company;
    },

    deleteCompany: async (_, { id }, context) => {
      requireAuth(context);
      const result = await Company.findOneAndDelete({ _id: id, orgId: context.orgId });
      return !!result;
    },
  },
};

export default companyResolvers;
