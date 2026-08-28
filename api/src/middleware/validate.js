function validateBody(schema) {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      const err = new Error('Validation failed.');
      err.status = 400;
      err.code = 'VALIDATION_ERROR';
      err.issues = parsed.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      }));
      return next(err);
    }
    req.validated = parsed.data;
    return next();
  };
}

module.exports = { validateBody };
