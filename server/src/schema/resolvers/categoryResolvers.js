import mongoose from 'mongoose';
import { GraphQLError } from 'graphql';
import { Category } from '../../models/index.js';
import { requireAuth } from '../../middleware/auth.js';
import { seedCompanyCoreCategories } from '../../services/seedService.js';

export const categoryResolvers = {
  Query: {
    categories: async (_, { companyId }, context) => {
      if (companyId) {
        const compObjectId = new mongoose.Types.ObjectId(companyId);
        // Look for company-specific categories first
        const companyCategories = await Category.find({
          orgId: context?.orgId || null,
          companyId: compObjectId,
        }).sort({ group: 1, name: 1 });

        if (companyCategories && companyCategories.length > 0) {
          return companyCategories;
        }

        // If no company-specific categories exist yet, return global templates
        return Category.find({ isGlobal: true }).sort({ group: 1, name: 1 });
      }

      // No companyId given: return global categories + any custom categories without companyId
      const filter = context?.orgId
        ? { $or: [{ isGlobal: true }, { orgId: context.orgId, companyId: null }] }
        : { isGlobal: true };

      return Category.find(filter).sort({ group: 1, name: 1 });
    },

    category: async (_, { id }, context) => {
      const category = await Category.findOne({
        _id: id,
        $or: [{ isGlobal: true }, { orgId: context?.orgId || null }],
      });

      if (!category) {
        throw new GraphQLError('Category not found', {
          extensions: { code: 'NOT_FOUND', http: { status: 404 } },
        });
      }
      return category;
    },
  },

  Mutation: {
    createCategory: async (_, { input }, context) => {
      requireAuth(context);
      const { companyId, name, group, groupLabel, subcategories } = input;

      if (!name || !name.trim()) {
        throw new GraphQLError('Category name is required.', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      const cleanGroup = (group || 'O').trim().toUpperCase();
      const cleanGroupLabel = (groupLabel || `${cleanGroup} — General`).trim();

      return Category.create({
        orgId: context.orgId,
        companyId: companyId ? new mongoose.Types.ObjectId(companyId) : null,
        name: name.trim(),
        group: cleanGroup,
        groupLabel: cleanGroupLabel,
        subcategories: (subcategories || []).map((sub) => ({
          name: sub.name.trim(),
          items: sub.items || [],
          isCustom: true,
        })),
        isGlobal: false,
      });
    },

    updateCategory: async (_, { id, input }, context) => {
      requireAuth(context);
      const updateData = {};
      if (input.name !== undefined) updateData.name = input.name.trim();
      if (input.group !== undefined) updateData.group = input.group.trim().toUpperCase();
      if (input.groupLabel !== undefined) updateData.groupLabel = input.groupLabel.trim();
      if (input.subcategories !== undefined) {
        updateData.subcategories = input.subcategories.map((sub) => ({
          name: sub.name.trim(),
          items: sub.items || [],
          isCustom: true,
        }));
      }

      const category = await Category.findOneAndUpdate(
        { _id: id, orgId: context.orgId },
        { $set: updateData },
        { new: true }
      );

      if (!category) {
        throw new GraphQLError('Category not found', {
          extensions: { code: 'NOT_FOUND', http: { status: 404 } },
        });
      }

      return category;
    },

    deleteCategory: async (_, { id }, context) => {
      requireAuth(context);
      const result = await Category.findOneAndDelete({ _id: id, orgId: context.orgId });
      return !!result;
    },

    deleteCategorySection: async (_, { companyId, group }, context) => {
      requireAuth(context);
      const compObjectId = new mongoose.Types.ObjectId(companyId);
      const cleanGroup = group.trim().toUpperCase();

      await Category.deleteMany({
        orgId: context.orgId,
        companyId: compObjectId,
        group: cleanGroup,
      });

      return true;
    },

    resetCompanyCategoriesToCore: async (_, { companyId }, context) => {
      requireAuth(context);
      const compObjectId = new mongoose.Types.ObjectId(companyId);

      // Remove existing custom categories for this company
      await Category.deleteMany({
        orgId: context.orgId,
        companyId: compObjectId,
      });

      // Seed core categories
      await seedCompanyCoreCategories(context.orgId, compObjectId);

      return Category.find({
        orgId: context.orgId,
        companyId: compObjectId,
      }).sort({ group: 1, name: 1 });
    },

    addSubcategory: async (_, { categoryId, subcategoryName, items }, context) => {
      requireAuth(context);

      let category = await Category.findOne({
        _id: categoryId,
        $or: [{ isGlobal: true }, { orgId: context.orgId }],
      });

      if (!category) {
        throw new GraphQLError('Category not found', {
          extensions: { code: 'NOT_FOUND', http: { status: 404 } },
        });
      }

      // If category is global, create a company-level copy or org-level copy if needed
      category.subcategories.push({
        name: subcategoryName.trim(),
        items: items || [],
        isCustom: true,
      });

      await category.save();
      return category;
    },

    updateSubcategoryItems: async (_, { categoryId, subcategoryName, items }, context) => {
      requireAuth(context);

      const category = await Category.findOne({
        _id: categoryId,
        $or: [{ isGlobal: true }, { orgId: context.orgId }],
      });

      if (!category) {
        throw new GraphQLError('Category not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      const sub = category.subcategories.find(
        (s) => s.name.toLowerCase() === subcategoryName.toLowerCase()
      );
      if (!sub) {
        throw new GraphQLError(`Subcategory "${subcategoryName}" not found`, {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      sub.items = items;
      await category.save();
      return category;
    },

    deleteSubcategory: async (_, { categoryId, subcategoryName }, context) => {
      requireAuth(context);

      const category = await Category.findOne({
        _id: categoryId,
        $or: [{ isGlobal: true }, { orgId: context.orgId }],
      });

      if (!category) {
        throw new GraphQLError('Category not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      category.subcategories = category.subcategories.filter(
        (s) => s.name.toLowerCase() !== subcategoryName.toLowerCase()
      );

      await category.save();
      return category;
    },
  },
};

export default categoryResolvers;
