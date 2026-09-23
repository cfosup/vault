import mongoose from 'mongoose';

const paymentMethodSchema = new mongoose.Schema(
  {
    orgId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization ID is required'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Payment method name is required'],
      trim: true,
    },
    type: {
      type: String,
      enum: ['cash', 'bank', 'card', 'upi', 'other'],
      default: 'bank',
    },
    accountNumber: {
      type: String,
      default: '',
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

paymentMethodSchema.index({ orgId: 1, name: 1 });

export const PaymentMethod = mongoose.model('PaymentMethod', paymentMethodSchema);
export default PaymentMethod;
