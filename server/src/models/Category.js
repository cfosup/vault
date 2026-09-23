import mongoose from 'mongoose';

const subcategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    items: [
      {
        type: String,
        trim: true,
      },
    ],
    isCustom: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

const categorySchema = new mongoose.Schema(
  {
    orgId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      default: null,
      index: true,
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      default: null,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Category name is required'],
      trim: true,
    },
    group: {
      type: String,
      trim: true,
      default: '',
    },
    groupLabel: {
      type: String,
      trim: true,
      default: '',
    },
    subcategories: [subcategorySchema],
    isGlobal: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

categorySchema.index({ orgId: 1, name: 1 });
categorySchema.index({ orgId: 1, companyId: 1, name: 1 });

export const Category = mongoose.model('Category', categorySchema);
export default Category;
