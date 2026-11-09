import mongoose from 'mongoose';

const reportDispatchSchema = new mongoose.Schema(
  {
    orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
    kind: { type: String, enum: ['weekly', 'monthly'], required: true },
    periodKey: { type: String, required: true },
  },
  { timestamps: true }
);

reportDispatchSchema.index({ orgId: 1, kind: 1, periodKey: 1 }, { unique: true });

export const ReportDispatch = mongoose.model('ReportDispatch', reportDispatchSchema);
export default ReportDispatch;
