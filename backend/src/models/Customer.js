import mongoose from 'mongoose';

const customerSchema = new mongoose.Schema({
  fullName: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, trim: true, lowercase: true, maxlength: 150, default: '', index: true },
  phone: { type: String, trim: true, maxlength: 30, default: '' },
  phoneKey: { type: String, trim: true, index: true, default: '' },
  quoteIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Quote' }],
  shipmentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Shipment' }],
  lastInteractionAt: { type: Date, default: Date.now, index: true },
}, { timestamps: true });

export default mongoose.model('Customer', customerSchema);
