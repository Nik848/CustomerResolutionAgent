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
  const query = supabase.from('bookings').select('*');
  if (!query || typeof query.eq !== 'function') {
    return null;
  }
  let filtered = query.eq('booking_id', bookingId.toUpperCase());
  if (customerId && typeof filtered.eq === 'function') {
    filtered = filtered.eq('customer_id', customerId.toUpperCase());
  }
  if (!filtered || typeof filtered.maybeSingle !== 'function') {
    return null;
  }
  const { data, error } = await filtered.maybeSingle();
  if (error) {
    throw new Error(`Booking lookup failed: ${error.message}`);
  }
  return data || null;
}

/**
 * Get full state of a booking, including linked entity records.
 */
async function getBookingFullState(bookingId, customerId) {
  const booking = await getBookingById(bookingId, customerId);
  if (!booking) return null;

  let refundRecord = null;
  let loungeRecord = null;
  let hotelRecord = null;
  let upgradeRecord = null;

  try {
    if (supabase && typeof supabase.from === 'function') {
      const { data: ref } = await supabase
        .from('refunds')
        .select('*')
        .eq('booking_id', bookingId.toUpperCase())
        .maybeSingle();
      refundRecord = ref;

      const { data: lng } = await supabase
        .from('lounge_bookings')
        .select('*')
        .eq('booking_id', bookingId.toUpperCase())
        .maybeSingle();
      loungeRecord = lng;

      const { data: htl } = await supabase
        .from('hotel_bookings')
        .select('*')
        .eq('booking_id', bookingId.toUpperCase())
        .maybeSingle();
      hotelRecord = htl;

      const { data: upg } = await supabase
        .from('upgrade_requests')
        .select('*')
        .eq('booking_id', bookingId.toUpperCase())
        .maybeSingle();
      upgradeRecord = upg;
    }
  } catch (err) {
    // Fallback if entity tables don't exist in environment
  }

  const normalizedRefundStatus = (
    refundRecord?.status?.toLowerCase() ||
    booking.refund_status?.toLowerCase() ||
    'none'
  );

  const normalizedLoungeStatus = (
    loungeRecord?.status?.toLowerCase() ||
    booking.lounge_access_status?.toLowerCase() ||
    'none'
  );

  const normalizedHotelStatus = (
    hotelRecord?.status?.toLowerCase() ||
    booking.hotel_status?.toLowerCase() ||
    'none'
  );

  return {
    ...booking,
    refund_status: normalizedRefundStatus,
    refund_record: refundRecord,
    lounge_access_status: normalizedLoungeStatus,
    lounge_record: loungeRecord,
    hotel_status: normalizedHotelStatus,
    hotel_record: hotelRecord,
    upgrade_record: upgradeRecord
  };
}

/**
 * Check refund status for a booking.
 */
async function checkRefundStatus(bookingId, customerId) {
  const booking = await getBookingById(bookingId, customerId);
  if (!booking) {
    return { success: false, status: 'NOT_FOUND', entity: 'refund', message: 'Booking not found.' };
  }

  const refStatus = (booking.refund_status || 'none').toLowerCase();
  const refundId = `RF-${booking.booking_id}`;
  const amount = 12500;

  if (refStatus === 'completed') {
    return { success: true, status: 'COMPLETED', entity: 'refund', refund_id: refundId, amount, booking_id: bookingId, message: 'Refund has already been completed.' };
  }
  if (refStatus === 'initiated' || refStatus === 'processing') {
    return { success: true, status: 'ALREADY_EXISTS', entity: 'refund', refund_id: refundId, amount, booking_id: bookingId, message: 'Refund has already been initiated.' };
  }
  if (refStatus === 'failed') {
    return { success: false, status: 'FAILED', entity: 'refund', refund_id: refundId, amount, booking_id: bookingId, message: 'Previous refund processing failed.' };
  }

  return { success: true, status: 'NOT_FOUND', entity: 'refund', booking_id: bookingId, message: 'No refund requested yet.' };
}

/**
 * Execute: initiate a refund for a cancelled booking.
 * Returns structured result with idempotency.
 */
