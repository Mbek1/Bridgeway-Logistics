import { randomBytes, timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import Quote from '../models/Quote.js';

const router = Router();

const requiredFields = [
  'fullName',
  'phone',
  'service',
  'pickupLocation',
  'deliveryLocation',
  'cargoDescription',
];

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

router.post('/', async (req, res, next) => {
  try {
    const payload = {};
    for (const field of [
      ...requiredFields,
      'email',
      'quantity',
      'preferredDate',
      'message',
    ]) {
      payload[field] = cleanString(req.body?.[field]);
    }

    const missing = requiredFields.filter((field) => !payload[field]);
    if (missing.length) {
      return res.status(400).json({
        message: `Please complete all required fields: ${missing.join(', ')}.`,
      });
    }

    const maxLengths = {
      fullName: 100,
      phone: 30,
      service: 100,
      pickupLocation: 160,
      deliveryLocation: 160,
      cargoDescription: 250,
      email: 150,
      quantity: 100,
      message: 1500,
    };
    for (const [field, max] of Object.entries(maxLengths)) {
      if (payload[field].length > max) {
        return res.status(400).json({ message: `${field} exceeds the maximum allowed length.` });
      }
    }

    if (payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
      return res.status(400).json({ message: 'Please provide a valid email address.' });
    }

    if (payload.preferredDate && !/^\d{4}-\d{2}-\d{2}$/.test(payload.preferredDate)) {
      return res.status(400).json({ message: 'Please provide a valid preferred date.' });
    }

    const reference = `BW-${Date.now().toString(36).toUpperCase()}-${randomBytes(2).toString('hex').toUpperCase()}`;
    const quote = await Quote.create({ ...payload, reference });

    return res.status(201).json({
      message: 'Your quote request has been received.',
      reference: quote.reference,
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/quotation/:token', async (req, res, next) => {
  try {
    const token = String(req.params.token || '');
    if (!/^[a-f0-9]{64}$/.test(token)) return res.status(404).json({ message: 'This quotation link is invalid or unavailable.' });
    const quote = await Quote.findOne({ 'quotation.publicToken': token, 'quotation.status': 'issued' });
    if (!quote || !quote.quotation || !quote.quotation.validUntil || quote.quotation.validUntil < new Date()) return res.status(404).json({ message: 'This quotation link is unavailable or has expired. Please contact Bridgeway Logistics.' });
    return res.json({ quotation: { reference: quote.quotation.reference, enquiryReference: quote.reference, customerName: quote.fullName, service: quote.service, pickupLocation: quote.pickupLocation, deliveryLocation: quote.deliveryLocation, amount: quote.quotation.amount, currency: quote.quotation.currency, description: quote.quotation.description, terms: quote.quotation.terms, validUntil: quote.quotation.validUntil, issuedAt: quote.quotation.issuedAt } });
  } catch (error) { return next(error); }
});

// Internal review endpoint. Protect it with a strong server-side API key.
router.get('/', async (req, res, next) => {
  try {
    const providedKey = req.get('x-admin-key');
    const configuredKey = process.env.ADMIN_API_KEY;
    const supplied = Buffer.from(providedKey || '', 'utf8');
    const expected = Buffer.from(configuredKey || '', 'utf8');
    const authorised = expected.length > 0 && supplied.length === expected.length && timingSafeEqual(supplied, expected);
    if (!authorised) {
      return res.status(401).json({ message: 'Unauthorised.' });
    }

    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 50, 1), 200);
    const quotes = await Quote.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('-__v')
      .lean();

    return res.json({ count: quotes.length, quotes });
  } catch (error) {
    return next(error);
  }
});

export default router;
