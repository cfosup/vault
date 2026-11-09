import mongoose from 'mongoose';

const vendorMemorySchema = new mongoose.Schema(
  {
    orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    subcategory: { type: String, default: '', trim: true },
    name: { type: String, required: true, trim: true },
    useCount: { type: Number, default: 1 },
    lastUsedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

vendorMemorySchema.index({ orgId: 1, categoryId: 1, subcategory: 1, name: 1 }, { unique: true });

export const VendorMemory = mongoose.model('VendorMemory', vendorMemorySchema);
export default VendorMemory;
