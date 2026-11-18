import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import mongoose from 'mongoose';
import Quote from '../models/Quote.js';
import Employee from '../models/Employee.js';
import Shipment from '../models/Shipment.js';
import AuditEvent from '../models/AuditEvent.js';
import Customer from '../models/Customer.js';
import { upsertCustomer } from '../utils/customer.js';
import { sendCustomerNotification } from '../utils/customerNotification.js';

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
async function requireAuth(req, res, next) {
  try {
    const token = (req.get('authorization') || '').replace(/^Bearer\s+/, '');
    const parts = token.split('.');
    if (!process.env.JWT_SECRET || parts.length !== 3) return res.status(401).json({ message: 'Please sign in to access the dashboard.' });
    const input = parts[0] + '.' + parts[1];
    const signature = createHmac('sha256', process.env.JWT_SECRET).update(input).digest('base64url');
    if (!equalSecret(parts[2], signature)) return res.status(401).json({ message: 'Your session is invalid. Please sign in again.' });
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (!payload.exp || payload.exp <= Math.floor(Date.now() / 1000)) return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
    if (payload.role === 'admin' && payload.email === (process.env.ADMIN_EMAIL || '').trim().toLowerCase()) {
      req.admin = { email: payload.email, role: 'admin' };
      return next();
    }
    if (payload.role === 'employee' && payload.employeeId) {
      const employee = await Employee.findById(payload.employeeId).select('fullName email role active');
      if (!employee || !employee.active || employee.email !== payload.email) return res.status(401).json({ message: 'This employee account is inactive or unavailable.' });
      req.admin = { email: employee.email, name: employee.fullName, role: employee.role, employeeId: String(employee._id) };
      return next();
    }
    return res.status(401).json({ message: 'Your session is invalid. Please sign in again.' });
  } catch {
    return res.status(401).json({ message: 'Your session is invalid. Please sign in again.' });
  }
}
function requireRoles(...roles) {
  return (req, res, next) => roles.includes(req.admin?.role) ? next() : res.status(403).json({ message: 'Your account does not have permission to perform this action.' });
}
function passwordHash(password) {
  const salt = randomBytes(16).toString('hex');
  return salt + ':' + scryptSync(password, salt, 64).toString('hex');
}
function passwordMatches(password, stored) {
  const [salt, hash] = String(stored || '').split(':');
  if (!salt || !hash) return false;
  return equalSecret(scryptSync(password, salt, 64).toString('hex'), hash);
}
const EMPLOYEE_ROLES = ['manager', 'operations', 'sales', 'viewer'];

router.post('/login', async (req, res, next) => {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    const adminPassword = process.env.ADMIN_PASSWORD || '';
    if (!process.env.JWT_SECRET) return res.status(503).json({ message: 'Authentication is not configured on the server.' });
    const now = Math.floor(Date.now() / 1000);
    if (adminEmail && adminPassword && equalSecret(email, adminEmail) && equalSecret(password, adminPassword)) {
      return res.json({ token: makeToken({ email: adminEmail, role: 'admin', iat: now, exp: now + TOKEN_TTL }), expiresIn: TOKEN_TTL, email: adminEmail, name: 'Administrator', role: 'admin' });
    }
    const employee = await Employee.findOne({ email }).select('+passwordHash');
    if (!employee || !employee.active || !passwordMatches(password, employee.passwordHash)) return res.status(401).json({ message: 'Incorrect email or password, or the account is inactive.' });
    employee.lastLoginAt = new Date();
    await employee.save();
    return res.json({ token: makeToken({ email: employee.email, employeeId: String(employee._id), role: 'employee', iat: now, exp: now + TOKEN_TTL }), expiresIn: TOKEN_TTL, email: employee.email, name: employee.fullName, role: employee.role });
  } catch (error) { return next(error); }
});

router.get('/employees', requireAuth, requireRoles('admin'), async (_req, res, next) => {
  try {
    const employees = await Employee.find().select('-passwordHash -__v').sort({ createdAt: -1 }).lean();
    return res.json({ employees });
  } catch (error) { return next(error); }
});

