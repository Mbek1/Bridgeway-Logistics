import mongoose from 'mongoose';

const shipmentSchema = new mongoose.Schema({
  trackingNumber: { type: String, required: true, unique: true, index: true },
  quote: { type: mongoose.Schema.Types.ObjectId, ref: 'Quote', default: null, index: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null, index: true },
  enquiryReference: { type: String, trim: true, maxlength: 60, default: '' },
  customerName: { type: String, required: true, trim: true, maxlength: 100 },
  customerPhone: { type: String, trim: true, maxlength: 30, default: '' },
  customerEmail: { type: String, trim: true, lowercase: true, maxlength: 150, default: '' },
  service: { type: String, trim: true, maxlength: 100, default: '' },
  origin: { type: String, required: true, trim: true, maxlength: 160 },
  destination: { type: String, required: true, trim: true, maxlength: 160 },
  cargoDescription: { type: String, required: true, trim: true, maxlength: 500 },
  quantity: { type: String, trim: true, maxlength: 100, default: '' },
  driver: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },
  driverName: { type: String, trim: true, maxlength: 100, default: '' },
  driverPhone: { type: String, trim: true, maxlength: 30, default: '' },
  vehicle: { type: String, trim: true, maxlength: 100, default: '' },
  estimatedDelivery: { type: Date, default: null },
  status: { type: String, enum: ['pending', 'picked_up', 'in_transit', 'at_warehouse', 'out_for_delivery', 'delivered', 'delayed', 'cancelled'], default: 'pending', index: true },
  currentLocation: { type: String, trim: true, maxlength: 160, default: '' },
  deliveryRecipient: { type: String, trim: true, maxlength: 100, default: '' },
  deliveryNotes: { type: String, trim: true, maxlength: 1000, default: '' },
  deliveredAt: { type: Date, default: null },
  createdBy: { type: String, trim: true, maxlength: 150, default: '' },
  updates: [{ status: { type: String, required: true }, location: { type: String, maxlength: 160, default: '' }, note: { type: String, maxlength: 500, default: '' }, actor: { type: String, maxlength: 150, default: '' }, createdAt: { type: Date, default: Date.now } }],
}, { timestamps: true });

export default mongoose.model('Shipment', shipmentSchema);
