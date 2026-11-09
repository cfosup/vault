import mongoose from 'mongoose';

const recurringScheduleSchema = new mongoose.Schema(
  {
    orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    kind: { type: String, enum: ['expense', 'income'], required: true },
    dayOfMonth: { type: Number, required: true, min: 1, max: 31 },
    nextRunAt: { type: Date, required: true, index: true },
    active: { type: Boolean, default: true },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

export const RecurringSchedule = mongoose.model('RecurringSchedule', recurringScheduleSchema);
export default RecurringSchedule;
