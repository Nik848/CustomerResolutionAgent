const express = require('express');
const router = express.Router();
const { authenticate, requireCustomer, requireAdmin } = require('../middleware/auth');

/**
 * GET /api/me
 * Returns the authenticated user's profile and role.
 * Admins get admin info; customers get full customer profile.
 */
router.get('/', authenticate, async (req, res) => {
  const { user, customer } = req;

  if (user.role === 'admin') {
    return res.json({
      role: 'admin',
      auth_user_id: user.authUserId,
      email: user.email,
      name: user.name || 'Airline Supervisor'
    });
  }

  if (!customer) {
    return res.status(403).json({
      detail: 'Your account is authenticated, but no customer profile is linked to it. Please contact support.'
    });
  }

  return res.json({
    role: 'customer',
    customer_id: customer.customer_id,
    name: customer.name,
    email: customer.email,
    loyalty_tier: customer.loyalty_tier,
    phone: customer.phone,
    travel_history: customer.travel_history
  });
});

module.exports = router;
