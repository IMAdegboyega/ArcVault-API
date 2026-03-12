require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');

const routes = require('./routes');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { apiLimiter } = require('./middleware/rateLimit');

const app = express();
const PORT = process.env.PORT || 5000;

// ==================== Security Middleware ====================
app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// ==================== Parsing Middleware ====================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ==================== Logging ====================
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// ==================== Rate Limiting ====================
app.use('/api', apiLimiter);

// ==================== Routes ====================
app.use('/api', routes);

// Root route
app.get('/', (req, res) => {
  res.json({
    name: 'ArcVault API',
    version: '1.0.0',
    docs: '/api/health',
    description: 'Banking platform API powered by Node.js and PostgreSQL',
  });
});

// ==================== Error Handling ====================
app.use(notFoundHandler);
app.use(errorHandler);

// ==================== Start Server ====================
app.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════╗
  ║         ArcVault API Server          ║
  ║──────────────────────────────────────║
  ║  Port:    ${PORT}                        ║
  ║  Mode:    ${process.env.NODE_ENV || 'development'}              ║
  ║  Health:  http://localhost:${PORT}/api/health  ║
  ╚══════════════════════════════════════╝
  `);
});

// Handle unhandled rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  process.exit(1);
});

module.exports = app;