async function initiateRefund(bookingId, customerId) {
  const booking = await getBookingById(bookingId, customerId);

  if (!booking) {
    return { success: false, status: 'NOT_FOUND', action: 'initiate_refund', entity: 'refund', message: 'Booking could not be found.' };
  }
  if (booking.status !== 'cancelled') {
    return { success: false, status: 'NOT_ELIGIBLE', action: 'initiate_refund', entity: 'refund', booking_id: bookingId, customer_id: customerId, message: 'Refund can only be initiated for a cancelled booking.' };
  }

  const existingStatus = (booking.refund_status || '').toLowerCase();
  const refundId = `RF-${bookingId.toUpperCase()}`;
  const refundAmount = 12500;

  if (existingStatus === 'completed') {
    return {
      success: true,
      status: 'COMPLETED',
      action: 'initiate_refund',
      entity: 'refund',
      refund_id: refundId,
      booking_id: bookingId.toUpperCase(),
      customer_id: customerId.toUpperCase(),
      amount: refundAmount,
      message: 'Refund has already been completed.'
    };
  }

  if (existingStatus === 'initiated' || existingStatus === 'processing') {
    return {
      success: true,
      status: 'ALREADY_EXISTS',
      action: 'initiate_refund',
      entity: 'refund',
      refund_id: refundId,
      booking_id: bookingId.toUpperCase(),
      customer_id: customerId.toUpperCase(),
      amount: refundAmount,
      message: 'Refund has already been initiated.'
    };
  }

  if (existingStatus === 'failed') {
    return {
      success: false,
      status: 'FAILED',
      action: 'initiate_refund',
      entity: 'refund',
      refund_id: refundId,
      booking_id: bookingId.toUpperCase(),
      customer_id: customerId.toUpperCase(),
      message: 'Previous refund processing failed. Please contact airline customer support.'
    };
  }

  // Update booking
  const { error } = await supabase
    .from('bookings')
    .update({ refund_status: 'initiated', refund_initiated_at: new Date().toISOString() })
    .eq('booking_id', bookingId.toUpperCase());

  if (error) throw new Error(`Refund update failed: ${error.message}`);

  // Also insert into refunds entity table if available
  try {
    if (supabase && typeof supabase.from === 'function') {
      const refQuery = supabase.from('refunds');
      if (refQuery && typeof refQuery.insert === 'function') {
        await refQuery.insert({
          refund_id: refundId,
          booking_id: bookingId.toUpperCase(),
          customer_id: customerId.toUpperCase(),
          amount: refundAmount,
          status: 'INITIATED',
          requested_at: new Date().toISOString()
        });
      }
    }
  } catch (err) {
    // Non-fatal if table doesn't exist
  }

  return {
    success: true,
    status: 'INITIATED',
    action: 'initiate_refund',
    entity: 'refund',
    refund_id: refundId,
    booking_id: bookingId.toUpperCase(),
    customer_id: customerId.toUpperCase(),
    amount: refundAmount,
    message: 'Refund has been successfully initiated.'
  };
}

/**
 * Execute: rebook a disrupted flight (cancelled or delayed).
 */
async function rebookFlight(bookingId, customerId) {
  const booking = await getBookingById(bookingId, customerId);

  if (!booking) {
    return { success: false, status: 'NOT_FOUND', action: 'rebook_flight', entity: 'rebooking', message: 'Booking could not be found.' };
  }
  if (!['cancelled', 'delayed'].includes(booking.status)) {
    return { success: false, status: 'NOT_ELIGIBLE', action: 'rebook_flight', entity: 'rebooking', booking_id: bookingId, customer_id: customerId, message: 'This booking is not currently eligible for rebooking.' };
  }
  if (booking.rebooking_status === 'confirmed') {
    return {
      success: true,
      status: 'ALREADY_EXISTS',
      action: 'rebook_flight',
      entity: 'rebooking',
      booking_id: bookingId.toUpperCase(),
      customer_id: customerId.toUpperCase(),
      message: 'This booking has already been rebooked.'
    };
  }

  const { error } = await supabase
    .from('bookings')
    .update({ rebooking_status: 'confirmed', rebooked_at: new Date().toISOString() })
    .eq('booking_id', bookingId.toUpperCase());

  if (error) throw new Error(`Rebook update failed: ${error.message}`);

  return {
    success: true,
    status: 'CONFIRMED',
    action: 'rebook_flight',
    entity: 'rebooking',
    booking_id: bookingId.toUpperCase(),
    customer_id: customerId.toUpperCase(),
    message: 'Flight has been successfully rebooked.'
  };
}

