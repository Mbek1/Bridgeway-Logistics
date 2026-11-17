import mongoose from 'mongoose';

const employeeSchema = new mongoose.Schema({
  fullName: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 150, unique: true, index: true },
  phone: { type: String, trim: true, maxlength: 30, default: '' },
  jobTitle: { type: String, trim: true, maxlength: 100, default: '' },
  department: { type: String, trim: true, maxlength: 100, default: '' },
  role: { type: String, enum: ['manager', 'operations', 'sales', 'viewer'], default: 'viewer' },
  passwordHash: { type: String, required: true, select: false },
  active: { type: Boolean, default: true, index: true },
  createdBy: { type: String, trim: true, maxlength: 150, default: '' },
  lastLoginAt: { type: Date, default: null },
}, { timestamps: true });

export default mongoose.model('Employee', employeeSchema);