router.post('/employees', requireAuth, requireRoles('admin'), async (req, res, next) => {
  try {
    const fullName = typeof req.body?.fullName === 'string' ? req.body.fullName.trim() : '';
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const role = String(req.body?.role || 'viewer');
    if (!fullName || fullName.length > 100) return res.status(400).json({ message: 'Enter an employee name (up to 100 characters).' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 150) return res.status(400).json({ message: 'Enter a valid employee email address.' });
    if (password.length < 10 || password.length > 128) return res.status(400).json({ message: 'Employee passwords must be at least 10 characters long.' });
    if (!EMPLOYEE_ROLES.includes(role)) return res.status(400).json({ message: 'Choose a valid employee role.' });
    const employee = await Employee.create({ fullName, email, passwordHash: passwordHash(password), role, phone: String(req.body?.phone || '').trim().slice(0, 30), jobTitle: String(req.body?.jobTitle || '').trim().slice(0, 100), department: String(req.body?.department || '').trim().slice(0, 100), createdBy: req.admin.email });
    const safe = employee.toObject(); delete safe.passwordHash;
    await AuditEvent.create({ actor: req.admin.email, actorName: req.admin.name || 'Administrator', action: 'employee_created', details: `Created employee account for ${employee.fullName} (${employee.email}).`, entityType: 'employee', entityId: String(employee._id) });
    return res.status(201).json({ employee: safe });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'An employee account already exists for that email address.' });
    return next(error);
  }
});

router.patch('/employees/:id', requireAuth, requireRoles('admin'), async (req, res, next) => {
  try {
    const employee = await Employee.findById(req.params.id).select('+passwordHash');
    if (!employee) return res.status(404).json({ message: 'Employee not found.' });
    const { fullName, email, phone, jobTitle, department, role, active, password } = req.body || {};
    if (fullName !== undefined) { if (typeof fullName !== 'string' || !fullName.trim() || fullName.trim().length > 100) return res.status(400).json({ message: 'Enter a valid employee name.' }); employee.fullName = fullName.trim(); }
    if (email !== undefined) { const value = String(email).trim().toLowerCase(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || value.length > 150) return res.status(400).json({ message: 'Enter a valid employee email address.' }); employee.email = value; }
    if (phone !== undefined) employee.phone = String(phone).trim().slice(0, 30);
    if (jobTitle !== undefined) employee.jobTitle = String(jobTitle).trim().slice(0, 100);
    if (department !== undefined) employee.department = String(department).trim().slice(0, 100);
    if (role !== undefined) { if (!EMPLOYEE_ROLES.includes(role)) return res.status(400).json({ message: 'Choose a valid employee role.' }); employee.role = role; }
    if (active !== undefined) employee.active = Boolean(active);
    if (password !== undefined && password !== '') { if (typeof password !== 'string' || password.length < 10 || password.length > 128) return res.status(400).json({ message: 'New passwords must be at least 10 characters long.' }); employee.passwordHash = passwordHash(password); }
    await employee.save();
    const safe = employee.toObject(); delete safe.passwordHash;
    await AuditEvent.create({ actor: req.admin.email, actorName: req.admin.name || 'Administrator', action: 'employee_updated', details: `Updated employee account for ${employee.fullName} (${employee.email}).`, entityType: 'employee', entityId: String(employee._id) });
    return res.json({ employee: safe });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'An employee account already exists for that email address.' });
    return next(error);
  }
});