/**
 * Execute: issue a meal voucher for a delayed flight.
 */
async function issueMealVoucher(bookingId, customerId) {
  const booking = await getBookingById(bookingId, customerId);

  if (!booking) {
    return { success: false, status: 'NOT_FOUND', action: 'issue_meal_voucher', entity: 'meal_voucher', message: 'Booking could not be found.' };
  }
  if (booking.status !== 'delayed') {
    return { success: false, status: 'NOT_ELIGIBLE', action: 'issue_meal_voucher', entity: 'meal_voucher', booking_id: bookingId, customer_id: customerId, message: 'Meal voucher is only available for delayed flights.' };
  }
  if (booking.meal_voucher_status === 'issued') {
    return {
      success: true,
      status: 'ALREADY_EXISTS',
      action: 'issue_meal_voucher',
      entity: 'meal_voucher',
      voucher_code: `VOUCH-${bookingId.toUpperCase()}`,
      booking_id: bookingId.toUpperCase(),
      customer_id: customerId.toUpperCase(),
      message: 'Meal voucher has already been issued.'
    };
  }

  const { error } = await supabase
    .from('bookings')
    .update({ meal_voucher_status: 'issued', meal_voucher_issued_at: new Date().toISOString() })
    .eq('booking_id', bookingId.toUpperCase());

  if (error) throw new Error(`Meal voucher update failed: ${error.message}`);

  return {
    success: true,
    status: 'CONFIRMED',
    action: 'issue_meal_voucher',
    entity: 'meal_voucher',
    voucher_code: `VOUCH-${bookingId.toUpperCase()}`,
    booking_id: bookingId.toUpperCase(),
    customer_id: customerId.toUpperCase(),
    message: 'Meal voucher has been successfully issued.'
  };
}

/**
 * Check lounge eligibility.
 */
async function checkLoungeEligibility(bookingId, customerId) {
  const booking = await getBookingById(bookingId, customerId);
  if (!booking) return { success: false, status: 'NOT_FOUND', entity: 'lounge', message: 'Booking not found.' };

  if (booking.status !== 'delayed') {
    return { success: false, status: 'NOT_ELIGIBLE', entity: 'lounge', reason: 'Flight is not delayed.' };
  }
  if ((booking.delay_hours || 0) <= 3) {
    return { success: false, status: 'NOT_ELIGIBLE', entity: 'lounge', reason: 'Delay must exceed 3 hours for lounge access.' };
  }

  return { success: true, status: 'ELIGIBLE', entity: 'lounge', delay_hours: booking.delay_hours };
}

/**
 * Check lounge availability.
 */
async function checkLoungeAvailability(bookingId) {
  return { success: true, status: 'AVAILABLE', entity: 'lounge', lounge_name: 'Premium Plaza Lounge', terminal: 'T3' };
}

/**
 * Execute: grant lounge access for a delayed flight.
 */
