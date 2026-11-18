import { Router } from 'express';
import Shipment from '../models/Shipment.js';

const router = Router();

router.get('/track/:trackingNumber', async (req, res, next) => {
  try {
    const trackingNumber = String(req.params.trackingNumber || '').trim().toUpperCase();
    const shipment = await Shipment.findOne({ trackingNumber, status: { $ne: 'cancelled' } }).lean();
    if (!shipment) return res.status(404).json({ message: 'No shipment was found with that tracking number.' });
    const safe = {
      trackingNumber: shipment.trackingNumber, customerName: shipment.customerName,
      origin: shipment.origin, destination: shipment.destination, service: shipment.service,
      status: shipment.status, currentLocation: shipment.currentLocation,
      estimatedDelivery: shipment.estimatedDelivery, deliveredAt: shipment.deliveredAt,
      updates: (shipment.updates || []).map(({ status, location, note, createdAt }) => ({ status, location, note, createdAt })),
    };
    return res.json({ shipment: safe });
  } catch (error) { return next(error); }
});

export default router;
