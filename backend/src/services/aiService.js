const axios = require('axios');
require('dotenv').config();

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || '';

const aiClient = axios.create({
  baseURL: AI_SERVICE_URL,
  timeout: 120000, // 2 minutes — LLM calls can be slow
  headers: {
    'Content-Type': 'application/json',
    'X-Internal-API-Key': INTERNAL_API_KEY
  }
});

/**
 * Send a chat request to the AI service.
 *
 * @param {Object} params
 * @param {Object} params.customer   - Customer profile object
 * @param {Array}  params.bookings   - Customer's bookings array
 * @param {string} params.message    - User's message
 * @param {string} params.threadId   - LangGraph thread ID for session continuity
 * @returns {Object} Structured AI response
 */
async function processChat({ customer, bookings, message, threadId }) {
  try {
    const response = await aiClient.post('/api/agent/process', {
      customer,
      bookings,
      message,
      thread_id: threadId
    });
    return response.data;
  } catch (err) {
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
      throw Object.assign(new Error('AI service is temporarily unavailable. Please try again.'), { isAiUnavailable: true });
    }
    const detail = err.response?.data?.detail || err.message;
    throw new Error(`AI service error: ${detail}`);
  }
}

/**
 * Resume a paused LangGraph workflow after admin approve/reject.
 *
 * @param {string} threadId - LangGraph thread ID to resume
 * @param {string} decision - 'approve' or 'reject'
 * @returns {Object} Final AI response after resumption
 */
async function resumeWorkflow({ threadId, decision }) {
  try {
    const response = await aiClient.post('/api/agent/resume', {
      thread_id: threadId,
      decision
    });
    return response.data;
  } catch (err) {
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
      throw Object.assign(new Error('AI service is temporarily unavailable. Please try again.'), { isAiUnavailable: true });
    }
    const detail = err.response?.data?.detail || err.message;
    throw new Error(`AI service resume error: ${detail}`);
  }
}

module.exports = { processChat, resumeWorkflow };