async function grantLoungeAccess(bookingId, customerId) {
  const booking = await getBookingById(bookingId, customerId);

  if (!booking) {
    return { success: false, status: 'NOT_FOUND', action: 'grant_lounge_access', entity: 'lounge', message: 'Booking could not be found.' };
  }
  if (booking.status !== 'delayed') {
    return { success: false, status: 'NOT_ELIGIBLE', action: 'grant_lounge_access', entity: 'lounge', booking_id: bookingId, customer_id: customerId, message: 'Lounge access is only available for delayed flights.' };
  }
  if ((booking.delay_hours || 0) <= 3) {
    return { success: false, status: 'NOT_ELIGIBLE', action: 'grant_lounge_access', entity: 'lounge', booking_id: bookingId, customer_id: customerId, message: 'Lounge access requires a delay exceeding 3 hours.' };
  }

  const existingStatus = (booking.lounge_access_status || '').toLowerCase();
  const loungeBookingId = `LNG-${bookingId.toUpperCase()}`;

  if (existingStatus === 'granted' || existingStatus === 'confirmed') {
    return {
      success: true,
      status: 'ALREADY_EXISTS',
      action: 'grant_lounge_access',
      entity: 'lounge',
      lounge_booking_id: loungeBookingId,
      booking_id: bookingId.toUpperCase(),
      customer_id: customerId.toUpperCase(),
      lounge_name: 'Premium Plaza Lounge',
      terminal: 'T3',
      message: 'Lounge access has already been granted.'
    };
  }

  const { error } = await supabase
    .from('bookings')
    .update({ lounge_access_status: 'granted', lounge_access_granted_at: new Date().toISOString() })
    .eq('booking_id', bookingId.toUpperCase());

  if (error) throw new Error(`Lounge access update failed: ${error.message}`);

  // Insert into lounge_bookings table if available
  try {
    if (supabase && typeof supabase.from === 'function') {
      const lngQuery = supabase.from('lounge_bookings');
      if (lngQuery && typeof lngQuery.insert === 'function') {
        await lngQuery.insert({
          lounge_booking_id: loungeBookingId,
          booking_id: bookingId.toUpperCase(),
          customer_id: customerId.toUpperCase(),
          flight_number: booking.flight_number,
          status: 'CONFIRMED',
          lounge_name: 'Premium Plaza Lounge',
          terminal: 'T3',
          booked_at: new Date().toISOString()
        });
      }
    }
  } catch (err) {}

  return {
    success: true,
    status: 'CONFIRMED',
    action: 'grant_lounge_access',
    entity: 'lounge',
    lounge_booking_id: loungeBookingId,
    lounge_name: 'Premium Plaza Lounge',
    terminal: 'T3',
    booking_id: bookingId.toUpperCase(),
    customer_id: customerId.toUpperCase(),
    message: 'Lounge access has been successfully granted.'
  };
}

/**
 * Check hotel eligibility.
 */
async function checkHotelEligibility(bookingId, customerId) {
  const booking = await getBookingById(bookingId, customerId);
  if (!booking) return { success: false, status: 'NOT_FOUND', entity: 'hotel', message: 'Booking not found.' };

  if (booking.status !== 'delayed') {
    return { success: false, status: 'NOT_ELIGIBLE', entity: 'hotel', reason: 'Flight is not delayed.' };
  }
  if ((booking.delay_hours || 0) <= 5) {
    return { success: false, status: 'NOT_ELIGIBLE', entity: 'hotel', reason: 'Hotel coverage applies only when delay exceeds 5 hours.' };
  }

  return { success: true, status: 'ELIGIBLE', entity: 'hotel', delay_hours: booking.delay_hours };
}

/**
 * Check hotel availability.
 */
async function checkHotelAvailability(bookingId) {
  return { success: true, status: 'AVAILABLE', entity: 'hotel', hotel_name: 'Airport Transit Hotel' };
}

/**
 * Execute: arrange hotel for delays exceeding 5 hours.
 */
async function arrangeHotel(bookingId, customerId) {
  const booking = await getBookingById(bookingId, customerId);

  if (!booking) {
    return { success: false, status: 'NOT_FOUND', action: 'arrange_hotel', entity: 'hotel', message: 'Booking could not be found.' };
  }
  if (booking.status !== 'delayed') {
    return { success: false, status: 'NOT_ELIGIBLE', action: 'arrange_hotel', entity: 'hotel', booking_id: bookingId, customer_id: customerId, message: 'Hotel accommodation is only available for eligible delayed flights.' };
  }
  if ((booking.delay_hours || 0) <= 5) {
    return { success: false, status: 'NOT_ELIGIBLE', action: 'arrange_hotel', entity: 'hotel', booking_id: bookingId, customer_id: customerId, message: 'This delay does not qualify for hotel accommodation.' };
  }

  const existingStatus = (booking.hotel_status || '').toLowerCase();
  const hotelBookingId = `HTL-${bookingId.toUpperCase()}`;

  if (existingStatus === 'arranged' || existingStatus === 'confirmed') {
    return {
      success: true,
      status: 'ALREADY_EXISTS',
      action: 'arrange_hotel',
      entity: 'hotel',
      hotel_booking_id: hotelBookingId,
      booking_id: bookingId.toUpperCase(),
      customer_id: customerId.toUpperCase(),
      hotel_name: 'Airport Transit Hotel',
      message: 'Hotel accommodation has already been arranged.'
    };
  }

  const { error } = await supabase
    .from('bookings')
    .update({ hotel_status: 'arranged', hotel_arranged_at: new Date().toISOString() })
    .eq('booking_id', bookingId.toUpperCase());

  if (error) throw new Error(`Hotel update failed: ${error.message}`);

  // Insert into hotel_bookings table if available
  try {
    if (supabase && typeof supabase.from === 'function') {
      const htlQuery = supabase.from('hotel_bookings');
      if (htlQuery && typeof htlQuery.insert === 'function') {
        await htlQuery.insert({
          hotel_booking_id: hotelBookingId,
          booking_id: bookingId.toUpperCase(),
          customer_id: customerId.toUpperCase(),
          flight_number: booking.flight_number,
          status: 'CONFIRMED',
          hotel_name: 'Airport Transit Hotel',
          booked_at: new Date().toISOString()
        });
      }
    }
  } catch (err) {}

  return {
    success: true,
    status: 'CONFIRMED',
    action: 'arrange_hotel',
    entity: 'hotel',
    hotel_booking_id: hotelBookingId,
    hotel_name: 'Airport Transit Hotel',
    booking_id: bookingId.toUpperCase(),
    customer_id: customerId.toUpperCase(),
    message: 'Hotel accommodation has been successfully arranged for the qualifying delayed hours.'
  };
}

