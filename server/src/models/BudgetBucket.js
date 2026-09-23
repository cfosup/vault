import mongoose from 'mongoose';

const subcatBudgetSchema = new mongoose.Schema(
  {
    subcategory: {
      type: String,
      required: true,
      trim: true,
    },
    limitAmount: {
      type: Number,
      required: true,
      min: [0, 'Subcategory limit cannot be negative'],
    },
  },
  { _id: false }
);

const budgetBucketSchema = new mongoose.Schema(
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
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Category ID is required'],
    },
    categoryName: {
      type: String,
      required: [true, 'Category name is required'],
      trim: true,
    },
    name: {
      type: String,
      required: [true, 'Budget bucket name is required'],
      trim: true,
    },
    limitAmount: {
      type: Number,
      required: [true, 'Limit amount is required'],
      min: [0, 'Limit amount cannot be negative'],
    },
    period: {
      type: String,
      enum: ['monthly', 'quarterly', 'yearly', 'custom'],
      default: 'monthly',
    },
    startDate: {
      type: Date,
      default: null,
    },
    endDate: {
      type: Date,
      default: null,
    },
    alertThreshold: {
      type: Number,
      default: 80,
      min: [1, 'Alert threshold must be at least 1%'],
      max: [100, 'Alert threshold cannot exceed 100%'],
    },
    subcatBudgets: {
      type: [subcatBudgetSchema],
      default: [],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

budgetBucketSchema.index({ orgId: 1, companyId: 1 });
budgetBucketSchema.index({ companyId: 1, categoryId: 1 });

export const BudgetBucket = mongoose.model('BudgetBucket', budgetBucketSchema);
export default BudgetBucket;
