import { GraphQLError } from 'graphql';
import { PaymentMethod } from '../../models/index.js';
import { requireAuth } from '../../middleware/auth.js';
import { accessOf, loadActor } from '../../utils/access.js';

async function requirePaymentWriter(context) {
  const access = accessOf(await loadActor(context));
  if (!access.canWrite) {
    throw new GraphQLError('You do not have permission to change payment accounts.', {
      extensions: { code: 'FORBIDDEN', http: { status: 403 } },
    });
  }
  return access;
}

export const paymentMethodResolvers = {
  Query: {
    paymentMethods: async (_, __, context) => {
      requireAuth(context);
      return PaymentMethod.find({ orgId: context.orgId }).sort({ name: 1 });
    },

    paymentMethod: async (_, { id }, context) => {
      requireAuth(context);
      const pm = await PaymentMethod.findOne({ _id: id, orgId: context.orgId });
      if (!pm) {
        throw new GraphQLError('Payment method not found', {
          extensions: { code: 'NOT_FOUND', http: { status: 404 } },
        });
      }
      return pm;
    },
  },

  Mutation: {
    createPaymentMethod: async (_, { input }, context) => {
      await requirePaymentWriter(context);
      const actor = await loadActor(context);
      const { name, type, accountNumber, isActive } = input;

      if (!name || !name.trim()) {
        throw new GraphQLError('Payment method name is required.', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      return PaymentMethod.create({
        orgId: context.orgId,
        name: name.trim(),
        type: type || 'bank',
        accountNumber: (accountNumber || '').trim(),
        isActive: isActive !== undefined ? isActive : true,
        createdBy: actor._id,
        createdByName: actor.name || actor.email || '',
      });
    },

    updatePaymentMethod: async (_, { id, input }, context) => {
      await requirePaymentWriter(context);
      const updateData = {};
      if (input.name !== undefined) updateData.name = input.name.trim();
      if (input.type !== undefined) updateData.type = input.type;
      if (input.accountNumber !== undefined) updateData.accountNumber = input.accountNumber.trim();
      if (input.isActive !== undefined) updateData.isActive = input.isActive;

      const pm = await PaymentMethod.findOneAndUpdate(
        { _id: id, orgId: context.orgId },
        { $set: updateData },
        { new: true }
      );

      if (!pm) {
        throw new GraphQLError('Payment method not found', {
          extensions: { code: 'NOT_FOUND', http: { status: 404 } },
        });
      }

      return pm;
    },

    deletePaymentMethod: async (_, { id }, context) => {
      await requirePaymentWriter(context);
      const result = await PaymentMethod.findOneAndDelete({ _id: id, orgId: context.orgId });
      return !!result;
    },
  },
};

export default paymentMethodResolvers;