router.get('/stats', requireAuth, async (_req, res, next) => {
  try {
    const [total, newRequests, pendingQuotations, closedRequests, issuedQuotations] = await Promise.all([
      Quote.countDocuments({}), Quote.countDocuments({ status: 'new' }),
      Quote.countDocuments({ status: { $in: ['new', 'contacted'] } }), Quote.countDocuments({ status: 'closed' }),
      Quote.countDocuments({ 'quotation.status': { $in: ['issued', 'accepted', 'rejected'] } }),
    ]);
    const start = new Date(); start.setMonth(start.getMonth() - 5, 1); start.setHours(0, 0, 0, 0);
    const monthlyReports = await Quote.aggregate([
      { $match: { createdAt: { $gte: start } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt', timezone: 'Africa/Lusaka' } }, enquiries: { $sum: 1 }, quotationsIssued: { $sum: { $cond: [{ $in: ['$quotation.status', ['issued', 'accepted', 'rejected']] }, 1, 0] } } } },
      { $sort: { _id: 1 } },
    ]);
    return res.json({ total, newRequests, pendingQuotations, closedRequests, issuedQuotations, quotationIssueRate: total ? Math.round(issuedQuotations / total * 100) : 0, monthlyReports });
  } catch (error) { return next(error); }
});


router.get('/reports', requireAuth, async (req, res, next) => {
  try {
    const from = String(req.query.from || '').trim();
    const to = String(req.query.to || '').trim();
    const validDate = (value) => { if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false; const [year, month, day] = value.split('-').map(Number); const check = new Date(Date.UTC(year, month - 1, day)); return check.getUTCFullYear() === year && check.getUTCMonth() === month - 1 && check.getUTCDate() === day; };
    if (!validDate(from) || !validDate(to)) return res.status(400).json({ message: 'Choose a valid start and end date.' });
    const start = new Date(from + 'T00:00:00+02:00');
    const end = new Date(to + 'T00:00:00+02:00');
    end.setDate(end.getDate() + 1);
    if (start >= end || end.getTime() - start.getTime() > 366 * 24 * 60 * 60 * 1000) return res.status(400).json({ message: 'Choose a date range of up to 12 months.' });
    const quoteMatch = { createdAt: { $gte: start, $lt: end } };
    const shipmentMatch = { createdAt: { $gte: start, $lt: end } };
    const [quoteSummaryRows, monthly, topCustomers, shipmentStatuses, deliveryRows] = await Promise.all([
      Quote.aggregate([
        { $match: quoteMatch },
        { $group: { _id: null, enquiries: { $sum: 1 }, issued: { $sum: { $cond: [{ $in: ['$quotation.status', ['issued', 'accepted', 'rejected']] }, 1, 0] } }, accepted: { $sum: { $cond: [{ $eq: ['$quotation.status', 'accepted'] }, 1, 0] } }, rejected: { $sum: { $cond: [{ $eq: ['$quotation.status', 'rejected'] }, 1, 0] } }, revenue: { $sum: { $cond: [{ $eq: ['$quotation.status', 'accepted'] }, '$quotation.amount', 0] } } } },
      ]),
      Quote.aggregate([
        { $match: quoteMatch },
        { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt', timezone: 'Africa/Lusaka' } }, enquiries: { $sum: 1 }, issued: { $sum: { $cond: [{ $in: ['$quotation.status', ['issued', 'accepted', 'rejected']] }, 1, 0] } }, accepted: { $sum: { $cond: [{ $eq: ['$quotation.status', 'accepted'] }, 1, 0] } }, revenue: { $sum: { $cond: [{ $eq: ['$quotation.status', 'accepted'] }, '$quotation.amount', 0] } } } },
        { $sort: { _id: 1 } },
      ]),
      Quote.aggregate([
        { $match: { ...quoteMatch, 'quotation.status': 'accepted' } },
        { $group: { _id: { $ifNull: ['$customer', '$email'] }, name: { $first: '$fullName' }, email: { $first: '$email' }, acceptedQuotes: { $sum: 1 }, revenue: { $sum: '$quotation.amount' } } },
        { $sort: { revenue: -1 } }, { $limit: 10 },
      ]),
      Shipment.aggregate([{ $match: shipmentMatch }, { $group: { _id: '$status', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      Shipment.aggregate([
        { $match: { ...shipmentMatch, status: 'delivered' } },
        { $group: { _id: null, delivered: { $sum: 1 }, eligible: { $sum: { $cond: [{ $ne: ['$estimatedDelivery', null] }, 1, 0] } }, onTime: { $sum: { $cond: [{ $and: [{ $ne: ['$estimatedDelivery', null] }, { $lte: ['$deliveredAt', '$estimatedDelivery'] }] }, 1, 0] } } } },
      ]),
    ]);
    const summary = quoteSummaryRows[0] || { enquiries: 0, issued: 0, accepted: 0, rejected: 0, revenue: 0 };
    const shipmentTotal = shipmentStatuses.reduce((sum, item) => sum + item.count, 0);
    const delivered = deliveryRows[0]?.delivered || 0;
    const onTime = deliveryRows[0]?.onTime || 0;
    const eligibleDeliveries = deliveryRows[0]?.eligible || 0;
    return res.json({
      from, to,
      summary: {
        enquiries: summary.enquiries || 0, issued: summary.issued || 0, accepted: summary.accepted || 0,
        rejected: summary.rejected || 0, acceptedRevenue: summary.revenue || 0,
        conversionRate: summary.issued ? Math.round(summary.accepted / summary.issued * 100) : 0,
        shipmentTotal, delivered, eligibleDeliveries, onTimeDeliveries: onTime,
        onTimeRate: eligibleDeliveries ? Math.round(onTime / eligibleDeliveries * 100) : 0,
      },
      monthly, topCustomers, shipmentStatuses,
    });
  } catch (error) { return next(error); }
});

router.get('/quotes', requireAuth, async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 10, 1), 100);
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const skip = (page - 1) * limit;
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
      Quote.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).select('-__v +quotation.publicToken').lean(),
      Quote.countDocuments(filter),
    ]);
    const totalPages = Math.max(1, Math.ceil(total / limit));
    return res.json({ total, count: quotes.length, page, limit, totalPages, quotes });
  } catch (error) { return next(error); }
});

