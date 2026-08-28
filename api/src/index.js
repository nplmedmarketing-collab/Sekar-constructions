const config = require('./config');
const { createApp } = require('./app');
const db = require('./db');

const app = createApp();

const server = app.listen(config.PORT, () => {
  console.log(`[sekar-api] listening on http://localhost:${config.PORT}`);
  console.log(`[sekar-api] env=${config.NODE_ENV} db=${config.DATABASE_URL.startsWith('postgres') ? 'postgres' : 'sqlite'}`);
  console.log(`[sekar-api] CORS origins: ${config.CORS_ORIGINS.join(', ')}`);
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
