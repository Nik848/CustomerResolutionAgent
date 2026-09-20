const request = require('supertest');

jest.mock('../src/db/supabase', () => ({
  supabaseAuth: { auth: { getUser: jest.fn() } },
  supabase: {
    from: jest.fn()
  }
}));

const { supabase } = require('../src/db/supabase');
const {
  initiateRefund,
  grantLoungeAccess,
  arrangeHotel,
  checkRefundStatus,
  getBookingFullState
} = require('../src/services/bookingService');
const app = require('../src/server');

describe('Backend Stateful Services & Idempotency Verification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('1. initiateRefund on unrefunded booking sets INITIATED', async () => {
    supabase.from.mockImplementation((table) => {
      if (table === 'bookings') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: { booking_id: 'BOOK001', status: 'cancelled', refund_status: null },
                  error: null
                })
              })
            })
          }),
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: null, error: null })
          })
        };
      }
      return { select: jest.fn(), insert: jest.fn().mockResolvedValue({ data: null, error: null }) };
    });

    const res = await initiateRefund('BOOK001', 'CUST001');
    expect(res.success).toBe(true);
    expect(res.status).toBe('INITIATED');
    expect(res.refund_id).toBe('RF-BOOK001');
  });

  test('2. initiateRefund on already initiated booking returns ALREADY_EXISTS (Idempotent)', async () => {
    supabase.from.mockImplementation((table) => {
      if (table === 'bookings') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: { booking_id: 'BOOK001', status: 'cancelled', refund_status: 'initiated' },
                  error: null
                })
              })
            })
          })
        };
      }
      return { select: jest.fn() };
    });

    const res = await initiateRefund('BOOK001', 'CUST001');
    expect(res.success).toBe(true);
    expect(res.status).toBe('ALREADY_EXISTS');
    expect(res.message).toMatch(/already been initiated/i);
  });

  test('3. initiateRefund on completed booking returns COMPLETED', async () => {
    supabase.from.mockImplementation((table) => {
      if (table === 'bookings') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: { booking_id: 'BOOK001', status: 'cancelled', refund_status: 'completed' },
                  error: null
                })
              })
            })
          })
        };
      }
      return { select: jest.fn() };
    });

    const res = await initiateRefund('BOOK001', 'CUST001');
    expect(res.success).toBe(true);
    expect(res.status).toBe('COMPLETED');
    expect(res.message).toMatch(/already been completed/i);
  });

  test('4. grantLoungeAccess on 4-hour delay grants access, second call returns ALREADY_EXISTS', async () => {
    let currentStatus = null;
    supabase.from.mockImplementation((table) => {
      if (table === 'bookings') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockImplementation(() =>
                  Promise.resolve({
                    data: { booking_id: 'BOOK003', status: 'delayed', delay_hours: 4, lounge_access_status: currentStatus },
                    error: null
                  })
                )
              })
            })
          }),
          update: jest.fn().mockImplementation(() => {
            currentStatus = 'granted';
            return { eq: jest.fn().mockResolvedValue({ data: null, error: null }) };
          })
        };
      }
      return { select: jest.fn(), insert: jest.fn().mockResolvedValue({ data: null, error: null }) };
    });

    const res1 = await grantLoungeAccess('BOOK003', 'CUST002');
    expect(res1.success).toBe(true);
    expect(res1.status).toBe('CONFIRMED');

    const res2 = await grantLoungeAccess('BOOK003', 'CUST002');
    expect(res2.success).toBe(true);
    expect(res2.status).toBe('ALREADY_EXISTS');
  });

  test('5. arrangeHotel on 4-hour delay returns NOT_ELIGIBLE, on 6-hour delay succeeds', async () => {
    supabase.from.mockImplementation((table) => {
      if (table === 'bookings') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: { booking_id: 'BOOK003', status: 'delayed', delay_hours: 4, hotel_status: null },
                  error: null
                })
              })
            })
          })
        };
      }
      return { select: jest.fn() };
    });

    const resIneligible = await arrangeHotel('BOOK003', 'CUST002');
    expect(resIneligible.success).toBe(false);
    expect(resIneligible.status).toBe('NOT_ELIGIBLE');

    // 6-hour delay eligible
    supabase.from.mockImplementation((table) => {
      if (table === 'bookings') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: { booking_id: 'BOOK004', status: 'delayed', delay_hours: 6, hotel_status: null },
                  error: null
                })
              })
            })
          }),
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: null, error: null })
          })
        };
      }
      return { select: jest.fn(), insert: jest.fn().mockResolvedValue({ data: null, error: null }) };
    });

    const resEligible = await arrangeHotel('BOOK004', 'CUST003');
    expect(resEligible.success).toBe(true);
    expect(resEligible.status).toBe('CONFIRMED');
    expect(resEligible.hotel_booking_id).toBe('HTL-BOOK004');
  });

  test('6. Internal route GET /api/internal/bookings/:id/state returns full state', async () => {
    supabase.from.mockImplementation((table) => {
      if (table === 'bookings') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: { booking_id: 'BOOK001', status: 'cancelled', refund_status: 'initiated', customer_id: 'CUST001' },
                  error: null
                })
              })
            })
          })
        };
      }
      return {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null })
          })
        })
      };
    });

    const res = await request(app)
      .get('/api/internal/bookings/BOOK001/state?customer_id=CUST001')
      .set('X-Internal-API-Key', 'airline-internal-secret-key-2026');

    expect(res.status).toBe(200);
    expect(res.body.booking_state).toBeDefined();
    expect(res.body.booking_state.booking_id).toBe('BOOK001');
    expect(res.body.booking_state.refund_status).toBe('initiated');
  });
});
