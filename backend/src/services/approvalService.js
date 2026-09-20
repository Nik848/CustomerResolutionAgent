const { supabase } = require('../db/supabase');

/**
 * Create a new approval_requests record (called when AI signals requires_human_approval).
 */
async function createApprovalRequest({ customerId, bookingId, threadId, reqType, reason, details }) {
  // Check for existing pending request for this thread
  const { data: existing } = await supabase
    .from('approval_requests')
    .select('id')
    .eq('thread_id', threadId)
    .eq('status', 'pending')
    .limit(1)
    .single();

  if (existing) {
    // Update existing pending request
    const { data, error } = await supabase
      .from('approval_requests')
      .update({ type: reqType, reason, details })
      .eq('id', existing.id)
      .select()
      .single();
    if (error) throw new Error(`Approval update failed: ${error.message}`);
    return data;
  }

  const { data, error } = await supabase
    .from('approval_requests')
    .insert({
      customer_id: customerId,
      booking_id: bookingId,
      thread_id: threadId,
      type: reqType,
      reason,
      details,
      status: 'pending'
    })
    .select()
    .single();

  if (error) throw new Error(`Approval creation failed: ${error.message}`);
  return data;
}

/**
 * Enrich approval requests with customer and booking context via separate queries.
 * Completely avoids coupling to PostgREST relationship schema cache.
 */
async function enrichApprovals(approvals) {
  if (!approvals || approvals.length === 0) return [];

  const customerIds = [...new Set(approvals.map(a => a.customer_id).filter(Boolean))];
  const bookingIds = [...new Set(approvals.map(a => a.booking_id).filter(Boolean))];

  const [custRes, bookRes] = await Promise.all([
    customerIds.length > 0
      ? supabase.from('customers').select('customer_id, name, email, loyalty_tier').in('customer_id', customerIds)
      : Promise.resolve({ data: [] }),
    bookingIds.length > 0
      ? supabase.from('bookings').select('booking_id, pnr, flight_number, origin, destination, date, scheduled_departure, status, delay_hours, disruption_reason, fare_difference').in('booking_id', bookingIds)
      : Promise.resolve({ data: [] })
  ]);

  const customerMap = new Map((custRes.data || []).map(c => [c.customer_id.toUpperCase(), c]));
  const bookingMap = new Map((bookRes.data || []).map(b => [b.booking_id.toUpperCase(), b]));

  return approvals.map(appr => {
    const cust = customerMap.get((appr.customer_id || '').toUpperCase()) || {};
    const book = bookingMap.get((appr.booking_id || '').toUpperCase()) || {};

    return {
      ...appr,
      customer_name: cust.name || null,
      customer_email: cust.email || null,
      loyalty_tier: cust.loyalty_tier || null,
      pnr: book.pnr || null,
      flight_number: book.flight_number || null,
      origin: book.origin || null,
      destination: book.destination || null,
      travel_date: book.date || null,
      scheduled_departure: book.scheduled_departure || null,
      booking_status: book.status || null,
      delay_hours: book.delay_hours || null,
      disruption_reason: book.disruption_reason || null,
      fare_difference: book.fare_difference || null
    };
  });
}

/**
 * Fetch all pending approval requests with customer and booking context.
 */
async function getPendingApprovals() {
  const { data, error } = await supabase
    .from('approval_requests')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Pending approvals fetch failed: ${error.message}`);
  return enrichApprovals(data || []);
}

/**
 * Fetch resolved approval history.
 */
async function getApprovalHistory(limit = 50) {
  const { data, error } = await supabase
    .from('approval_requests')
    .select('*')
    .in('status', ['approved', 'rejected'])
    .order('resolved_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Approval history fetch failed: ${error.message}`);
  return enrichApprovals(data || []);
}

/**
 * Fetch a single approval request by UUID string.
 */
async function getApprovalById(approvalId) {
  const { data, error } = await supabase
    .from('approval_requests')
    .select('*')
    .eq('id', approvalId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Approval fetch failed: ${error.message}`);
  }
  if (!data) {
    throw Object.assign(new Error('Not found'), { status: 404 });
  }

  const enriched = await enrichApprovals([data]);
  return enriched[0];
}

/**
 * Resolve an approval (approve or reject).
 */
async function resolveApproval({ approvalId, decision, resolvedBy, resolutionNote }) {
  if (!['approved', 'rejected'].includes(decision)) {
    throw Object.assign(new Error("Decision must be 'approved' or 'rejected'"), { status: 400 });
  }

  const current = await getApprovalById(approvalId);
  if (['approved', 'rejected'].includes(current.status)) {
    throw Object.assign(new Error(`Cannot ${decision} an already ${current.status} request`), { status: 400 });
  }

  const { data, error } = await supabase
    .from('approval_requests')
    .update({
      status: decision,
      resolved_at: new Date().toISOString(),
      resolved_by: resolvedBy,
      resolution_note: resolutionNote || `Resolved as ${decision} by admin`
    })
    .eq('id', approvalId)
    .select()
    .single();

  if (error) throw new Error(`Approval resolution failed: ${error.message}`);
  return { ...data, thread_id: current.thread_id };
}

module.exports = {
  createApprovalRequest,
  getPendingApprovals,
  getApprovalHistory,
  getApprovalById,
  resolveApproval
};
