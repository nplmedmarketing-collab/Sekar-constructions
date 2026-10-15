/** Upstream/proxy failures may be 5xx but still carry a safe user-facing message. */
const SURFACED_5XX_CODES = new Set([
  'HRPOPS_UPSTREAM_ERROR',
  'HRPOPS_BAD_RESPONSE',
  'HRPOPS_UNAVAILABLE',
]);

function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  const status = err.status || err.statusCode || 500;
  const code = err.code || (status === 500 ? 'INTERNAL_ERROR' : 'ERROR');
  if (status >= 500) {
    console.error('[api]', err);
  }
  // Avoid leaking stack/driver details on unexpected failures.
  // Still surface known proxy/upstream messages (e.g. HRPops validation text).
  const safeMessage =
    status >= 500 && !SURFACED_5XX_CODES.has(code)
      ? 'Unexpected server error.'
      : err.message || 'Request failed.';
  const body = {
    error: {
      code,
      message: safeMessage,
    },
  };
  if (err.locked) body.error.locked = true;
  if (err.remainingMinutes != null) body.error.remainingMinutes = err.remainingMinutes;
  if (err.issues) body.error.issues = err.issues;
  res.status(status).json(body);
}

function notFound(req, res) {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: `No route for ${req.method} ${req.path}` },
  });
}

module.exports = { errorHandler, notFound };
