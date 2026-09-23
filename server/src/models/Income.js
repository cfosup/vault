import mongoose from 'mongoose';

const incomeSchema = new mongoose.Schema(
  {
    orgId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization ID is required'],
      index: true,
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: [true, 'Company ID is required'],
      index: true,
    },
    date: {
      type: Date,
      required: [true, 'Income date is required'],
      default: Date.now,
      index: true,
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0, 'Amount cannot be negative'],
    },
    source: {
      type: String,
      required: [true, 'Source is required'],
      trim: true,
    },
    notes: {
      type: String,
      default: '',
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

incomeSchema.index({ orgId: 1, companyId: 1, date: -1 });
incomeSchema.index({ orgId: 1, isDeleted: 1 });

export const Income = mongoose.model('Income', incomeSchema);
export default Income;
