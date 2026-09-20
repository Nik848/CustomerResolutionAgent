const express = require('express');
const router = express.Router();
const { authenticate, requireCustomer } = require('../middleware/auth');
const { getBookingsByCustomerId } = require('../services/bookingService');
const { executeAction } = require('../services/bookingService');
const { createApprovalRequest } = require('../services/approvalService');
const { processChat, resumeWorkflow } = require('../services/aiService');
const { appendAuditEvent } = require('../utils/audit');

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

    try {
      await createApprovalRequest({
        customerId,
        bookingId: approvalReq.booking_id || aiResult.booking_id,
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
      response: 'Your request requires supervisor approval. A supervisor has been notified.',
      thread_id: threadId
    });
  }

  // Execute policy-approved actions on the backend if not already executed by AI service
  let actionResult = aiResult.action_result;
  const actions = aiResult.actions || aiResult.decision?.actions || [];
  const bookingId = aiResult.booking_id || aiResult.selected_booking?.booking_id || aiResult.decision?.booking_id;

  if (!actionResult && actions.length > 0 && bookingId) {
    const actionResults = [];
    for (const action of actions) {
      try {
        const result = await executeAction(action, bookingId, customerId);
        actionResults.push(result);
      } catch (err) {
        console.error(`[chat] Action ${action} failed:`, err.message);
        actionResults.push({ success: false, action, message: err.message });
      }
    }

    appendAuditEvent({
      event_type: 'action_executed',
      customer_id: customerId,
      booking_id: bookingId,
      details: { actions, results: actionResults }
    });

    actionResult = actionResults.length === 1 ? actionResults[0] : (actionResults.length > 1 ? actionResults : null);
  }

  return res.json({
    status: 'completed',
    response: aiResult.response,
    decision: aiResult.decision,
    action_result: actionResult,
    thread_id: threadId
  });
};

const handleResume = async (req, res) => {
  const { decision } = req.body;
  const { thread_id } = req.query;

  if (!thread_id) return res.status(400).json({ detail: 'thread_id is required' });
  if (!['approve', 'reject'].includes(decision)) {
    return res.status(400).json({ detail: "decision must be 'approve' or 'reject'" });
  }

  try {
    const aiResult = await resumeWorkflow({ threadId: thread_id, decision });

    // Execute any actions from resumed workflow
    let actionResults = [];
    const actions = aiResult.actions || [];
    const bookingId = aiResult.booking_id || aiResult.selected_booking?.booking_id;
    const customerId = req.customer.customer_id;

    if (actions.length > 0 && bookingId) {
      for (const action of actions) {
        const result = await executeAction(action, bookingId, customerId);
        actionResults.push(result);
      }
    }

    return res.json({
      status: 'completed',
      response: aiResult.response,
      decision: aiResult.decision,
      action_result: actionResults.length === 1 ? actionResults[0] : (actionResults.length > 1 ? actionResults : null),
      human_approval: aiResult.human_approval
    });
  } catch (err) {
    if (err.isAiUnavailable) {
      return res.status(503).json({ status: 'error', response: 'AI service unavailable.' });
    }
    console.error('[resume] Error:', err.message);
    return res.status(500).json({ status: 'error', response: 'Failed to resume workflow.' });
  }
};

router.post('/', authenticate, requireCustomer, handleChat);
router.post('/resume', authenticate, requireCustomer, handleResume);

module.exports = {
  router,
  handleChat,
  handleResume
};
