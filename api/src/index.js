const config = require('./config');
const { createApp } = require('./app');
const db = require('./db');
const { getSmtpStartupStatus } = require('./services/emailService');

const app = createApp();

const server = app.listen(config.PORT, () => {
  console.log(`[sekar-api] listening on http://localhost:${config.PORT}`);
  console.log(`[sekar-api] env=${config.NODE_ENV} db=mariadb/mysql`);
  console.log(`[sekar-api] CORS origins: ${config.CORS_ORIGINS.join(', ')}`);
  console.log(`[sekar-api] jobs site: ${config.JOBS_SITE_URL}`);
  console.log(`[sekar-api] SMTP: ${getSmtpStartupStatus()}`);
});

async function shutdown(signal) {
  console.log(`[sekar-api] ${signal} received, shutting down…`);
  server.close(async () => {
    try {
      await db.destroy();
    } catch (e) {
      /* ignore */
    }
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
