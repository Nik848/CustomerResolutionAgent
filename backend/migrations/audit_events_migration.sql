-- ============================================================
-- audit_events table
-- Replaces the flat-file backend_audit_log.json / audit_log.json
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_events (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  timestamp    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event_type   TEXT NOT NULL,
  customer_id  TEXT REFERENCES customers(customer_id) ON DELETE SET NULL,
  booking_id   TEXT REFERENCES bookings(booking_id) ON DELETE SET NULL,
  details      JSONB NOT NULL DEFAULT '{}'
);

-- Fast lookups by customer and time
CREATE INDEX IF NOT EXISTS idx_audit_events_customer_time
  ON audit_events (customer_id, timestamp DESC);

-- Fast lookups by event type (for filter queries)
CREATE INDEX IF NOT EXISTS idx_audit_events_event_type
  ON audit_events (event_type, timestamp DESC);

-- ── Row Level Security ─────────────────────────────────────

ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;

-- Admins (profiles.role = 'admin') can read all audit events
CREATE POLICY "Admins can read audit events"
  ON audit_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.auth_user_id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- INSERT is done via the service_role key which bypasses RLS —
-- no explicit INSERT policy is needed.

COMMENT ON TABLE audit_events IS
  'Immutable audit trail of all agent actions, approval requests, and supervisor decisions.';
COMMENT ON COLUMN audit_events.event_type IS
  'One of: action_executed, human_approval_requested, human_approval_received, approval_rejected, approval_created';
COMMENT ON COLUMN audit_events.details IS
  'Arbitrary JSON payload specific to the event_type';
