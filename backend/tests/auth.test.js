const request = require('supertest');

// Mock supabase db client
jest.mock('../src/db/supabase', () => {
  const mockGetUser = jest.fn();
  const mockFrom = jest.fn();
  return {
    supabaseAuth: {
      auth: {
        getUser: mockGetUser
      }
    },
    supabase: {
      from: mockFrom
    }
  };
});

const { supabaseAuth, supabase } = require('../src/db/supabase');
const app = require('../src/server');

describe('Auth Middleware & /api/me', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('Missing auth header returns 401', async () => {
    const res = await request(app).get('/api/me');
    expect(res.status).toBe(401);
    expect(res.body.detail.toLowerCase()).toContain('token required');
  });

  test('Malformed auth header returns 401', async () => {
    const res = await request(app)
      .get('/api/me')
      .set('Authorization', 'Basic 12345');
    expect(res.status).toBe(401);
    expect(res.body.detail.toLowerCase()).toContain('invalid authorization format');
  });

  test('Invalid token returns 401', async () => {
    supabaseAuth.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: new Error('Invalid or expired token')
    });

    const res = await request(app)
      .get('/api/me')
      .set('Authorization', 'Bearer invalid.token.here');
    expect(res.status).toBe(401);
    expect(res.body.detail.toLowerCase()).toContain('invalid or expired');
  });

  test('Customer with linked profile returns customer info', async () => {
    supabaseAuth.auth.getUser.mockResolvedValue({
      data: {
        user: { id: 'auth-user-123', email: 'priya@example.com' }
      },
      error: null
    });

    // Mock role lookup in profiles -> customer
    const mockProfilesSelect = jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        maybeSingle: jest.fn().mockResolvedValue({ data: { role: 'customer' }, error: null })
      })
    });

    // Mock customer lookup in customers -> Priya
    const mockCustomersSelect = jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        maybeSingle: jest.fn().mockResolvedValue({
          data: {
            customer_id: 'CUST001',
            name: 'Priya Nair',
            email: 'priya.nair@example.com',
            loyalty_tier: 'Gold',
            phone: '+91-98xxxxxxx1',
            travel_history: {}
          },
          error: null
        })
      })
    });

    supabase.from.mockImplementation((table) => {
      if (table === 'profiles') return { select: mockProfilesSelect };
      if (table === 'customers') return { select: mockCustomersSelect };
      return { select: jest.fn() };
    });

    const res = await request(app)
      .get('/api/me')
      .set('Authorization', 'Bearer valid.customer.token');

    expect(res.status).toBe(200);
    expect(res.body.role).toBe('customer');
    expect(res.body.customer_id).toBe('CUST001');
    expect(res.body.name).toBe('Priya Nair');
  });

  test('Admin user returns admin profile', async () => {
    supabaseAuth.auth.getUser.mockResolvedValue({
      data: {
        user: { id: 'auth-admin-999', email: 'admin@airline.com' }
      },
      error: null
    });

    const mockProfilesSelect = jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        maybeSingle: jest.fn().mockResolvedValue({
          data: { role: 'admin', full_name: 'Lead Supervisor' },
          error: null
        })
      })
    });

    supabase.from.mockImplementation((table) => {
      if (table === 'profiles') return { select: mockProfilesSelect };
      return { select: jest.fn() };
    });

    const res = await request(app)
      .get('/api/me')
      .set('Authorization', 'Bearer valid.admin.token');

    expect(res.status).toBe(200);
    expect(res.body.role).toBe('admin');
    expect(res.body.email).toBe('admin@airline.com');
  });
});
