const { supabaseAuth, supabase } = require('../db/supabase');

/**
 * Authentication middleware.
 *
 * 1. Reads Authorization: Bearer <token> header.
 * 2. Verifies the JWT with Supabase Auth.
 * 3. Looks up the user's role from public.profiles.
 * 4. If customer: resolves customer_id from public.customers.auth_user_id.
 * 5. Attaches req.user (auth info + role) and req.customer (if applicable).
 */
async function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader) {
    return res.status(401).json({ detail: 'Authentication token required' });
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return res.status(401).json({ detail: "Invalid authorization format. Expected 'Bearer <token>'" });
  }

  const token = parts[1].trim();
  if (!token) {
    return res.status(401).json({ detail: 'Authentication token cannot be empty' });
  }

  // Verify token with Supabase Auth
  let authUser;
  try {
    const { data, error } = await supabaseAuth.auth.getUser(token);
    if (error || !data?.user) {
      return res.status(401).json({ detail: 'Invalid or expired session token' });
    }
    authUser = data.user;
  } catch (err) {
    console.error('[auth] Token verification failed:', err.message);
    return res.status(401).json({ detail: 'Invalid or expired session token' });
  }

  const authUserId = authUser.id;
  const email = authUser.email || '';

  // Lookup role from public.profiles
  let role = 'customer';
  let name = '';
  try {
    let profile = null;
    const { data: profileById } = await supabase
      .from('profiles')
      .select('role, name, email')
      .eq('auth_user_id', authUserId)
      .maybeSingle();

    profile = profileById;

    // Fallback lookup by email if not found by UUID
    if (!profile && email) {
      const { data: profileByEmail } = await supabase
        .from('profiles')
        .select('role, name, email')
        .ilike('email', email.trim())
        .maybeSingle();

      if (profileByEmail) {
        profile = profileByEmail;
        // Keep auth_user_id in sync
        supabase
          .from('profiles')
          .update({ auth_user_id: authUserId })
          .ilike('email', email.trim())
          .then(() => {})
          .catch(() => {});
      }
    }

    if (profile) {
      role = profile.role || 'customer';
      name = profile.name || '';
    }
  } catch (err) {
    console.warn('[auth] Profile lookup fallback:', err.message);
  }

  // Safety guarantee: admin@airline.com is always supervisor/admin
  if (email.toLowerCase() === 'admin@airline.com') {
    role = 'admin';
    name = name || 'Airline Supervisor';
  }

  req.user = { authUserId, email, name, role };

  // For customers: resolve customer_id with email fallback & auto-linking
  if (role === 'customer') {
    try {
      let customer = null;
      const custQuery = supabase.from('customers');
      const sel = custQuery?.select?.('customer_id, name, email, loyalty_tier, phone, travel_history');

      if (sel?.eq) {
        const { data: customerById } = (await sel.eq('auth_user_id', authUserId)?.maybeSingle?.()) || {};
        customer = customerById;
      }

      // Fallback lookup by email and auto-link auth_user_id
      if (!customer && email && custQuery?.select) {
        const emailSel = custQuery.select('customer_id, name, email, loyalty_tier, phone, travel_history');
        const filter = emailSel?.ilike ? emailSel.ilike('email', email.trim()) : (emailSel?.eq ? emailSel.eq('email', email.trim()) : null);
        if (filter?.maybeSingle) {
          const { data: customerByEmail } = (await filter.maybeSingle()) || {};
          if (customerByEmail) {
            customer = customerByEmail;
            // Auto-link customer record so subsequent queries match by auth_user_id
            if (custQuery.update) {
              custQuery
                .update({ auth_user_id: authUserId })
                .eq('customer_id', customer.customer_id)
                .then?.(() => {})
                ?.catch?.(() => {});
            }
          }
        }
      }

      if (customer) {
        req.customer = customer;
      }
    } catch (err) {
      console.error('[auth] Customer lookup failed:', err.message);
    }
  }

  next();
}

/**
 * Requires the authenticated user to be a customer with a linked profile.
 * Must be used after authenticate().
 */
function requireCustomer(req, res, next) {
  if (!req.customer) {
    return res.status(403).json({
      detail: 'Your account is authenticated, but no customer profile is linked to it. Please contact support.'
    });
  }
  next();
}

/**
 * Requires the authenticated user to have the 'admin' role.
 * Must be used after authenticate().
 */
function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ detail: 'Admin privileges required' });
  }
  next();
}

module.exports = { authenticate, requireCustomer, requireAdmin };
