import mongoose from 'mongoose';

const inviteSchema = new mongoose.Schema(
  {
    orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    tokenHash: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
    acceptedAt: { type: Date, default: null },
    accessScope: { type: String, enum: ['workspace', 'modules'], default: 'modules' },
    modules: { type: [String], default: [] },
    companyIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Company' }],
    canDeleteExpenses: { type: Boolean, default: false },
    canDeleteIncome: { type: Boolean, default: false },
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const Invite = mongoose.model('Invite', inviteSchema);
export default Invite;
