const { supabase } = require('../db/supabase');

/**
 * Get all bookings for a customer.
 */
async function getBookingsByCustomerId(customerId) {
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('customer_id', customerId.toUpperCase())
    .order('booking_id');

  if (error) throw new Error(`Bookings lookup failed: ${error.message}`);
  return data || [];
}

/**
 * Get a single booking, verified to belong to the given customer.
 */
async function getBookingById(bookingId, customerId) {
  let query = supabase
    .from('bookings')
    .select('*')
    .eq('booking_id', bookingId.toUpperCase());

  if (customerId) {
    query = query.eq('customer_id', customerId.toUpperCase());
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw new Error(`Booking lookup failed: ${error.message}`);
  }
  return data || null;
}

/**
 * Execute: initiate a refund for a cancelled booking.
 * Returns {success, action, message, booking_id, customer_id}
 */
async function initiateRefund(bookingId, customerId) {
  const booking = await getBookingById(bookingId, customerId);

  if (!booking) return { success: false, action: 'initiate_refund', message: 'Booking could not be found.' };
  if (booking.status !== 'cancelled') return { success: false, action: 'initiate_refund', message: 'Refund can only be initiated for a cancelled booking.' };
  if (booking.refund_status === 'initiated') return { success: false, action: 'initiate_refund', message: 'Refund has already been initiated.' };

  const { error } = await supabase
    .from('bookings')
    .update({ refund_status: 'initiated', refund_initiated_at: new Date().toISOString() })
    .eq('booking_id', bookingId.toUpperCase());

  if (error) throw new Error(`Refund update failed: ${error.message}`);

  return { success: true, action: 'initiate_refund', booking_id: bookingId, customer_id: customerId, message: 'Refund has been successfully initiated.' };
}

/**
 * Execute: rebook a disrupted flight (cancelled or delayed).
 */
async function rebookFlight(bookingId, customerId) {
  const booking = await getBookingById(bookingId, customerId);

  if (!booking) return { success: false, action: 'rebook_flight', message: 'Booking could not be found.' };
  if (!['cancelled', 'delayed'].includes(booking.status)) return { success: false, action: 'rebook_flight', message: 'This booking is not currently eligible for rebooking.' };
  if (booking.rebooking_status === 'confirmed') return { success: false, action: 'rebook_flight', message: 'This booking has already been rebooked.' };

  const { error } = await supabase
    .from('bookings')
    .update({ rebooking_status: 'confirmed', rebooked_at: new Date().toISOString() })
    .eq('booking_id', bookingId.toUpperCase());

  if (error) throw new Error(`Rebook update failed: ${error.message}`);

  return { success: true, action: 'rebook_flight', booking_id: bookingId, customer_id: customerId, message: 'Flight has been successfully rebooked.' };
}

/**
 * Execute: issue a meal voucher for a delayed flight.
 */
async function issueMealVoucher(bookingId, customerId) {
  const booking = await getBookingById(bookingId, customerId);

  if (!booking) return { success: false, action: 'issue_meal_voucher', message: 'Booking could not be found.' };
  if (booking.status !== 'delayed') return { success: false, action: 'issue_meal_voucher', message: 'Meal voucher is only available for delayed flights.' };
  if (booking.meal_voucher_status === 'issued') return { success: false, action: 'issue_meal_voucher', message: 'Meal voucher has already been issued.' };

  const { error } = await supabase
    .from('bookings')
    .update({ meal_voucher_status: 'issued', meal_voucher_issued_at: new Date().toISOString() })
    .eq('booking_id', bookingId.toUpperCase());

  if (error) throw new Error(`Meal voucher update failed: ${error.message}`);

  return { success: true, action: 'issue_meal_voucher', booking_id: bookingId, customer_id: customerId, message: 'Meal voucher has been successfully issued.' };
}

/**
 * Execute: grant lounge access for a delayed flight.
 */
async function grantLoungeAccess(bookingId, customerId) {
  const booking = await getBookingById(bookingId, customerId);

  if (!booking) return { success: false, action: 'grant_lounge_access', message: 'Booking could not be found.' };
  if (booking.status !== 'delayed') return { success: false, action: 'grant_lounge_access', message: 'Lounge access is only available for delayed flights.' };
  if (booking.lounge_access_status === 'granted') return { success: false, action: 'grant_lounge_access', message: 'Lounge access has already been granted.' };

  const { error } = await supabase
    .from('bookings')
    .update({ lounge_access_status: 'granted', lounge_access_granted_at: new Date().toISOString() })
    .eq('booking_id', bookingId.toUpperCase());

  if (error) throw new Error(`Lounge access update failed: ${error.message}`);

  return { success: true, action: 'grant_lounge_access', booking_id: bookingId, customer_id: customerId, message: 'Lounge access has been successfully granted.' };
}

/**
 * Execute: arrange hotel for delays exceeding 5 hours.
 */
async function arrangeHotel(bookingId, customerId) {
  const booking = await getBookingById(bookingId, customerId);

  if (!booking) return { success: false, action: 'arrange_hotel', message: 'Booking could not be found.' };
  if (booking.status !== 'delayed') return { success: false, action: 'arrange_hotel', message: 'Hotel accommodation is only available for eligible delayed flights.' };
  if ((booking.delay_hours || 0) <= 5) return { success: false, action: 'arrange_hotel', message: 'This delay does not qualify for hotel accommodation.' };
  if (booking.hotel_status === 'arranged') return { success: false, action: 'arrange_hotel', message: 'Hotel accommodation has already been arranged.' };

  const { error } = await supabase
    .from('bookings')
    .update({ hotel_status: 'arranged', hotel_arranged_at: new Date().toISOString() })
    .eq('booking_id', bookingId.toUpperCase());

  if (error) throw new Error(`Hotel update failed: ${error.message}`);

  return { success: true, action: 'arrange_hotel', booking_id: bookingId, customer_id: customerId, message: 'Hotel accommodation has been successfully arranged for the qualifying delayed hours.' };
}

/**
 * Execute an action by name. Called from internal route when AI recommends an action.
 */
async function executeAction(actionName, bookingId, customerId) {
  switch (actionName) {
    case 'full_refund':            return initiateRefund(bookingId, customerId);
    case 'rebook_within_24_hours': return rebookFlight(bookingId, customerId);
    case 'meal_voucher':           return issueMealVoucher(bookingId, customerId);
    case 'lounge_access':          return grantLoungeAccess(bookingId, customerId);
    case 'hotel_delayed_hours':
    case 'hotel_accommodation':    return arrangeHotel(bookingId, customerId);
    case 'fare_difference_waiver': return { success: true, action: 'fare_difference_waiver', booking_id: bookingId, customer_id: customerId, message: 'Fare difference waiver confirmed.' };
    default:
      return { success: false, action: actionName, message: `Unknown action: ${actionName}` };
  }
}

module.exports = {
  getBookingsByCustomerId,
  getBookingById,
  initiateRefund,
  rebookFlight,
  issueMealVoucher,
  grantLoungeAccess,
  arrangeHotel,
  executeAction
};