router.patch('/quotes/:id', requireAuth, requireRoles('admin', 'manager', 'operations'), async (req, res, next) => {
  try {
    const quote = await Quote.findById(req.params.id).select('+quotation.publicToken');
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
    await quote.save();
    let notification = null;
    if (events.some((event) => event.action === 'request_status_changed')) {
      const statusLabel = quote.status.replaceAll('_', ' ');
      notification = await sendCustomerNotification({
        to: quote.email, greetingName: quote.fullName,
        subject: 'Bridgeway Logistics enquiry update · ' + quote.reference,
        heading: 'Your enquiry status has been updated',
        message: 'There is an update to your logistics enquiry. Our team will contact you if any further information is required.',
        details: [['Enquiry reference', quote.reference], ['Service', quote.service], ['Current status', statusLabel]],
      });
    }
    return res.json({ quote, notification });
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

router.patch('/quotes/:id/quotation', requireAuth, requireRoles('admin', 'manager', 'sales'), async (req, res, next) => {
  try {
    const input = req.body?.quotation;
    if (!input || typeof input !== 'object') return res.status(400).json({ message: 'Quotation details are required.' });
    const amount = Number(input.amount);
    const description = typeof input.description === 'string' ? input.description.trim() : '';
    const terms = typeof input.terms === 'string' ? input.terms.trim() : '';
    const validUntil = input.validUntil ? new Date(input.validUntil) : null;
    const status = ['issued', 'accepted', 'rejected'].includes(input.status) ? input.status : 'draft';
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ message: 'Enter a quotation amount greater than zero.' });
    if (!description || description.length > 3000) return res.status(400).json({ message: 'Add a description of the services covered (up to 3,000 characters).' });
    if (!validUntil || Number.isNaN(validUntil.getTime())) return res.status(400).json({ message: 'Choose a valid quotation expiry date.' });
    if (['draft', 'issued'].includes(status) && validUntil < new Date(new Date().toDateString())) return res.status(400).json({ message: 'The validity date cannot be in the past.' });
    if (terms.length > 3000) return res.status(400).json({ message: 'Terms must be 3,000 characters or fewer.' });
    const quote = await Quote.findById(req.params.id).select('+quotation.publicToken');
    if (!quote) return res.status(404).json({ message: 'Quote request not found.' });
    if (['accepted', 'rejected'].includes(status) && !['issued', 'accepted', 'rejected'].includes(quote.quotation?.status)) return res.status(400).json({ message: 'Only an issued quotation can be marked accepted or rejected.' });
    const previous = quote.quotation?.reference ? quote.quotation.toObject() : null;
    const ref = typeof input.reference === 'string' && input.reference.trim() ? input.reference.trim().slice(0, 60) : (quote.quotation?.reference || 'BWQ-' + Date.now().toString(36).toUpperCase());
    const shouldSendEmail = status === 'issued' && (quote.quotation?.status !== 'issued' || quote.quotation?.emailStatus !== 'sent' || quote.quotation?.reference !== ref || Number(quote.quotation?.amount) !== amount || quote.quotation?.description !== description || quote.quotation?.terms !== terms || new Date(quote.quotation?.validUntil || 0).getTime() !== validUntil.getTime());
    const wasIssued = quote.quotation?.status === 'issued';
    const publicToken = quote.quotation?.publicToken || (status === 'issued' ? randomBytes(32).toString('hex') : '');
    quote.quotation = { reference: ref, amount, currency: 'ZMW', description, terms, validUntil, status, issuedAt: status === 'issued' ? (quote.quotation?.issuedAt || new Date()) : (quote.quotation?.issuedAt || null), emailStatus: shouldSendEmail ? 'not_sent' : (quote.quotation?.emailStatus || 'not_sent'), emailSentAt: quote.quotation?.emailSentAt || null, emailError: '', publicToken };
    if (status === 'issued') quote.status = 'quoted';
    if (previous) quote.quotationHistory.push({ ...previous, savedAt: new Date() });
    const outcomeChanged = ['accepted', 'rejected'].includes(status) && quote.quotation.status !== status;
    quote.activityLog.push({ action: outcomeChanged ? 'quotation_' + status : (wasIssued ? 'quotation_updated' : (status === 'issued' ? 'quotation_issued' : 'quotation_draft_saved')), details: outcomeChanged ? 'Quotation ' + ref + ' was marked ' + status + '.' : (wasIssued ? 'Quotation ' + ref + ' was revised.' : (status === 'issued' ? 'Quotation ' + ref + ' was issued.' : 'Quotation draft was saved.')), actor: req.admin.email });
    await quote.save();
    let email = { status: quote.quotation.emailStatus, error: quote.quotation.emailError };
    if (shouldSendEmail) { email = await sendQuotationEmail(quote); quote.quotation.emailStatus = email.status; quote.quotation.emailError = email.error; if (email.status === 'sent') quote.quotation.emailSentAt = new Date(); await quote.save(); }
    return res.json({ quote: quote.toObject(), email, quotationUrl: quote.quotation.publicToken ? quotationUrl(quote.quotation.publicToken) : '' });
  } catch (error) { return next(error); }
});



router.get('/customers', requireAuth, requireRoles('admin', 'manager', 'operations', 'sales', 'viewer'), async (req, res, next) => {
  try {
    // Attach older enquiries and shipments to customer records the first time the directory is opened.
    const [unlinkedQuotes, unlinkedShipments] = await Promise.all([
      Quote.find({ $or: [{ customer: null }, { customer: { $exists: false } }] }).sort({ createdAt: 1 }).limit(5000),
      Shipment.find({ $or: [{ customer: null }, { customer: { $exists: false } }] }).sort({ createdAt: 1 }).limit(5000),
    ]);
    for (const quote of unlinkedQuotes) {
      const customer = await upsertCustomer({ fullName: quote.fullName, email: quote.email, phone: quote.phone, quoteId: quote._id });
      quote.customer = customer._id;
      await quote.save();
    }
    for (const shipment of unlinkedShipments) {
      const customer = await upsertCustomer({ fullName: shipment.customerName, email: shipment.customerEmail, phone: shipment.customerPhone, shipmentId: shipment._id, preferredCustomerId: shipment.quote ? (await Quote.findById(shipment.quote).select('customer'))?.customer : null });
      shipment.customer = customer._id;
      await shipment.save();
    }
    const search = String(req.query.search || '').trim();
    const filter = {};
    if (search) {
      const safe = search.replace(/[.*+?^()|[\]\\]/g, '\\$&');
      filter.$or = ['fullName', 'email', 'phone'].map((field) => ({ [field]: { $regex: safe, $options: 'i' } }));
    }
    const customers = await Customer.find(filter).sort({ lastInteractionAt: -1, fullName: 1 }).limit(500).lean();
    const ids = customers.map((customer) => customer._id);
    const [quoteCounts, shipmentCounts] = await Promise.all([
      Quote.aggregate([{ $match: { customer: { $in: ids } } }, { $group: { _id: '$customer', enquiries: { $sum: 1 }, quotationsIssued: { $sum: { $cond: [{ $in: ['$quotation.status', ['issued', 'accepted', 'rejected']] }, 1, 0] } } } }]),
      Shipment.aggregate([{ $match: { customer: { $in: ids } } }, { $group: { _id: '$customer', shipments: { $sum: 1 } } }]),
    ]);
    const qMap = new Map(quoteCounts.map((item) => [String(item._id), item]));
    const sMap = new Map(shipmentCounts.map((item) => [String(item._id), item]));
    return res.json({ customers: customers.map((customer) => ({ ...customer, enquiries: qMap.get(String(customer._id))?.enquiries || 0, quotationsIssued: qMap.get(String(customer._id))?.quotationsIssued || 0, shipments: sMap.get(String(customer._id))?.shipments || 0 })) });
  } catch (error) { return next(error); }
});

router.get('/customers/:id', requireAuth, requireRoles('admin', 'manager', 'operations', 'sales', 'viewer'), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid customer reference.' });
    const customer = await Customer.findById(req.params.id).lean();
    if (!customer) return res.status(404).json({ message: 'Customer not found.' });
    const [enquiries, shipments, enquiryCount, shipmentCount, quotationsIssued] = await Promise.all([
      Quote.find({ customer: customer._id }).sort({ createdAt: -1 }).limit(100).select('reference service pickupLocation deliveryLocation status quotation createdAt').lean(),
      Shipment.find({ customer: customer._id }).sort({ createdAt: -1 }).limit(100).select('trackingNumber service origin destination status estimatedDelivery deliveredAt createdAt').lean(),
      Quote.countDocuments({ customer: customer._id }),
      Shipment.countDocuments({ customer: customer._id }),
      Quote.countDocuments({ customer: customer._id, 'quotation.status': { $in: ['issued', 'accepted', 'rejected'] } }),
    ]);
    return res.json({ customer, enquiries, shipments, enquiryCount, shipmentCount, quotationsIssued });
  } catch (error) { return next(error); }
});

