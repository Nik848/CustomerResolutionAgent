const { supabase } = require('../db/supabase');

/**
 * Fetch a customer by their database customer_id.
 */
async function getCustomerById(customerId) {
  const { data, error } = await supabase
    .from('customers')
    .select('customer_id, name, email, loyalty_tier, phone, travel_history')
    .eq('customer_id', customerId.toUpperCase())
    .maybeSingle();

  if (error) {
    throw new Error(`Customer lookup failed: ${error.message}`);
  }
  return data || null;
}

/**
 * Fetch a customer by their Supabase Auth UUID.
 */
async function getCustomerByAuthUserId(authUserId) {
  const { data, error } = await supabase
    .from('customers')
    .select('customer_id, name, email, loyalty_tier, phone, travel_history')
    .eq('auth_user_id', authUserId)
    .maybeSingle();

  if (error) {
    throw new Error(`Customer lookup by auth_user_id failed: ${error.message}`);
  }
  return data || null;
}

module.exports = { getCustomerById, getCustomerByAuthUserId };
