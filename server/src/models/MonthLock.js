import mongoose from 'mongoose';

const monthLockSchema = new mongoose.Schema(
  {
    orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    year: { type: Number, required: true },
    month: { type: Number, required: true, min: 1, max: 12 },
    lockedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

monthLockSchema.index({ orgId: 1, year: 1, month: 1 }, { unique: true });

export const MonthLock = mongoose.model('MonthLock', monthLockSchema);
export default MonthLock;
