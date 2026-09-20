const request = require('supertest');

jest.mock('../src/db/supabase', () => ({
  supabaseAuth: { auth: { getUser: jest.fn() } },
  supabase: {
    from: jest.fn()
  }
}));

jest.mock('../src/services/aiService', () => ({
  resumeWorkflow: jest.fn().mockResolvedValue({
    status: 'completed',
    response: 'Supervisor approved waiver.',
    actions: []
  })
}));

const { supabaseAuth, supabase } = require('../src/db/supabase');
const app = require('../src/server');

describe('Admin Approval Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('Customer cannot access admin approvals (returns 403)', async () => {
    supabaseAuth.auth.getUser.mockResolvedValue({
      data: { user: { id: 'auth-cust-1', email: 'cust@example.com' } },
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
      return { select: jest.fn() };
    });

    const res = await request(app)
      .get('/api/admin/approvals')
      .set('Authorization', 'Bearer customer.token');

    expect(res.status).toBe(403);
    expect(res.body.detail).toContain('Admin privileges required');
  });

  test('Admin can list pending and history approvals', async () => {
    supabaseAuth.auth.getUser.mockResolvedValue({
      data: { user: { id: 'auth-admin-1', email: 'admin@airline.com' } },
      error: null
    });

    supabase.from.mockImplementation((table) => {
      if (table === 'profiles') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({ data: { role: 'admin' }, error: null })
            })
          })
        };
      }
      if (table === 'approval_requests') {
        const createApprovalQuery = () => {
          const q = {};
          q.eq = jest.fn().mockReturnValue(q);
          q.neq = jest.fn().mockReturnValue(q);
          q.in = jest.fn().mockReturnValue(q);
          q.order = jest.fn().mockReturnValue(q);
          q.limit = jest.fn().mockResolvedValue({
            data: [{ id: 'appr-1', status: 'pending', customer_id: 'CUST003' }],
            error: null
          });
          return q;
        };
        return {
          select: jest.fn().mockImplementation(createApprovalQuery)
        };
      }
      return { select: jest.fn() };
    });

    const res = await request(app)
      .get('/api/admin/approvals')
      .set('Authorization', 'Bearer admin.token');

    expect(res.status).toBe(200);
    expect(res.body.pending).toBeDefined();
    expect(res.body.history).toBeDefined();
  });
});
