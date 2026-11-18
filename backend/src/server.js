import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import mongoose from 'mongoose';
import quoteRoutes from './routes/quotes.js';
import adminRoutes from './routes/admin.js';
import shipmentRoutes from './routes/shipments.js';

const app = express();
const port = Number(process.env.PORT) || 5000;

const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    // Requests without an Origin header can include health checks and local tools.
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origin is not allowed by CORS.'));
  },
  methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-admin-key', 'Authorization'],
}));
app.use(express.json({ limit: '20kb' }));

const quoteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many quote requests from this connection. Please try again later.' },
});

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'Bridgeway Logistics API',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  });
});

app.use('/api/admin/login', rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: 'draft-7', legacyHeaders: false, message: { message: 'Too many sign-in attempts. Please try again later.' } }));
app.use('/api/admin', adminRoutes);
app.use('/api/quotes', quoteLimiter, quoteRoutes);
app.use('/api/shipments', shipmentRoutes);

app.use((_req, res) => {
  res.status(404).json({ message: 'Route not found.' });
});

app.use((error, _req, res, _next) => {
  console.error(error);
  if (error.message === 'Origin is not allowed by CORS.') {
    return res.status(403).json({ message: 'This website origin is not allowed to access the API.' });
  }
  return res.status(500).json({ message: 'An unexpected server error occurred.' });
});

async function start() {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is missing. Add it to backend/.env before starting the API.');
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB.');
    app.listen(port, '0.0.0.0', () => {
      console.log(`Bridgeway Logistics API listening on port ${port}.`);
    });
  } catch (error) {
    console.error('Could not connect to MongoDB:', error.message);
    process.exit(1);
  }
}

start();
