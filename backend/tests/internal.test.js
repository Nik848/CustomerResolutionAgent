const request = require('supertest');

jest.mock('../src/db/supabase', () => ({
  supabaseAuth: { auth: { getUser: jest.fn() } },
  supabase: {
    from: jest.fn()
  }
}));

const { supabase } = require('../src/db/supabase');
const app = require('../src/server');

describe('Internal API & Auth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('Missing internal key returns 401', async () => {
    const res = await request(app).get('/api/internal/customers/CUST001');
    expect(res.status).toBe(401);
    expect(res.body.detail).toContain('Missing internal API key');
  });

  test('Invalid internal key returns 403', async () => {
    const res = await request(app)
      .get('/api/internal/customers/CUST001')
      .set('X-Internal-API-Key', 'wrong-key');
    expect(res.status).toBe(403);
    expect(res.body.detail).toContain('Invalid internal API key');
  });

  test('Valid internal key returns customer details', async () => {
    const mockSelect = jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        maybeSingle: jest.fn().mockResolvedValue({
          data: { customer_id: 'CUST001', name: 'Priya Nair' },
          error: null
        })
      })
    });
    supabase.from.mockReturnValue({ select: mockSelect });

    const res = await request(app)
      .get('/api/internal/customers/CUST001')
      .set('X-Internal-API-Key', process.env.INTERNAL_API_KEY || 'airline-internal-secret-key-2026');

    expect(res.status).toBe(200);
    expect(res.body.customer.customer_id).toBe('CUST001');
    expect(res.body.customer.name).toBe('Priya Nair');
  });
});
