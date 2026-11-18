import Customer from '../models/Customer.js';

export function normalizePhone(value = '') {
  const digits = String(value).replace(/\D/g, '');
  // Treat +260 97... and local 097... formats as the same Zambian contact number.
  if (digits.startsWith('260') && digits.length === 12) return '0' + digits.slice(3);
  return digits;
}

export async function upsertCustomer({ fullName, email = '', phone = '', quoteId = null, shipmentId = null, preferredCustomerId = null }) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanPhone = String(phone || '').trim();
  const phoneKey = normalizePhone(cleanPhone);
  let customer = null;
  if (preferredCustomerId) customer = await Customer.findById(preferredCustomerId);
  if (!customer && cleanEmail) customer = await Customer.findOne({ email: cleanEmail });
  if (!customer && phoneKey) customer = await Customer.findOne({ phoneKey });
  if (!customer) customer = new Customer({ fullName: String(fullName || 'Customer').trim().slice(0, 100), email: cleanEmail, phone: cleanPhone, phoneKey });
  if (fullName && String(fullName).trim()) customer.fullName = String(fullName).trim().slice(0, 100);
  if (cleanEmail) customer.email = cleanEmail;
  if (cleanPhone) { customer.phone = cleanPhone; customer.phoneKey = phoneKey; }
  if (quoteId) customer.quoteIds.addToSet(quoteId);
  if (shipmentId) customer.shipmentIds.addToSet(shipmentId);
  customer.lastInteractionAt = new Date();
  await customer.save();
  return customer;
}
