const fs = require('fs');
const path = require('path');

const AUDIT_DIR = path.join(__dirname, '..', '..', '..', 'data', 'audit');
const AUDIT_FILE = path.join(AUDIT_DIR, 'backend_audit_log.json');

/**
 * Append an audit event to the backend audit log file.
 * This mirrors the Python audit logger but runs on the Node backend.
 */
function appendAuditEvent({ event_type, customer_id, booking_id, details }) {
  try {
    if (!fs.existsSync(AUDIT_DIR)) {
      fs.mkdirSync(AUDIT_DIR, { recursive: true });
    }

    let events = [];
    if (fs.existsSync(AUDIT_FILE)) {
      const raw = fs.readFileSync(AUDIT_FILE, 'utf8');
      events = JSON.parse(raw);
    }

    events.push({
      timestamp: new Date().toISOString(),
      event_type,
      customer_id: customer_id || null,
      booking_id: booking_id || null,
      details: details || {}
    });

    fs.writeFileSync(AUDIT_FILE, JSON.stringify(events, null, 2), 'utf8');
  } catch (err) {
    // Audit failures should never break the main flow
    console.error('[audit] Failed to write audit event:', err.message);
  }
}

module.exports = { appendAuditEvent };
