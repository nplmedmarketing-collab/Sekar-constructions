function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  const status = err.status || err.statusCode || 500;
  const code = err.code || (status === 500 ? 'INTERNAL_ERROR' : 'ERROR');
  if (status >= 500) {
    console.error('[api]', err);
  }
  // Avoid leaking stack/driver details on unexpected failures.
  const safeMessage =
    status >= 500
      ? 'Unexpected server error.'
      : err.message || 'Request failed.';
  const body = {
    error: {
      code,
      message: safeMessage,
    },
  };
  if (err.attemptsLeft != null) body.error.attemptsLeft = err.attemptsLeft;
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
