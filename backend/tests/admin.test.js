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
const { resumeWorkflow } = require('../src/services/aiService');
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

  test('Customer cannot approve an approval request (returns 403)', async () => {
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
      .post('/api/admin/approvals/appr-1/approve')
      .set('Authorization', 'Bearer customer.token')
      .send({ resolution_note: 'Attempting self-approval' });

    expect(res.status).toBe(403);
    expect(res.body.detail).toContain('Admin privileges required');
  });

  test('Customer cannot reject an approval request (returns 403)', async () => {
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
      .post('/api/admin/approvals/appr-1/reject')
      .set('Authorization', 'Bearer customer.token')
      .send({ resolution_note: 'Reject' });

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
            data: [{ id: 'appr-1', status: 'pending', customer_id: 'CUST003', booking_id: 'BOOK003' }],
            error: null
          });
          return q;
        };
        return {
          select: jest.fn().mockImplementation(createApprovalQuery)
        };
      }
      if (table === 'customers') {
        return {
          select: jest.fn().mockReturnValue({
            in: jest.fn().mockResolvedValue({
              data: [{ customer_id: 'CUST003', name: 'Meher Kaur', email: 'meher@example.com', loyalty_tier: 'Platinum' }],
              error: null
            })
          })
        };
      }
      if (table === 'bookings') {
        return {
          select: jest.fn().mockReturnValue({
            in: jest.fn().mockResolvedValue({
              data: [{ booking_id: 'BOOK003', pnr: 'SK4821X', flight_number: 'SK-305' }],
              error: null
            })
          })
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

  test('Admin can approve a pending approval request and resume workflow', async () => {
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
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              limit: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: {
                    id: 'appr-1',
                    status: 'pending',
                    customer_id: 'CUST003',
                    booking_id: 'BOOK003',
                    thread_id: 'thread-cust-003'
                  },
                  error: null
                })
              })
            })
          }),
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: {
                    id: 'appr-1',
                    status: 'approved',
                    customer_id: 'CUST003',
                    booking_id: 'BOOK003'
                  },
                  error: null
                })
              })
            })
          })
        };
      }
      if (table === 'customers') {
        return {
          select: jest.fn().mockReturnValue({
            in: jest.fn().mockResolvedValue({
              data: [{ customer_id: 'CUST003', name: 'Meher Kaur' }],
              error: null
            })
          })
        };
      }
      if (table === 'bookings') {
        return {
          select: jest.fn().mockReturnValue({
            in: jest.fn().mockResolvedValue({
              data: [{ booking_id: 'BOOK003', flight_number: 'SK-305' }],
              error: null
            })
          })
        };
      }
      return { select: jest.fn() };
    });

    const res = await request(app)
      .post('/api/admin/approvals/appr-1/approve')
      .set('Authorization', 'Bearer admin.token')
      .send({ resolution_note: 'Approved by supervisor' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('completed');
    expect(res.body.decision).toBe('approved');
    expect(resumeWorkflow).toHaveBeenCalledWith({
      threadId: 'thread-cust-003',
      decision: 'approve'
    });
  });

  test('Cannot resolve an already resolved request (returns 400)', async () => {
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
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              limit: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: {
                    id: 'appr-1',
                    status: 'approved',
                    customer_id: 'CUST003',
                    booking_id: 'BOOK003'
                  },
                  error: null
                })
              })
            })
          })
        };
      }
      if (table === 'customers') {
        return { select: jest.fn().mockReturnValue({ in: jest.fn().mockResolvedValue({ data: [], error: null }) }) };
      }
      if (table === 'bookings') {
        return { select: jest.fn().mockReturnValue({ in: jest.fn().mockResolvedValue({ data: [], error: null }) }) };
      }
      return { select: jest.fn() };
    });

    const res = await request(app)
      .post('/api/admin/approvals/appr-1/approve')
      .set('Authorization', 'Bearer admin.token')
      .send({ resolution_note: 'Trying again' });

    expect(res.status).toBe(400);
    expect(res.body.detail).toContain('already approved');
  });
});
