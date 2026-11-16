import mongoose from 'mongoose';

const quoteSchema = new mongoose.Schema(
  {
    reference: { type: String, required: true, unique: true, index: true },
    fullName: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, trim: true, lowercase: true, maxlength: 150, default: '' },
    phone: { type: String, required: true, trim: true, maxlength: 30 },
    service: { type: String, required: true, trim: true, maxlength: 100 },
    pickupLocation: { type: String, required: true, trim: true, maxlength: 160 },
    deliveryLocation: { type: String, required: true, trim: true, maxlength: 160 },
    cargoDescription: { type: String, required: true, trim: true, maxlength: 250 },
    quantity: { type: String, trim: true, maxlength: 100, default: '' },
    preferredDate: { type: String, trim: true, default: '' },
    message: { type: String, trim: true, maxlength: 1500, default: '' },
    internalNotes: { type: String, trim: true, maxlength: 3000, default: '' },
    status: {
      type: String,
      enum: ['new', 'contacted', 'quoted', 'closed'],
      default: 'new',
      index: true,
    },
  },
  { timestamps: true },
);

export default mongoose.model('Quote', quoteSchema);
