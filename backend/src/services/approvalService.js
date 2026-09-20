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
 * Fetch all pending approval requests with customer and booking context.
 */
async function getPendingApprovals() {
  const { data, error } = await supabase
    .from('approval_requests')
    .select(`
      *,
      customers ( name, email, loyalty_tier ),
      bookings ( pnr, flight_number, origin, destination, date, scheduled_departure, status, delay_hours, disruption_reason, fare_difference )
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Pending approvals fetch failed: ${error.message}`);

  return (data || []).map(flattenApproval);
}

/**
 * Fetch resolved approval history.
 */
async function getApprovalHistory(limit = 50) {
  const { data, error } = await supabase
    .from('approval_requests')
    .select(`
      *,
      customers ( name, email, loyalty_tier ),
      bookings ( pnr, flight_number, origin, destination, date, scheduled_departure, status, delay_hours, disruption_reason, fare_difference )
    `)
    .in('status', ['approved', 'rejected'])
    .order('resolved_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Approval history fetch failed: ${error.message}`);
  return (data || []).map(flattenApproval);
}

/**
 * Fetch a single approval request by UUID string.
 */
async function getApprovalById(approvalId) {
  const { data, error } = await supabase
    .from('approval_requests')
    .select(`
      *,
      customers ( name, email, loyalty_tier ),
      bookings ( pnr, flight_number, origin, destination, date, scheduled_departure, status, delay_hours, disruption_reason, fare_difference )
    `)
    .eq('id', approvalId)
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') throw Object.assign(new Error('Not found'), { status: 404 });
    throw new Error(`Approval fetch failed: ${error.message}`);
  }
  return flattenApproval(data);
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

/**
 * Flatten the nested Supabase join response into a flat object.
 */
function flattenApproval(row) {
  const { customers, bookings, ...rest } = row;
  return {
    ...rest,
    customer_name: customers?.name,
    customer_email: customers?.email,
    loyalty_tier: customers?.loyalty_tier,
    pnr: bookings?.pnr,
    flight_number: bookings?.flight_number,
    origin: bookings?.origin,
    destination: bookings?.destination,
    travel_date: bookings?.date,
    scheduled_departure: bookings?.scheduled_departure,
    booking_status: bookings?.status,
    delay_hours: bookings?.delay_hours,
    disruption_reason: bookings?.disruption_reason,
    fare_difference: bookings?.fare_difference
  };
}

module.exports = {
  createApprovalRequest,
  getPendingApprovals,
  getApprovalHistory,
  getApprovalById,
  resolveApproval
};
