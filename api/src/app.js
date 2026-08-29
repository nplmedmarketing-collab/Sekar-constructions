const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const config = require('./config');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const authRoutes = require('./routes/auth');
const publicRoutes = require('./routes/public');
const adminRoutes = require('./routes/admin');
const inquiryRoutes = require('./routes/inquiries');
const careersRoutes = require('./routes/careers');
const db = require('./db');

function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(morgan(config.isProd ? 'combined' : 'dev'));
  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());

  app.use(
    cors({
      origin(origin, callback) {
        // Allow non-browser / same-origin tools (no Origin header)
        if (!origin) return callback(null, true);
        if (config.CORS_ORIGINS.includes(origin)) return callback(null, true);
        return callback(new Error(`CORS blocked for origin: ${origin}`));
      },
      credentials: true,
    })
  );

  // Soft-fail CORS errors into JSON
  app.use((err, req, res, next) => {
    if (err && String(err.message || '').startsWith('CORS blocked')) {
      return res.status(403).json({
        error: { code: 'CORS_DENIED', message: err.message },
      });
    }
    return next(err);
  });

  app.get('/api/health', async (req, res) => {
    try {
      await db.raw('select 1 as ok');
      const body = {
        ok: true,
        time: new Date().toISOString(),
      };
      if (!config.isProd) {
        body.env = config.NODE_ENV;
      }
      res.json(body);
    } catch (err) {
      // Do not leak DB driver / connection details in the response body.
      console.error('[api] health check failed:', err.message);
      res.status(503).json({
        ok: false,
        error: { code: 'DB_UNAVAILABLE', message: 'Database unavailable.' },
      });
    }
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/public', publicRoutes);
  app.use('/api/public/careers', careersRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/inquiries', inquiryRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
