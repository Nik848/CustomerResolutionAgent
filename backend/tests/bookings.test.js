const request = require('supertest');

jest.mock('../src/db/supabase', () => ({
  supabaseAuth: { auth: { getUser: jest.fn() } },
  supabase: {
    from: jest.fn()
  }
}));

const { supabaseAuth, supabase } = require('../src/db/supabase');
const app = require('../src/server');

describe('Bookings Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock: valid customer session
    supabaseAuth.auth.getUser.mockResolvedValue({
      data: { user: { id: 'auth-123', email: 'priya@example.com' } },
      error: null
    });

    // Mock profiles -> customer
    const mockProfiles = {
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue({ data: { role: 'customer' }, error: null })
        })
      })
    };

    // Mock customers -> CUST001
    const mockCustomers = {
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue({
            data: { customer_id: 'CUST001', name: 'Priya Nair' },
            error: null
          })
        })
      })
    };

    supabase.from.mockImplementation((table) => {
      if (table === 'profiles') return mockProfiles;
      if (table === 'customers') return mockCustomers;
      if (table === 'bookings') {
        const createQuery = () => {
          const q = {};
          q.eq = jest.fn().mockReturnValue(q);
          q.order = jest.fn().mockResolvedValue({
            data: [
              { booking_id: 'BOOK001', flight_number: 'SK-204', status: 'cancelled' },
              { booking_id: 'BOOK002', flight_number: 'RETURN', status: 'unaffected' }
            ],
            error: null
          });
          q.maybeSingle = jest.fn().mockResolvedValue({
            data: { booking_id: 'BOOK001', flight_number: 'SK-204', customer_id: 'CUST001' },
            error: null
          });
          return q;
        };

        return {
          select: jest.fn().mockImplementation(createQuery)
        };
      }
      return { select: jest.fn() };
    });
  });

  test('GET /api/bookings returns bookings for authenticated customer', async () => {
    const res = await request(app)
      .get('/api/bookings')
      .set('Authorization', 'Bearer valid.customer.token');

    expect(res.status).toBe(200);
    expect(res.body.bookings).toHaveLength(2);
    expect(res.body.bookings[0].flight_number).toBe('SK-204');
  });

  test('GET /api/bookings/:bookingId returns single booking if customer owns it', async () => {
    const res = await request(app)
      .get('/api/bookings/BOOK001')
      .set('Authorization', 'Bearer valid.customer.token');

    expect(res.status).toBe(200);
    expect(res.body.booking.booking_id).toBe('BOOK001');
  });
});
