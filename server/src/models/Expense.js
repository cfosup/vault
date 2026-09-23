import mongoose from 'mongoose';

const expenseSchema = new mongoose.Schema(
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
      required: [true, 'Expense date is required'],
      default: Date.now,
      index: true,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Category ID is required'],
      index: true,
    },
    categoryName: {
      type: String,
      required: [true, 'Category name is required'],
      trim: true,
    },
    subcategory: {
      type: String,
      default: '',
      trim: true,
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0, 'Amount cannot be negative'],
    },
    vendor: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },
    paymentMethodId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PaymentMethod',
      default: null,
    },
    paymentMethodName: {
      type: String,
      default: '',
      trim: true,
    },
    notes: {
      type: String,
      default: '',
      trim: true,
    },
    budgetBucketId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BudgetBucket',
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
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

expenseSchema.index({ orgId: 1, companyId: 1, date: -1 });
expenseSchema.index({ orgId: 1, isDeleted: 1 });

export const Expense = mongoose.model('Expense', expenseSchema);
export default Expense;
