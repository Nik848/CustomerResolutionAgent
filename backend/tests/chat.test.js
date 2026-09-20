const request = require('supertest');

jest.mock('../src/db/supabase', () => ({
  supabaseAuth: { auth: { getUser: jest.fn() } },
  supabase: {
    from: jest.fn()
  }
}));

jest.mock('../src/services/aiService', () => ({
  processChat: jest.fn(),
  resumeWorkflow: jest.fn()
}));

const { supabaseAuth, supabase } = require('../src/db/supabase');
const { processChat } = require('../src/services/aiService');
const app = require('../src/server');

describe('Chat Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    supabaseAuth.auth.getUser.mockResolvedValue({
      data: { user: { id: 'auth-cust-1', email: 'priya@example.com' } },
      error: null
    });

    supabase.from.mockImplementation((table) => {
      if (table === 'profiles') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({ data: { role: 'customer' }, error: null })
            })
          })
        };
      }
      if (table === 'customers') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({
                data: { customer_id: 'CUST001', name: 'Priya Nair' },
                error: null
              })
            })
          })
        };
      }
      if (table === 'bookings') {
        const q = {};
        q.eq = jest.fn().mockReturnValue(q);
        q.order = jest.fn().mockResolvedValue({
          data: [{ booking_id: 'BOOK001', flight_number: 'SK-204', status: 'cancelled' }],
          error: null
        });
        return {
          select: jest.fn().mockReturnValue(q)
        };
      }
      if (table === 'approval_requests') {
        // createApprovalRequest first does a select to check for existing pending,
        // then inserts if none exists.
        const selectChain = {};
        selectChain.eq = jest.fn().mockReturnValue(selectChain);
        selectChain.limit = jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: null, error: null })
        });
        return {
          select: jest.fn().mockReturnValue(selectChain),
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: { id: 'appr-new' }, error: null })
            })
          })
        };
      }
      return { select: jest.fn() };
    });
  });

  test('POST /api/chat with empty message returns 400', async () => {
    const res = await request(app)
      .post('/api/chat')
      .set('Authorization', 'Bearer customer.token')
      .send({ message: '  ' });

    expect(res.status).toBe(400);
    expect(res.body.detail).toContain('Message is required');
  });

  test('POST /api/chat completes successfully', async () => {
    processChat.mockResolvedValue({
      status: 'completed',
      response: 'I have processed your refund.',
      decision: { status: 'eligible_for_refund', actions: ['full_refund'] },
      action_result: { success: true, action: 'full_refund' }
    });

    const res = await request(app)
      .post('/api/chat')
      .set('Authorization', 'Bearer customer.token')
      .send({ message: 'Can I get a refund for SK-204?' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('completed');
    expect(res.body.response).toContain('refund');
  });

  test('POST /api/chat handles supervisor approval required', async () => {
    processChat.mockResolvedValue({
      status: 'human_approval_required',
      requires_human_approval: true,
      approval_request: {
        booking_id: 'BOOK003',
        reason: 'Fare difference exceeds agent limit'
      }
    });

    const res = await request(app)
      .post('/api/chat')
      .set('Authorization', 'Bearer customer.token')
      .send({ message: 'Please waive the fare difference.' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('human_approval_required');
    expect(res.body.response).toContain('supervisor approval');
  });

  test('Customer cannot call /api/resume (returns 404 - customer resume disabled)', async () => {
    const res = await request(app)
      .post('/api/resume')
      .set('Authorization', 'Bearer customer.token')
      .send({ decision: 'approve' });

    expect(res.status).toBe(404);
  });

  test('Customer cannot call /api/chat/resume (returns 404 - customer resume disabled)', async () => {
    const res = await request(app)
      .post('/api/chat/resume')
      .set('Authorization', 'Bearer customer.token')
      .send({ decision: 'approve' });

    expect(res.status).toBe(404);
  });
});
