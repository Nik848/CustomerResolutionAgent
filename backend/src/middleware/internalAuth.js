/**
 * Internal API authentication middleware.
 * Protects routes used exclusively by the AI service to call back into the backend.
 * Uses a shared secret passed as X-Internal-API-Key header.
 */
function requireInternalKey(req, res, next) {
  const key = req.headers['x-internal-api-key'];
  const expected = process.env.INTERNAL_API_KEY;

  if (!expected) {
    console.error('[internalAuth] INTERNAL_API_KEY is not configured');
    return res.status(500).json({ detail: 'Internal API key not configured' });
  }

  if (!key) {
    return res.status(401).json({ detail: 'Missing internal API key' });
  }

  if (key !== expected) {
    return res.status(403).json({ detail: 'Invalid internal API key' });
  }

  next();
}

module.exports = { requireInternalKey };
