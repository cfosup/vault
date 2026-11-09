import mongoose from 'mongoose';

const budgetAlertSentSchema = new mongoose.Schema(
  {
    orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
    bucketId: { type: mongoose.Schema.Types.ObjectId, ref: 'BudgetBucket', required: true },
    periodKey: { type: String, required: true },
  },
  { timestamps: true }
);

budgetAlertSentSchema.index({ bucketId: 1, periodKey: 1 }, { unique: true });

export const BudgetAlertSent = mongoose.model('BudgetAlertSent', budgetAlertSentSchema);
export default BudgetAlertSent;