const SHIPMENT_STATUSES = ['pending', 'picked_up', 'in_transit', 'at_warehouse', 'out_for_delivery', 'delivered', 'delayed', 'cancelled'];

router.get('/shipments', requireAuth, requireRoles('admin', 'manager', 'operations', 'viewer'), async (_req, res, next) => {
  try {
    const [shipments, drivers, enquiries] = await Promise.all([
      Shipment.find().sort({ createdAt: -1 }).limit(300).populate('quote', 'reference').lean(),
      Employee.find({ active: true, role: { $in: ['operations', 'manager'] } }).select('fullName phone jobTitle').sort({ fullName: 1 }).lean(),
      Quote.find({ status: { $in: ['quoted', 'closed'] } }).select('fullName phone email service pickupLocation deliveryLocation cargoDescription quantity reference').sort({ createdAt: -1 }).limit(200).lean(),
    ]);
    return res.json({ shipments, drivers, enquiries });
  } catch (error) { return next(error); }
});

router.post('/shipments', requireAuth, requireRoles('admin', 'manager', 'operations'), async (req, res, next) => {
  try {
    const body = req.body || {};
    const customerName = String(body.customerName || '').trim();
    const origin = String(body.origin || '').trim();
    const destination = String(body.destination || '').trim();
    const cargoDescription = String(body.cargoDescription || '').trim();
    if (!customerName || !origin || !destination || !cargoDescription) return res.status(400).json({ message: 'Customer, origin, destination and cargo description are required.' });
    if (customerName.length > 100 || origin.length > 160 || destination.length > 160 || cargoDescription.length > 500) return res.status(400).json({ message: 'One or more shipment fields exceed the allowed length.' });
    let quote = null;
    if (body.quoteId) {
      if (!mongoose.isValidObjectId(body.quoteId)) return res.status(400).json({ message: 'Select a valid enquiry.' });
      quote = await Quote.findById(body.quoteId);
      if (!quote) return res.status(404).json({ message: 'The linked enquiry could not be found.' });
    }
    let driver = null;
    if (body.driverId) {
      driver = await Employee.findOne({ _id: body.driverId, active: true, role: { $in: ['operations', 'manager'] } });
      if (!driver) return res.status(400).json({ message: 'Select an active operations or manager account as the assigned driver.' });
    }
    const trackingNumber = 'BW-' + Date.now().toString(36).toUpperCase() + randomBytes(2).toString('hex').toUpperCase();
    const customer = await upsertCustomer({ fullName: quote?.fullName || customerName, email: quote?.email || String(body.customerEmail || '').trim().toLowerCase(), phone: quote?.phone || String(body.customerPhone || '').trim(), quoteId: quote?._id || null, preferredCustomerId: quote?.customer || null });
    const shipment = await Shipment.create({
      trackingNumber, quote: quote?._id || null, customer: customer._id, enquiryReference: quote?.reference || '',
      customerName: quote?.fullName || customerName, customerPhone: quote?.phone || String(body.customerPhone || '').trim(),
      customerEmail: quote?.email || String(body.customerEmail || '').trim().toLowerCase(),
      service: quote?.service || String(body.service || '').trim(), origin: quote?.pickupLocation || origin,
      destination: quote?.deliveryLocation || destination, cargoDescription: quote?.cargoDescription || cargoDescription,
      quantity: quote?.quantity || String(body.quantity || '').trim(), driver: driver?._id || null,
      driverName: driver?.fullName || '', driverPhone: driver?.phone || '', vehicle: String(body.vehicle || '').trim(),
      estimatedDelivery: body.estimatedDelivery ? new Date(body.estimatedDelivery) : null,
      createdBy: req.admin.email,
      updates: [{ status: 'pending', location: '', note: 'Shipment registered.', actor: req.admin.email }],
    });
    await AuditEvent.create({ actor: req.admin.email, actorName: req.admin.name || 'Administrator', action: 'shipment_created', details: `Registered shipment ${shipment.trackingNumber} for ${shipment.customerName}.`, entityType: 'shipment', entityId: String(shipment._id) });
    return res.status(201).json({ shipment });
  } catch (error) { return next(error); }
});

