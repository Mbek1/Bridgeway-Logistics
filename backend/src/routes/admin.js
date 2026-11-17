import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import Quote from '../models/Quote.js';

const router = Router();
const TOKEN_TTL = 8 * 60 * 60;

function equalSecret(a, b) {
  const left = Buffer.from(String(a || ''), 'utf8');
  const right = Buffer.from(String(b || ''), 'utf8');
  return left.length > 0 && left.length === right.length && timingSafeEqual(left, right);
}
function makeToken(payload) {
  const head = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const input = head + '.' + body;
  return input + '.' + createHmac('sha256', process.env.JWT_SECRET).update(input).digest('base64url');
}
function requireAdmin(req, res, next) {
  try {
    const token = (req.get('authorization') || '').replace(/^Bearer\s+/, '');
    const parts = token.split('.');
    if (!process.env.JWT_SECRET || parts.length !== 3) return res.status(401).json({ message: 'Please sign in to access the dashboard.' });
    const input = parts[0] + '.' + parts[1];
    const signature = createHmac('sha256', process.env.JWT_SECRET).update(input).digest('base64url');
    if (!equalSecret(parts[2], signature)) return res.status(401).json({ message: 'Your session is invalid. Please sign in again.' });
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (payload.exp <= Math.floor(Date.now() / 1000) || payload.email !== (process.env.ADMIN_EMAIL || '').trim().toLowerCase()) {
      return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
    }
    req.admin = { email: payload.email };
    return next();
  } catch {
    return res.status(401).json({ message: 'Your session is invalid. Please sign in again.' });
  }
}

router.post('/login', (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || '';
  if (!process.env.JWT_SECRET || !adminEmail || !adminPassword) {
    return res.status(503).json({ message: 'Admin login is not configured on the server.' });
  }
  if (!equalSecret(email, adminEmail) || !equalSecret(password, adminPassword)) {
    return res.status(401).json({ message: 'Incorrect email or password.' });
  }
  const now = Math.floor(Date.now() / 1000);
  return res.json({ token: makeToken({ email: adminEmail, iat: now, exp: now + TOKEN_TTL }), expiresIn: TOKEN_TTL, email: adminEmail });
});

router.get('/stats', requireAdmin, async (_req, res, next) => {
  try {
    const [total, newRequests, pendingQuotations, closedRequests, issuedQuotations] = await Promise.all([
      Quote.countDocuments({}), Quote.countDocuments({ status: 'new' }),
      Quote.countDocuments({ status: { $in: ['new', 'contacted'] } }), Quote.countDocuments({ status: 'closed' }),
      Quote.countDocuments({ 'quotation.status': 'issued' }),
    ]);
    const start = new Date(); start.setMonth(start.getMonth() - 5, 1); start.setHours(0, 0, 0, 0);
    const monthlyReports = await Quote.aggregate([
      { $match: { createdAt: { $gte: start } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt', timezone: 'Africa/Lusaka' } }, enquiries: { $sum: 1 }, quotationsIssued: { $sum: { $cond: [{ $eq: ['$quotation.status', 'issued'] }, 1, 0] } } } },
      { $sort: { _id: 1 } },
    ]);
    return res.json({ total, newRequests, pendingQuotations, closedRequests, issuedQuotations, quotationIssueRate: total ? Math.round(issuedQuotations / total * 100) : 0, monthlyReports });
  } catch (error) { return next(error); }
});

router.get('/quotes', requireAdmin, async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 100, 1), 200);
    const filter = {};
    const status = String(req.query.status || '');
    const search = String(req.query.search || '').trim();
    if (['new', 'contacted', 'quoted', 'closed'].includes(status)) filter.status = status;
    if (search) {
      const safe = search.replace(/[.*+?^()|[\]\\]/g, '\\$&');
      filter.$or = ['fullName', 'email', 'phone', 'reference', 'service', 'pickupLocation', 'deliveryLocation']
        .map((field) => ({ [field]: { $regex: safe, $options: 'i' } }));
    }
    const [quotes, total] = await Promise.all([
      Quote.find(filter).sort({ createdAt: -1 }).limit(limit).select('-__v +quotation.publicToken').lean(),
      Quote.countDocuments(filter),
    ]);
    return res.json({ total, count: quotes.length, quotes });
  } catch (error) { return next(error); }
});

