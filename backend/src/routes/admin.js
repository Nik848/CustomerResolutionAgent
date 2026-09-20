const express = require('express');
const router = express.Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const { getPendingApprovals, getApprovalHistory, getApprovalById, resolveApproval } = require('../services/approvalService');
const { executeAction } = require('../services/bookingService');
const { resumeWorkflow } = require('../services/aiService');
const { appendAuditEvent } = require('../utils/audit');

/**
 * GET /api/admin/approvals
 * Returns pending + resolved approval history.
 */
router.get('/', authenticate, requireAdmin, async (req, res) => {
  const [pending, history] = await Promise.all([
    getPendingApprovals(),
    getApprovalHistory()
  ]);
  res.json({ pending, history });
});

/**
 * GET /api/admin/approvals/:approvalId
 * Returns full details for a single approval.
 */
router.get('/:approvalId', authenticate, requireAdmin, async (req, res) => {
  try {
    const approval = await getApprovalById(req.params.approvalId);
    res.json(approval);
  } catch (err) {
    if (err.status === 404) return res.status(404).json({ detail: err.message });
    throw err;
  }
});

/**
 * POST /api/admin/approvals/:approvalId/approve
 * Supervisor approves the request.
 * 1. Mark approval_requests as 'approved'
 * 2. Resume the paused LangGraph workflow in AI service
 * 3. Execute any resulting actions against Supabase
 */
router.post('/:approvalId/approve', authenticate, requireAdmin, async (req, res) => {
  const { resolution_note } = req.body || {};

  let resolved;
  try {
    resolved = await resolveApproval({
      approvalId: req.params.approvalId,
      decision: 'approved',
      resolvedBy: req.user.authUserId,
      resolutionNote: resolution_note
    });
  } catch (err) {
    if (err.status === 404) return res.status(404).json({ detail: err.message });
    if (err.status === 400) return res.status(400).json({ detail: err.message });
    throw err;
  }

  appendAuditEvent({
    event_type: 'human_approval_received',
    customer_id: resolved.customer_id,
    booking_id: resolved.booking_id,
    details: { approval_id: resolved.id, decision: 'approved', admin: req.user.authUserId }
  });

  // Resume the LangGraph workflow in AI service
  let aiResult = {};
  try {
    aiResult = await resumeWorkflow({ threadId: resolved.thread_id, decision: 'approve' });
  } catch (err) {
    console.error('[admin/approve] AI resume failed:', err.message);
  }

  // Execute any actions the AI service decided on after approval
  let actionResults = [];
  const actions = aiResult.actions || [];
  const bookingId = resolved.booking_id || aiResult.booking_id;

  if (actions.length > 0 && bookingId) {
    for (const action of actions) {
      try {
        const result = await executeAction(action, bookingId, resolved.customer_id);
        actionResults.push(result);
      } catch (err) {
        console.error(`[admin/approve] Action ${action} failed:`, err.message);
        actionResults.push({ success: false, action, message: err.message });
      }
    }
  }

  res.json({
    status: 'completed',
    approval_id: req.params.approvalId,
    decision: 'approved',
    response: aiResult.response || 'Supervisor approved the request.',
    action_result: actionResults.length === 1 ? actionResults[0] : (actionResults.length > 1 ? actionResults : null),
    human_approval: aiResult.human_approval
  });
});

/**
 * POST /api/admin/approvals/:approvalId/reject
 * Supervisor rejects the request.
 */
router.post('/:approvalId/reject', authenticate, requireAdmin, async (req, res) => {
  const { resolution_note } = req.body || {};

  let resolved;
  try {
    resolved = await resolveApproval({
      approvalId: req.params.approvalId,
      decision: 'rejected',
      resolvedBy: req.user.authUserId,
      resolutionNote: resolution_note
    });
  } catch (err) {
    if (err.status === 404) return res.status(404).json({ detail: err.message });
    if (err.status === 400) return res.status(400).json({ detail: err.message });
    throw err;
  }

  appendAuditEvent({
    event_type: 'approval_rejected',
    customer_id: resolved.customer_id,
    booking_id: resolved.booking_id,
    details: { approval_id: resolved.id, decision: 'rejected', admin: req.user.authUserId }
  });

  // Resume LangGraph workflow with reject signal
  let aiResult = {};
  try {
    aiResult = await resumeWorkflow({ threadId: resolved.thread_id, decision: 'reject' });
  } catch (err) {
    console.error('[admin/reject] AI resume failed:', err.message);
  }

  res.json({
    status: 'completed',
    approval_id: req.params.approvalId,
    decision: 'rejected',
    response: aiResult.response || 'Supervisor rejected the request.',
    action_result: null,
    human_approval: aiResult.human_approval
  });
});

module.exports = router;
