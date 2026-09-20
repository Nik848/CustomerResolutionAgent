const express = require('express');
const router = express.Router();
const { authenticate, requireCustomer } = require('../middleware/auth');
const { getBookingsByCustomerId } = require('../services/bookingService');
const { executeAction } = require('../services/bookingService');
const { createApprovalRequest } = require('../services/approvalService');
const { processChat } = require('../services/aiService');
const { appendAuditEvent } = require('../utils/audit');
const { supabase } = require('../db/supabase');

const handleChat = async (req, res) => {
  const customer = req.customer;
  const customerId = customer.customer_id;
  const { message, thread_id } = req.body;

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ detail: 'Message is required.' });
  }

  const threadId = thread_id || `thread-${customerId}-${Date.now()}`;

  // Fetch customer's bookings to send as context
  const bookings = await getBookingsByCustomerId(customerId);

  // Call AI service
  let aiResult;
  try {
    aiResult = await processChat({ customer, bookings, message, threadId });
  } catch (err) {
    if (err.isAiUnavailable) {
      return res.status(503).json({
        status: 'error',
        response: 'AI assistance is temporarily unavailable. Please try again.'
      });
    }
    console.error('[chat] AI service error:', err.message);
    return res.status(502).json({
      status: 'error',
      response: 'An error occurred while processing your request. Please try again.'
    });
  }

  // Handle interrupt — supervisor approval needed
  if (aiResult.status === 'human_approval_required' || aiResult.requires_human_approval) {
    const approvalReq = aiResult.approval_request || {};
    const targetBookingId = approvalReq.booking_id || aiResult.booking_id || aiResult.selected_booking?.booking_id;

    try {
      await createApprovalRequest({
        customerId,
        bookingId: targetBookingId,
        threadId,
        reqType: aiResult.intent || 'fare_difference_waiver',
        reason: approvalReq.reason || 'Waiver exceeds agent authority threshold.',
        details: approvalReq.details || aiResult.decision || {}
      });
    } catch (err) {
      console.error('[chat] Failed to create approval record:', err.message);
    }

    appendAuditEvent({
      event_type: 'human_approval_requested',
      customer_id: customerId,
      details: { thread_id: threadId, message }
    });

    return res.json({
      status: 'human_approval_required',
      response: aiResult.response || 'Your request requires supervisor approval. A supervisor has been notified.',
      interrupt: aiResult.interrupt || {
        type: 'fare_difference_waiver',
        reason: approvalReq.reason || 'Waiver exceeds agent authority threshold.',
        details: approvalReq.details || aiResult.decision || {},
        message: aiResult.response,
        approval_request: approvalReq
      },
      decision: aiResult.decision,
      thread_id: threadId
    });
  }

  // Execute policy-approved actions exclusively on the Node backend
  const actions = aiResult.actions || aiResult.decision?.actions || [];
  const defaultBookingId = aiResult.booking_id || aiResult.selected_booking?.booking_id || aiResult.decision?.booking_id;
  let actionResult = null;

  if (actions.length > 0) {
    const actionResults = [];
    for (const actionItem of actions) {
      const actionName = typeof actionItem === 'string' ? actionItem : actionItem.action;
      const targetBookingId = (typeof actionItem === 'object' && actionItem.booking_id) ? actionItem.booking_id : defaultBookingId;
      if (actionName && targetBookingId) {
        try {
          const result = await executeAction(actionName, targetBookingId, customerId);
          actionResults.push(result);
        } catch (err) {
          console.error(`[chat] Action ${actionName} failed:`, err.message);
          actionResults.push({ success: false, action: actionName, message: err.message });
        }
      }
    }

    if (actionResults.length > 0) {
      appendAuditEvent({
        event_type: 'action_executed',
        customer_id: customerId,
        booking_id: defaultBookingId,
        details: { actions, results: actionResults }
      });
      actionResult = actionResults.length === 1 ? actionResults[0] : actionResults;
    }
  }

  // Preserve any directly mocked action_result for backwards compatibility with tests
  if (!actionResult && aiResult.action_result) {
    actionResult = aiResult.action_result;
  }

  return res.json({
    status: 'completed',
    response: aiResult.response,
    decision: aiResult.decision,
    action_result: actionResult,
    thread_id: threadId
  });
};

router.post('/', authenticate, requireCustomer, handleChat);

router.get('/approval-status/:threadId', authenticate, requireCustomer, async (req, res) => {
  const { threadId } = req.params;
  const customerId = req.customer.customer_id;

  try {
    const { data, error } = await supabase
      .from('approval_requests')
      .select('*')
      .eq('thread_id', threadId)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return res.status(500).json({ detail: error.message });
    }

    if (!data) {
      return res.json({ status: 'none' });
    }

    const aiResponse = data.details?.ai_response || (data.status === 'approved'
      ? `${req.customer.name || 'Customer'}, your supervisor approved the waiver of the fare difference. The fare difference will not be charged and your flight rebooking has been confirmed.`
      : `${req.customer.name || 'Customer'}, your request to waive the fare difference was not approved by the supervisor.`);

    return res.json({
      id: data.id,
      status: data.status,
      booking_id: data.booking_id,
      resolution_note: data.resolution_note,
      response: aiResponse,
      details: data.details
    });
  } catch (err) {
    return res.status(500).json({ detail: err.message });
  }
});

module.exports = {
  router,
  handleChat
};
