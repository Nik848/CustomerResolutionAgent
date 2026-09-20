const express = require('express');
const router = express.Router();
const { authenticate, requireCustomer } = require('../middleware/auth');
const { getBookingsByCustomerId, getBookingById } = require('../services/bookingService');

/**
 * GET /api/bookings
 * Returns all bookings for the authenticated customer.
 * Customer identity is strictly from the auth session — never from query params.
 */
router.get('/', authenticate, requireCustomer, async (req, res) => {
  const customerId = req.customer.customer_id;
  const bookings = await getBookingsByCustomerId(customerId);
  res.json({ bookings });
});

/**
 * GET /api/bookings/:bookingId
 * Returns a single booking, verified to belong to the authenticated customer.
 */
router.get('/:bookingId', authenticate, requireCustomer, async (req, res) => {
  const customerId = req.customer.customer_id;
  const booking = await getBookingById(req.params.bookingId, customerId);

  if (!booking) {
    return res.status(404).json({ detail: 'Booking not found or does not belong to your account.' });
  }

  res.json({ booking });
});

module.exports = router;