router.patch('/quotes/:id', requireAdmin, async (req, res, next) => {
  try {
    const quote = await Quote.findById(req.params.id);
    if (!quote) return res.status(404).json({ message: 'Quote request not found.' });
    const events = [];
    if (req.body?.status !== undefined) {
      if (!['new', 'contacted', 'quoted', 'closed'].includes(req.body.status)) return res.status(400).json({ message: 'Please select a valid quote status.' });
      if (quote.status !== req.body.status) { events.push({ action: 'request_status_changed', details: 'Request status changed from ' + quote.status + ' to ' + req.body.status + '.', actor: req.admin.email }); quote.status = req.body.status; }
    }
    if (req.body?.internalNotes !== undefined) {
      if (typeof req.body.internalNotes !== 'string' || req.body.internalNotes.length > 3000) return res.status(400).json({ message: 'Internal notes must be 3,000 characters or fewer.' });
      if (quote.internalNotes !== req.body.internalNotes.trim()) events.push({ action: 'internal_notes_updated', details: 'Internal notes were updated.', actor: req.admin.email });
      quote.internalNotes = req.body.internalNotes.trim();
    }
    if (req.body?.status === undefined && req.body?.internalNotes === undefined) return res.status(400).json({ message: 'No valid changes were supplied.' });
    if (events.length) quote.activityLog.push(...events);
    await quote.save(); return res.json({ quote });
  } catch (error) { return next(error); }
});


function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
function quotationUrl(token) {
  const origin = (process.env.CLIENT_URL || '').split(',')[0].trim().replace(/\/$/, '');
  return origin ? origin + '/#/quotation/' + token : '';
}
async function sendQuotationEmail(quote) {
  if (!quote.email) return { status: 'no_email', error: 'Customer did not provide an email address.' };
  if (!process.env.RESEND_API_KEY || !process.env.FROM_EMAIL) return { status: 'not_configured', error: 'Configure RESEND_API_KEY and FROM_EMAIL in Render.' };
  const q = quote.quotation;
  const money = new Intl.NumberFormat('en-ZM', { style: 'currency', currency: 'ZMW' }).format(q.amount);
  const url = quotationUrl(q.publicToken);
  const s = { name: escapeHtml(quote.fullName), ref: escapeHtml(q.reference), enquiry: escapeHtml(quote.reference), service: escapeHtml(quote.service), pickup: escapeHtml(quote.pickupLocation), delivery: escapeHtml(quote.deliveryLocation), amount: escapeHtml(money), description: escapeHtml(q.description), terms: escapeHtml(q.terms || 'As discussed with our team.'), expiry: escapeHtml(new Date(q.validUntil).toLocaleDateString('en-ZM')), url: escapeHtml(url) };
  const textBody = ['Dear ' + quote.fullName + ',', '', 'Your Bridgeway Logistics quotation is ready.', 'Quotation reference: ' + q.reference, 'Enquiry reference: ' + quote.reference, 'Service: ' + quote.service, 'Route: ' + quote.pickupLocation + ' to ' + quote.deliveryLocation, 'Amount: ' + money, 'Services included: ' + q.description, 'Terms: ' + (q.terms || 'As discussed with our team.'), 'Valid until: ' + new Date(q.validUntil).toLocaleDateString('en-ZM'), url ? 'View your quotation: ' + url : '', '', 'Kind regards, Bridgeway Logistics'].filter(Boolean).join('\n');
  const html = '<!doctype html><html><body style="margin:0;padding:28px;background:#f2f5f6;font-family:Arial,sans-serif;color:#193247"><div style="max-width:620px;margin:auto;background:#fff;border:1px solid #e4e9ec"><header style="padding:26px 30px;background:#091c2c;color:#fff;border-bottom:5px solid #f28a35"><b style="font-size:20px">BRIDGEWAY LOGISTICS</b><p style="font-size:11px;color:#c6d1d8">YOUR QUOTATION IS READY</p></header><main style="padding:30px"><p>Dear ' + s.name + ',</p><p>Thank you for your enquiry. Your quotation is ready.</p><div style="padding:18px;background:#f5f7f8;border-left:4px solid #f28a35"><small>QUOTATION REFERENCE</small><h2>' + s.ref + '</h2><p><b>Service:</b> ' + s.service + '<br><b>Route:</b> ' + s.pickup + ' → ' + s.delivery + '<br><b>Amount:</b> ' + s.amount + '<br><b>Valid until:</b> ' + s.expiry + '</p></div><h3>Services included</h3><p style="white-space:pre-line;line-height:1.7">' + s.description + '</p><h3>Terms and conditions</h3><p style="white-space:pre-line;line-height:1.7">' + s.terms + '</p>' + (url ? '<p style="margin:28px 0"><a href="' + s.url + '" style="display:inline-block;padding:14px 20px;background:#f28a35;color:#10283b;text-decoration:none;font-weight:bold">View quotation</a></p><p style="font-size:11px">If the button does not work, copy this link: <a href="' + s.url + '">' + s.url + '</a></p>' : '') + '<p>Kind regards,<br><b>Bridgeway Logistics</b></p></main><footer style="padding:16px 30px;background:#f5f7f8;font-size:11px;color:#75838d">Regarding enquiry ' + s.enquiry + '.</footer></div></body></html>';
  const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: process.env.FROM_EMAIL, to: [quote.email], subject: 'Bridgeway Logistics quotation ' + q.reference, text: textBody, html }) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) return { status: 'failed', error: String(result.message || 'Email provider rejected the request.').slice(0, 500) };
  return { status: 'sent', error: '', messageId: result.id || '' };
}

