import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    orgId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization ID is required'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'User name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: false,
      default: null,
    },
    firebaseUid: {
      type: String,
      sparse: true,
      index: true,
    },
    authProvider: {
      type: String,
      enum: ['local', 'google', 'firebase'],
      default: 'local',
    },
    avatarUrl: {
      type: String,
      default: null,
    },
    role: {
      type: String,
      enum: ['superadmin', 'owner', 'admin', 'member'],
      default: 'owner',
    },
    lastLogin: {
      type: Date,
      default: null,
    },
    isEmailVerified: {
      type: Boolean,
      default: true,
    },
    passwordResetToken: {
      type: String,
      default: null,
    },
    passwordResetExpires: {
      type: Date,
      default: null,
    },
    accessScope: {
      type: String,
      enum: ['workspace', 'modules'],
    },
    modules: {
      type: [String],
      default: undefined,
    },
    companyIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
      },
    ],
    canDeleteExpenses: {
      type: Boolean,
      default: false,
    },
    canDeleteIncome: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

export const User = mongoose.model('User', userSchema);
export default User;
