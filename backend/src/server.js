const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

const meRoutes = require('./routes/me');
const bookingsRoutes = require('./routes/bookings');
const { router: chatRouter } = require('./routes/chat');
const adminRoutes = require('./routes/admin');
const internalRoutes = require('./routes/internal');

const app = express();

// CORS configuration
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'http://localhost:5173',
  'http://127.0.0.1:5173'
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, internal services)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Internal-API-Key']
}));

app.use(express.json());

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Health check endpoints
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'airline-backend' });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'airline-backend' });
});

// Mount routes
app.use('/api/me', meRoutes);
app.use('/api/bookings', bookingsRoutes);
app.use('/api/chat', chatRouter);
app.use('/api/admin/approvals', adminRoutes);
app.use('/api/internal', internalRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ detail: `Route ${req.method} ${req.url} not found` });
});

// Centralized error handler
app.use((err, req, res, next) => {
  console.error('[server error]:', err);
  const status = err.status || 500;
  res.status(status).json({
    detail: err.message || 'Internal Server Error'
  });
});

const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend server running on http://0.0.0.0:${PORT}`);
  });
}

module.exports = app;
