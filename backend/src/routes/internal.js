const express = require('express');
const router = express.Router();
const { requireInternalKey } = require('../middleware/internalAuth');
const { getBookingsByCustomerId, getBookingById, executeAction } = require('../services/bookingService');
const { getCustomerById } = require('../services/customerService');
const { createApprovalRequest } = require('../services/approvalService');
const { appendAuditEvent } = require('../utils/audit');

/**
 * All internal routes are protected by X-Internal-API-Key.
 * These are called ONLY by the Python AI service, never by the browser.
 */

/**
 * GET /api/internal/customers/:customerId
 * AI service retrieves customer profile.
 */
router.get('/customers/:customerId', requireInternalKey, async (req, res) => {
  const customer = await getCustomerById(req.params.customerId);
  if (!customer) return res.status(404).json({ detail: 'Customer not found' });
  res.json({ customer });
});

/**
 * GET /api/internal/bookings?customer_id=...
 * AI service retrieves bookings for a customer.
 */
router.get('/bookings', requireInternalKey, async (req, res) => {
  const { customer_id } = req.query;
  if (!customer_id) return res.status(400).json({ detail: 'customer_id query parameter is required' });

  const bookings = await getBookingsByCustomerId(customer_id);
  res.json({ bookings });
});

/**
 * GET /api/internal/bookings/:bookingId?customer_id=...
 * AI service retrieves a single booking with ownership check.
 */
router.get('/bookings/:bookingId', requireInternalKey, async (req, res) => {
  const { customer_id } = req.query;
  if (!customer_id) return res.status(400).json({ detail: 'customer_id query parameter is required' });

  const booking = await getBookingById(req.params.bookingId, customer_id);
  if (!booking) return res.status(404).json({ detail: 'Booking not found' });
  res.json({ booking });
});

/**
 * POST /api/internal/actions
 * AI service requests an action be executed.
 * Backend validates and executes against Supabase — LLM cannot directly mutate DB.
 *
 * Body: { action: string, booking_id: string, customer_id: string }
 */
router.post('/actions', requireInternalKey, async (req, res) => {
  const { action, booking_id, customer_id } = req.body;

  if (!action || !booking_id || !customer_id) {
    return res.status(400).json({ detail: 'action, booking_id, and customer_id are required' });
  }

  const result = await executeAction(action, booking_id, customer_id);

  appendAuditEvent({
    event_type: 'action_executed',
    customer_id,
    booking_id,
    details: { action, result }
  });

  res.json(result);
});

/**
 * POST /api/internal/approvals
 * AI service signals that supervisor approval is required.
 * Backend creates the approval_requests record.
 *
 * Body: { customer_id, booking_id, thread_id, type, reason, details }
 */
router.post('/approvals', requireInternalKey, async (req, res) => {
  const { customer_id, booking_id, thread_id, type, reason, details } = req.body;

  if (!customer_id || !thread_id) {
    return res.status(400).json({ detail: 'customer_id and thread_id are required' });
  }

  const approval = await createApprovalRequest({
    customerId: customer_id,
    bookingId: booking_id,
    threadId: thread_id,
    reqType: type || 'fare_difference_waiver',
    reason: reason || 'Requires supervisor approval',
    details: details || {}
  });

  appendAuditEvent({
    event_type: 'approval_created',
    customer_id,
    booking_id,
    details: { approval_id: approval.id, type, reason }
  });

  res.json({ approval });
});

module.exports = router;
