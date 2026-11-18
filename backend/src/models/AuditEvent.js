import mongoose from 'mongoose';

const auditEventSchema = new mongoose.Schema({
  actor: { type: String, trim: true, maxlength: 150, default: '' },
  actorName: { type: String, trim: true, maxlength: 150, default: '' },
  action: { type: String, required: true, trim: true, maxlength: 80 },
  details: { type: String, trim: true, maxlength: 1000, default: '' },
  entityType: { type: String, enum: ['employee', 'shipment', 'enquiry', 'system'], default: 'system', index: true },
  entityId: { type: String, trim: true, maxlength: 100, default: '' },
}, { timestamps: true });

auditEventSchema.index({ createdAt: -1 });

export default mongoose.model('AuditEvent', auditEventSchema);