router.patch('/shipments/:id', requireAuth, requireRoles('admin', 'manager', 'operations'), async (req, res, next) => {
  try {
    const shipment = await Shipment.findById(req.params.id);
    if (!shipment) return res.status(404).json({ message: 'Shipment not found.' });
    const body = req.body || {};
    const previousStatus = shipment.status;
    if (body.status !== undefined) {
      if (!SHIPMENT_STATUSES.includes(body.status)) return res.status(400).json({ message: 'Select a valid shipment status.' });
      shipment.status = body.status;
      shipment.deliveredAt = body.status === 'delivered' ? (shipment.deliveredAt || new Date()) : null;
    }
    if (body.driverId !== undefined) {
      const driver = body.driverId ? await Employee.findOne({ _id: body.driverId, active: true, role: { $in: ['operations', 'manager'] } }) : null;
      if (body.driverId && !driver) return res.status(400).json({ message: 'Select an active operations or manager account as the assigned driver.' });
      shipment.driver = driver?._id || null; shipment.driverName = driver?.fullName || ''; shipment.driverPhone = driver?.phone || '';
    }
    if (body.vehicle !== undefined) shipment.vehicle = String(body.vehicle).trim().slice(0, 100);
    if (body.estimatedDelivery !== undefined) shipment.estimatedDelivery = body.estimatedDelivery ? new Date(body.estimatedDelivery) : null;
    if (body.currentLocation !== undefined) shipment.currentLocation = String(body.currentLocation).trim().slice(0, 160);
    if (body.deliveryRecipient !== undefined) shipment.deliveryRecipient = String(body.deliveryRecipient).trim().slice(0, 100);
    if (body.deliveryNotes !== undefined) shipment.deliveryNotes = String(body.deliveryNotes).trim().slice(0, 1000);
    if (body.status !== undefined || body.currentLocation !== undefined || body.deliveryNotes !== undefined) {
      shipment.updates.push({ status: shipment.status, location: shipment.currentLocation, note: String(body.updateNote || (body.status === 'delivered' ? 'Delivery confirmed.' : 'Shipment details updated.')).trim().slice(0, 500), actor: req.admin.email });
    }
    await shipment.save();
    await AuditEvent.create({ actor: req.admin.email, actorName: req.admin.name || 'Administrator', action: 'shipment_updated', details: `Updated shipment ${shipment.trackingNumber}; current status: ${shipment.status}.`, entityType: 'shipment', entityId: String(shipment._id) });
    let notification = null;
    if (body.status !== undefined && body.status !== previousStatus) {
      const clientUrl = (process.env.CLIENT_URL || '').split(',')[0].trim().replace(/\/$/, '');
      const trackingUrl = clientUrl ? clientUrl + '/#/track/' + encodeURIComponent(shipment.trackingNumber) : '';
      notification = await sendCustomerNotification({
        to: shipment.customerEmail, greetingName: shipment.customerName,
        subject: 'Bridgeway Logistics shipment update · ' + shipment.trackingNumber,
        heading: 'Your shipment status has changed',
        message: 'The status of your shipment has been updated. You can use the tracking details below to follow its progress.',
        details: [['Tracking number', shipment.trackingNumber], ['Current status', shipment.status.replaceAll('_', ' ')], ['Current location', shipment.currentLocation || 'Not provided'], ...(shipment.estimatedDelivery ? [['Estimated delivery', new Date(shipment.estimatedDelivery).toLocaleDateString('en-ZM')]] : [])],
        actionLabel: 'Track shipment', actionUrl: trackingUrl,
      });
    }
    return res.json({ shipment, notification });
  } catch (error) { return next(error); }
});