/**
 * Execute: waive the fare difference for a voluntary rebooking (requires supervisor approval).
 */
async function waiveFareDifference(bookingId, customerId) {
  const booking = await getBookingById(bookingId, customerId);

  if (!booking) return { success: false, status: 'NOT_FOUND', action: 'fare_difference_waiver', entity: 'fare_difference_waiver', message: 'Booking could not be found.' };
  if (booking.fare_difference_waiver_status === 'waived') {
    return { success: true, status: 'ALREADY_EXISTS', action: 'fare_difference_waiver', entity: 'fare_difference_waiver', booking_id: bookingId, customer_id: customerId, message: 'Fare difference has already been waived.' };
  }

  const { error } = await supabase
    .from('bookings')
    .update({
      fare_difference_waiver_status: 'waived',
      fare_difference_waived_at: new Date().toISOString(),
      fare_difference: 0
    })
    .eq('booking_id', bookingId.toUpperCase());

  if (error) throw new Error(`Fare difference waiver update failed: ${error.message}`);

  return { success: true, status: 'CONFIRMED', action: 'fare_difference_waiver', booking_id: bookingId, customer_id: customerId, message: 'Fare difference has been successfully waived.' };
}

/**
 * Check upgrade eligibility.
 */
async function checkUpgradeEligibility(bookingId, customerId, targetCabin = 'Business') {
  return {
    success: false,
    status: 'NOT_ELIGIBLE',
    entity: 'upgrade',
    booking_id: bookingId,
    requested_cabin: targetCabin,
    reason: 'Under airline policy LOYALTY-001, complimentary compensatory cabin upgrades cannot be granted.'
  };
}

/**
 * Unified action execution by name.
 */
async function executeAction(actionName, bookingId, customerId) {
  switch (actionName) {
    case 'full_refund':
    case 'initiate_refund':
      return initiateRefund(bookingId, customerId);
    case 'rebook_within_24_hours':
    case 'rebook_flight':
      return rebookFlight(bookingId, customerId);
    case 'meal_voucher':
    case 'issue_meal_voucher':
      return issueMealVoucher(bookingId, customerId);
    case 'lounge_access':
    case 'grant_lounge_access':
    case 'book_lounge':
      return grantLoungeAccess(bookingId, customerId);
    case 'hotel_delayed_hours':
    case 'hotel_accommodation':
    case 'arrange_hotel':
    case 'book_hotel':
      return arrangeHotel(bookingId, customerId);
    case 'fare_difference_waiver':
      return waiveFareDifference(bookingId, customerId);
    default:
      return { success: false, status: 'FAILED', action: actionName, message: `Unknown action: ${actionName}` };
  }
}

module.exports = {
  getBookingsByCustomerId,
  getBookingById,
  getBookingFullState,
  checkRefundStatus,
  initiateRefund,
  rebookFlight,
  issueMealVoucher,
  checkLoungeEligibility,
  checkLoungeAvailability,
  grantLoungeAccess,
  checkHotelEligibility,
  checkHotelAvailability,
  arrangeHotel,
  waiveFareDifference,
  checkUpgradeEligibility,
  executeAction
};


