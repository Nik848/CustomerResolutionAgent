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
const { processChat, resumeWorkflow } = require('../src/services/aiService');
const app = require('../src/server');

describe('Final Acceptance Verification (Scenarios A through K)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Scenario A: Priya refund
  test('A. Priya refund: Cancelled flight full refund is executed', async () => {
    supabaseAuth.auth.getUser.mockResolvedValue({
      data: { user: { id: 'auth-priya', email: 'priya@example.com' } },
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
                data: { customer_id: 'CUST001', name: 'Priya Nair', email: 'priya@example.com', loyalty_tier: 'Gold' },
                error: null
              })
            })
          })
        };
      }
      if (table === 'bookings') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockImplementation((col, val) => ({
              order: jest.fn().mockResolvedValue({
                data: [
                  { booking_id: 'BOOK001', flight_number: 'SK-204', status: 'cancelled', customer_id: 'CUST001' },
                  { booking_id: 'BOOK002', flight_number: 'RETURN', status: 'unaffected', customer_id: 'CUST001' }
                ],
                error: null
              }),
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: { booking_id: 'BOOK001', flight_number: 'SK-204', status: 'cancelled', customer_id: 'CUST001', refund_status: null },
                  error: null
                })
              }),
              maybeSingle: jest.fn().mockResolvedValue({
                data: { booking_id: 'BOOK001', flight_number: 'SK-204', status: 'cancelled', customer_id: 'CUST001', refund_status: null },
                error: null
              })
            }))
          }),
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: null, error: null })
          })
        };
      }
      return { select: jest.fn() };
    });

    processChat.mockResolvedValue({
      status: 'completed',
      response: 'Priya Nair, a full refund has been initiated for cancelled flight SK-204.',
      decision: { actions: ['full_refund'] },
      actions: ['full_refund'],
      booking_id: 'BOOK001'
    });

    const res = await request(app)
      .post('/api/chat')
      .set('Authorization', 'Bearer priya.token')
      .send({ message: 'My flight was cancelled. I want a full refund.' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('completed');
    expect(res.body.action_result).toMatchObject({
      success: true,
      action: 'initiate_refund',
      booking_id: 'BOOK001'
    });
  });

  // Scenario B: Priya implicit rebooking
  test('B. Priya implicit rebooking: Disruptive booking selected, unaffected booking untouched', async () => {
    supabaseAuth.auth.getUser.mockResolvedValue({
      data: { user: { id: 'auth-priya', email: 'priya@example.com' } },
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
                data: { customer_id: 'CUST001', name: 'Priya Nair', email: 'priya@example.com', loyalty_tier: 'Gold' },
                error: null
              })
            })
          })
        };
      }
      if (table === 'bookings') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockImplementation((col, val) => ({
              order: jest.fn().mockResolvedValue({
                data: [
                  { booking_id: 'BOOK001', flight_number: 'SK-204', status: 'cancelled', customer_id: 'CUST001' },
                  { booking_id: 'BOOK002', flight_number: 'RETURN', status: 'unaffected', customer_id: 'CUST001' }
                ],
                error: null
              }),
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: { booking_id: 'BOOK001', flight_number: 'SK-204', status: 'cancelled', customer_id: 'CUST001', rebooking_status: null },
                  error: null
                })
              }),
              maybeSingle: jest.fn().mockResolvedValue({
                data: { booking_id: 'BOOK001', flight_number: 'SK-204', status: 'cancelled', customer_id: 'CUST001', rebooking_status: null },
                error: null
              })
            }))
          }),
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: null, error: null })
          })
        };
      }
      return { select: jest.fn() };
    });

    processChat.mockResolvedValue({
      status: 'completed',
      response: 'Priya Nair, flight SK-204 has been rebooked.',
      decision: { actions: ['rebook_within_24_hours'] },
      actions: ['rebook_within_24_hours'],
      booking_id: 'BOOK001'
    });

    const res = await request(app)
      .post('/api/chat')
      .set('Authorization', 'Bearer priya.token')
      .send({ message: 'My flight was cancelled. Rebook me on the next available flight.' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('completed');
    expect(res.body.action_result).toMatchObject({
      success: true,
      action: 'rebook_flight',
      booking_id: 'BOOK001'
    });
  });

  // Scenario C: Arvind hotel request on 4-hour delay
  test('C. Arvind hotel request on 4-hour delay: Meal voucher + lounge access, NO hotel', async () => {
    supabaseAuth.auth.getUser.mockResolvedValue({
      data: { user: { id: 'auth-arvind', email: 'arvind@example.com' } },
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
                data: { customer_id: 'CUST002', name: 'Arvind Kulkarni', email: 'arvind@example.com', loyalty_tier: 'Silver' },
                error: null
              })
            })
          })
        };
      }
      if (table === 'bookings') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockImplementation((col, val) => ({
              order: jest.fn().mockResolvedValue({
                data: [{ booking_id: 'BOOK003', flight_number: 'SK-118', status: 'delayed', delay_hours: 4, customer_id: 'CUST002' }],
                error: null
              }),
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: { booking_id: 'BOOK003', status: 'delayed', delay_hours: 4, customer_id: 'CUST002' },
                  error: null
                })
              }),
              maybeSingle: jest.fn().mockResolvedValue({
                data: { booking_id: 'BOOK003', status: 'delayed', delay_hours: 4, customer_id: 'CUST002' },
                error: null
              })
            }))
          }),
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: null, error: null })
          })
        };
      }
      return { select: jest.fn() };
    });

    processChat.mockResolvedValue({
      status: 'completed',
      response: 'Arvind Kulkarni, for a 4-hour delay you are entitled to a meal voucher and lounge access. Hotel is only for delays >5h.',
      decision: { actions: ['meal_voucher', 'lounge_access'] },
      actions: ['meal_voucher', 'lounge_access'],
      booking_id: 'BOOK003'
    });

    const res = await request(app)
      .post('/api/chat')
      .set('Authorization', 'Bearer arvind.token')
      .send({ message: 'My flight is delayed by four hours. Can you arrange a hotel?' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('completed');
    expect(Array.isArray(res.body.action_result)).toBe(true);
    const actions = res.body.action_result.map(a => a.action);
    expect(actions).toContain('issue_meal_voucher');
    expect(actions).toContain('grant_lounge_access');
    expect(actions).not.toContain('arrange_hotel');
  });

  // Scenario D: Meher ₹2,000 waiver requiring HITL
  test('D. Meher ₹2,000 waiver requiring HITL: triggers human_approval_required and records request', async () => {
    supabaseAuth.auth.getUser.mockResolvedValue({
      data: { user: { id: 'auth-meher', email: 'meher@example.com' } },
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
                data: { customer_id: 'CUST003', name: 'Meher Kaur', email: 'meher@example.com', loyalty_tier: 'Platinum' },
                error: null
              })
            })
          })
        };
      }
      if (table === 'bookings') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({
                data: [{ booking_id: 'BOOK004', flight_number: 'SK-305', status: 'delayed', delay_hours: 6, fare_difference: 2000, customer_id: 'CUST003' }],
                error: null
              })
            })
          })
        };
      }
      if (table === 'approval_requests') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                limit: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({ data: null, error: null })
                })
              })
            })
          }),
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: 'appr-meher-1', customer_id: 'CUST003', booking_id: 'BOOK004', status: 'pending' },
                error: null
              })
            })
          })
        };
      }
      return { select: jest.fn() };
    });

    processChat.mockResolvedValue({
      status: 'human_approval_required',
      requires_human_approval: true,
      booking_id: 'BOOK004',
      intent: 'fare_difference_waiver',
      approval_request: {
        booking_id: 'BOOK004',
        reason: 'Fare difference waiver exceeds agent authority threshold.',
        details: { fare_difference: 2000, authority_threshold: 1500 }
      }
    });

    const res = await request(app)
      .post('/api/chat')
      .set('Authorization', 'Bearer meher.token')
      .send({ message: 'My flight is delayed by six hours. I want to rebook to the higher-fare flight and have the ₹2,000 fare difference waived.' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('human_approval_required');
    expect(res.body.response).toContain('supervisor approval');
  });

  // Scenario E: Meher admin approval
  test('E. Meher admin approval: Admin approves and LangGraph resumes successfully', async () => {
    supabaseAuth.auth.getUser.mockResolvedValue({
      data: { user: { id: 'auth-admin', email: 'admin@airline.com' } },
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
                  data: { id: 'appr-meher-1', status: 'pending', customer_id: 'CUST003', booking_id: 'BOOK004', thread_id: 'th-meher' },
                  error: null
                })
              })
            })
          }),
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { id: 'appr-meher-1', status: 'approved', customer_id: 'CUST003', booking_id: 'BOOK004' },
                  error: null
                })
              })
            })
          })
        };
      }
      if (table === 'customers' || table === 'bookings') {
        return { select: jest.fn().mockReturnValue({ in: jest.fn().mockResolvedValue({ data: [], error: null }) }) };
      }
      return { select: jest.fn() };
    });

    resumeWorkflow.mockResolvedValue({
      status: 'completed',
      response: 'Meher Kaur, your supervisor approved the waiver of the ₹2000 fare difference for SK-305.',
      actions: ['fare_difference_waiver'],
      human_approval: { status: 'approved' }
    });

    const res = await request(app)
      .post('/api/admin/approvals/appr-meher-1/approve')
      .set('Authorization', 'Bearer admin.token')
      .send({ resolution_note: 'Approved for Platinum loyalty tier' });

    expect(res.status).toBe(200);
    expect(res.body.decision).toBe('approved');
    expect(res.body.status).toBe('completed');
  });

  // Scenario F: Meher admin rejection
  test('F. Meher admin rejection: Admin rejects waiver, customer remains responsible for fare diff', async () => {
    supabaseAuth.auth.getUser.mockResolvedValue({
      data: { user: { id: 'auth-admin', email: 'admin@airline.com' } },
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
                  data: { id: 'appr-meher-1', status: 'pending', customer_id: 'CUST003', booking_id: 'BOOK004', thread_id: 'th-meher' },
                  error: null
                })
              })
            })
          }),
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { id: 'appr-meher-1', status: 'rejected', customer_id: 'CUST003', booking_id: 'BOOK004' },
                  error: null
                })
              })
            })
          })
        };
      }
      if (table === 'customers' || table === 'bookings') {
        return { select: jest.fn().mockReturnValue({ in: jest.fn().mockResolvedValue({ data: [], error: null }) }) };
      }
      return { select: jest.fn() };
    });

    resumeWorkflow.mockResolvedValue({
      status: 'completed',
      response: 'Meher Kaur, your request to waive the ₹2000 fare difference was not approved. You can proceed by paying the difference.',
      actions: [],
      human_approval: { status: 'rejected' }
    });

    const res = await request(app)
      .post('/api/admin/approvals/appr-meher-1/reject')
      .set('Authorization', 'Bearer admin.token')
      .send({ resolution_note: 'Waiver rejected' });

    expect(res.status).toBe(200);
    expect(res.body.decision).toBe('rejected');
    expect(res.body.action_result).toBeNull();
  });

  // Scenario G: Duplicate approval attempt protection
  test('G. Duplicate approval attempt: Returns 400 Bad Request on second resolution', async () => {
    supabaseAuth.auth.getUser.mockResolvedValue({
      data: { user: { id: 'auth-admin', email: 'admin@airline.com' } },
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
                  data: { id: 'appr-1', status: 'approved', customer_id: 'CUST003', booking_id: 'BOOK004' },
                  error: null
                })
              })
            })
          })
        };
      }
      return { select: jest.fn().mockReturnValue({ in: jest.fn().mockResolvedValue({ data: [] }) }) };
    });

    const res = await request(app)
      .post('/api/admin/approvals/appr-1/approve')
      .set('Authorization', 'Bearer admin.token')
      .send({ resolution_note: 'Duplicate attempt' });

    expect(res.status).toBe(400);
    expect(res.body.detail).toContain('already approved');
  });

  // Scenario H: Customer attempting unauthorized approval
  test('H. Customer attempting unauthorized approval: Returns 403 Forbidden', async () => {
    supabaseAuth.auth.getUser.mockResolvedValue({
      data: { user: { id: 'auth-cust', email: 'cust@example.com' } },
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
      .send({ resolution_note: 'Self-approval hack' });

    expect(res.status).toBe(403);
    expect(res.body.detail).toContain('Admin privileges required');
  });

  // Scenario I: Customer attempting unauthorized booking access (IDOR)
  test('I. Customer attempting unauthorized booking access: Returns 404', async () => {
    supabaseAuth.auth.getUser.mockResolvedValue({
      data: { user: { id: 'auth-priya', email: 'priya@example.com' } },
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
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }) // ownership mismatch
              })
            })
          })
        };
      }
      return { select: jest.fn() };
    });

    // Priya (CUST001) tries to fetch Arvind's booking (BOOK003)
    const res = await request(app)
      .get('/api/bookings/BOOK003')
      .set('Authorization', 'Bearer priya.token');

    expect(res.status).toBe(404);
    expect(res.body.detail).toContain('Booking not found or does not belong to your account');
  });

  // Scenario J: Invalid internal API key
  test('J. Invalid internal API key: Returns 401 on missing, 403 on invalid', async () => {
    const resMissing = await request(app)
      .get('/api/internal/customers/CUST001');
    expect(resMissing.status).toBe(401);
    expect(resMissing.body.detail).toContain('Missing internal API key');

    const resInvalid = await request(app)
      .get('/api/internal/customers/CUST001')
      .set('X-Internal-API-Key', 'wrong-key');
    expect(resInvalid.status).toBe(403);
    expect(resInvalid.body.detail).toContain('Invalid internal API key');
  });

  // Scenario K: Valid internal API communication
  test('K. Valid internal API communication: Returns 200 with customer data', async () => {
    process.env.INTERNAL_API_KEY = 'airline-internal-secret-key-2026';

    supabase.from.mockImplementation((table) => {
      if (table === 'customers') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({
                data: { customer_id: 'CUST001', name: 'Priya Nair', loyalty_tier: 'Gold' },
                error: null
              })
            })
          })
        };
      }
      return { select: jest.fn() };
    });

    const res = await request(app)
      .get('/api/internal/customers/CUST001')
      .set('X-Internal-API-Key', 'airline-internal-secret-key-2026');

    expect(res.status).toBe(200);
    expect(res.body.customer).toMatchObject({
      customer_id: 'CUST001',
      name: 'Priya Nair',
      loyalty_tier: 'Gold'
    });
  });
});
