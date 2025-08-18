import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import geocodingRoutes from './routes/geocoding';
import routingRoutes from './routes/routing';
import offlineRoutingRoutes from './routes/offlineRouting';
import placesRoutes from './routes/places';
import adminRoutes from './routes/admin';
import tilesRoutes from './routes/tiles';
import { errorHandler } from './middleware/errorHandler';
import { logger } from './middleware/logger';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

app.use(limiter);

// CORS configuration
// Allow common dev ports
const allowedOrigins = new Set([
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'http://localhost:3001'
]);
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(null, true); // be permissive in dev
  },
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use(logger);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Extended health with Overpass probe
app.get('/healthplus', async (req, res) => {
  try {
    const axios = (await import('axios')).default;
    const mirrors = [
      'https://overpass-api.de/api/status',
      'https://overpass.kumi.systems/api/status',
      'https://overpass.openstreetmap.ru/api/status'
    ];
    const results: any[] = [];
    for (const m of mirrors) {
      try {
        const r = await axios.get(m, { timeout: 8000, headers: { 'User-Agent': 'OpenMaps/1.0 (backend health)' } });
        results.push({ url: m, ok: true, status: r.status });
      } catch (e: any) {
        results.push({ url: m, ok: false, status: e?.response?.status || 'ERR' });
      }
    }
    res.json({ status: 'healthy', overpass: results });
  } catch (e) {
    res.json({ status: 'healthy', overpass: [] });
  }
});

// API routes
app.use('/api/geocoding', geocodingRoutes);
app.use('/api/routing', routingRoutes);
app.use('/api/offline-routing', offlineRoutingRoutes);
app.use('/api/places', placesRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/tiles', tilesRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested resource was not found on this server.'
  });
});

// Error handling middleware
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🗺️  OpenMaps Backend running on port ${PORT}`);
  console.log(`📍 Health check available at http://localhost:${PORT}/health`);
});

export default app;