router.get('/activity', requireAuth, requireRoles('admin'), async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 100, 1), 300);
    const [auditEvents, quoteEvents, shipmentEvents] = await Promise.all([
      AuditEvent.find().sort({ createdAt: -1 }).limit(limit).lean(),
      Quote.find({ 'activityLog.0': { $exists: true } }).select('reference fullName activityLog').lean(),
      Shipment.find({ 'updates.0': { $exists: true } }).select('trackingNumber customerName updates').lean(),
    ]);
    const events = [
      ...auditEvents.map((event) => ({ _id: String(event._id), actor: event.actorName || event.actor, action: event.action, details: event.details, entityType: event.entityType, entityId: event.entityId, createdAt: event.createdAt })),
      ...quoteEvents.flatMap((quote) => (quote.activityLog || []).map((event) => ({ _id: String(event._id), actor: event.actor || 'Unknown', action: event.action, details: (quote.reference ? quote.reference + ' · ' : '') + (event.details || quote.fullName || 'Enquiry activity'), entityType: 'enquiry', entityId: String(quote._id), createdAt: event.createdAt }))),
      ...shipmentEvents.flatMap((shipment) => (shipment.updates || []).map((event) => ({ _id: String(event._id), actor: event.actor || 'Unknown', action: 'shipment_' + event.status, details: shipment.trackingNumber + ' · ' + (event.note || shipment.customerName || 'Shipment update') + (event.location ? ' · ' + event.location : ''), entityType: 'shipment', entityId: String(shipment._id), createdAt: event.createdAt }))),
    ].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, limit);
    return res.json({ events, count: events.length });
  } catch (error) { return next(error); }
});

export default router;