router.patch('/quotes/:id/quotation', requireAdmin, async (req, res, next) => {
  try {
    const input = req.body?.quotation;
    if (!input || typeof input !== 'object') return res.status(400).json({ message: 'Quotation details are required.' });
    const amount = Number(input.amount);
    const description = typeof input.description === 'string' ? input.description.trim() : '';
    const terms = typeof input.terms === 'string' ? input.terms.trim() : '';
    const validUntil = input.validUntil ? new Date(input.validUntil) : null;
    const status = input.status === 'issued' ? 'issued' : 'draft';
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ message: 'Enter a quotation amount greater than zero.' });
    if (!description || description.length > 3000) return res.status(400).json({ message: 'Add a description of the services covered (up to 3,000 characters).' });
    if (!validUntil || Number.isNaN(validUntil.getTime())) return res.status(400).json({ message: 'Choose a valid quotation expiry date.' });
    if (validUntil < new Date(new Date().toDateString())) return res.status(400).json({ message: 'The validity date cannot be in the past.' });
    if (terms.length > 3000) return res.status(400).json({ message: 'Terms must be 3,000 characters or fewer.' });
    const quote = await Quote.findById(req.params.id).select('+quotation.publicToken');
    if (!quote) return res.status(404).json({ message: 'Quote request not found.' });
    const previous = quote.quotation?.reference ? quote.quotation.toObject() : null;
    const ref = typeof input.reference === 'string' && input.reference.trim() ? input.reference.trim().slice(0, 60) : (quote.quotation?.reference || 'BWQ-' + Date.now().toString(36).toUpperCase());
    const shouldSendEmail = status === 'issued' && (quote.quotation?.status !== 'issued' || quote.quotation?.emailStatus !== 'sent' || quote.quotation?.reference !== ref || Number(quote.quotation?.amount) !== amount || quote.quotation?.description !== description || quote.quotation?.terms !== terms || new Date(quote.quotation?.validUntil || 0).getTime() !== validUntil.getTime());
    const wasIssued = quote.quotation?.status === 'issued';
    const publicToken = quote.quotation?.publicToken || (status === 'issued' ? randomBytes(32).toString('hex') : '');
    quote.quotation = { reference: ref, amount, currency: 'ZMW', description, terms, validUntil, status, issuedAt: status === 'issued' ? (quote.quotation?.issuedAt || new Date()) : (quote.quotation?.issuedAt || null), emailStatus: shouldSendEmail ? 'not_sent' : (quote.quotation?.emailStatus || 'not_sent'), emailSentAt: quote.quotation?.emailSentAt || null, emailError: '', publicToken };
    if (status === 'issued') quote.status = 'quoted';
    if (previous) quote.quotationHistory.push({ ...previous, savedAt: new Date() });
    quote.activityLog.push({ action: wasIssued ? 'quotation_updated' : (status === 'issued' ? 'quotation_issued' : 'quotation_draft_saved'), details: wasIssued ? 'Quotation ' + ref + ' was revised.' : (status === 'issued' ? 'Quotation ' + ref + ' was issued.' : 'Quotation draft was saved.'), actor: req.admin.email });
    await quote.save();
    let email = { status: quote.quotation.emailStatus, error: quote.quotation.emailError };
    if (shouldSendEmail) { email = await sendQuotationEmail(quote); quote.quotation.emailStatus = email.status; quote.quotation.emailError = email.error; if (email.status === 'sent') quote.quotation.emailSentAt = new Date(); await quote.save(); }
    return res.json({ quote: quote.toObject(), email, quotationUrl: quote.quotation.publicToken ? quotationUrl(quote.quotation.publicToken) : '' });
  } catch (error) { return next(error); }
});

export default router;
