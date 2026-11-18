import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import mongoose from 'mongoose';
import Shipment from '../models/Shipment.js';
import Employee from '../models/Employee.js';
import Quote from '../models/Quote.js';

const router = Router();
const STATUSES = ['pending', 'picked_up', 'in_transit', 'at_warehouse', 'out_for_delivery', 'delivered', 'delayed', 'cancelled'];
const safe = (shipment) => ({
  trackingNumber: shipment.trackingNumber,
  customerName: shipment.customerName,
  origin: shipment.origin,
  destination: shipment.destination,
  service: shipment.service,
  status: shipment.status,
  currentLocation: shipment.currentLocation,
  estimatedDelivery: shipment.estimatedDelivery,
  deliveredAt: shipment.deliveredAt,
  updates: (shipment.updates || []).map(({ status, location, note, createdAt }) => ({ status, location, note, createdAt })),
});

router.get('/track/:trackingNumber', async (req, res, next) => {
  try {
    const trackingNumber = String(req.params.trackingNumber || '').trim().toUpperCase();
    const shipment = await Shipment.findOne({ trackingNumber, status: { $ne: 'cancelled' } }).lean();
    if (!shipment) return res.status(404).json({ message: 'No shipment was found with that tracking number.' });
    return res.json({ shipment: safe(shipment) });
  } catch (error) { return next(error); }
});

router.get('/', async (req, res, next) => {
  try {
    const trackingNumber = String(req.query.trackingNumber || '').trim();
    const filter = trackingNumber ? { trackingNumber: { $regex: trackingNumber.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } } : {};
    const [shipments, drivers] = await Promise.all([
      Shipment.find(filter).sort({ createdAt: -1 }).limit(200).populate('quote', 'reference').lean(),
      Employee.find({ active: true, role: { $in: ['operations', 'manager'] } }).select('fullName phone jobTitle').sort({ fullName: 1 }).lean(),
    ]);
    return res.json({ shipments, drivers });
  } catch (error) { return next(error); }
});

router.post('/', async (req, res, next) => {
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
    const shipment = await Shipment.create({
      trackingNumber, quote: quote?._id || null, enquiryReference: quote?.reference || '',
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
    return res.status(201).json({ shipment });
  } catch (error) { return next(error); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const shipment = await Shipment.findById(req.params.id);
    if (!shipment) return res.status(404).json({ message: 'Shipment not found.' });
    const body = req.body || {};
    if (body.status !== undefined) {
      if (!STATUSES.includes(body.status)) return res.status(400).json({ message: 'Select a valid shipment status.' });
      shipment.status = body.status;
      if (body.status === 'delivered') shipment.deliveredAt = shipment.deliveredAt || new Date();
      if (body.status !== 'delivered') shipment.deliveredAt = null;
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
    return res.json({ shipment });
  } catch (error) { return next(error); }
});

export default router;
