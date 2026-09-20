const { supabase } = require('../db/supabase');

/**
 * Append an audit event to the `audit_events` table in Supabase.
 *
 * Replaces the previous flat-file implementation (backend_audit_log.json).
 * Uses the service-role client so it bypasses RLS and always succeeds
 * regardless of the authenticated user's role.
 *
 * Audit failures are intentionally swallowed so they never break the main flow.
 *
 * @param {Object} opts
 * @param {string} opts.event_type  - 'action_executed' | 'human_approval_requested' |
 *                                    'human_approval_received' | 'approval_rejected'
 * @param {string} [opts.customer_id]
 * @param {string} [opts.booking_id]
 * @param {Object} [opts.details]
 */
async function appendAuditEvent({ event_type, customer_id, booking_id, details }) {
  try {
    const { error } = await supabase.from('audit_events').insert({
      event_type,
      customer_id: customer_id || null,
      booking_id:  booking_id  || null,
      details:     details     || {}
    });

    if (error) {
      console.error('[audit] Supabase insert failed:', error.message);
    }
  } catch (err) {
    // Audit failures must never break the main request flow
    console.error('[audit] Unexpected error writing audit event:', err.message);
  }
}

module.exports = { appendAuditEvent };
