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
    quotation: {
      reference: { type: String, trim: true, maxlength: 60, default: '' },
      amount: { type: Number, min: 0, default: 0 },
      currency: { type: String, enum: ['ZMW'], default: 'ZMW' },
      description: { type: String, trim: true, maxlength: 3000, default: '' },
      terms: { type: String, trim: true, maxlength: 3000, default: '' },
      validUntil: { type: Date, default: null },
      status: { type: String, enum: ['draft', 'issued', 'accepted', 'rejected', 'expired'], default: 'draft' },
      issuedAt: { type: Date, default: null },
    },
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
