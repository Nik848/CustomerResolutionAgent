const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  console.log('Connected to DB');

  // 1. Add policies for profiles to allow anon key access
  console.log('Applying profiles policies...');
  await client.query(`
    -- Enable RLS on profiles if not already
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

    -- Drop existing restrictive/duplicate anon policies if any
    DROP POLICY IF EXISTS "Allow anon key to select profiles" ON public.profiles;
    DROP POLICY IF EXISTS "Allow anon key to insert profiles" ON public.profiles;
    DROP POLICY IF EXISTS "Allow anon key to update profiles" ON public.profiles;
    DROP POLICY IF EXISTS "Allow anon key to delete profiles" ON public.profiles;

    -- Create policies for anon
    CREATE POLICY "Allow anon key to select profiles"
      ON public.profiles FOR SELECT TO anon USING (true);

    CREATE POLICY "Allow anon key to insert profiles"
      ON public.profiles FOR INSERT TO anon WITH CHECK (true);

    CREATE POLICY "Allow anon key to update profiles"
      ON public.profiles FOR UPDATE TO anon USING (true) WITH CHECK (true);

    CREATE POLICY "Allow anon key to delete profiles"
      ON public.profiles FOR DELETE TO anon USING (true);
  `);

  // 2. Add policies for audit_events to allow anon key access
  console.log('Applying audit_events policies...');
  await client.query(`
    -- Enable RLS on audit_events
    ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

    -- Drop existing audit_events anon policies if any
    DROP POLICY IF EXISTS "Allow anon key to select audit_events" ON public.audit_events;
    DROP POLICY IF EXISTS "Allow anon key to insert audit_events" ON public.audit_events;

    -- Create policies for anon
    CREATE POLICY "Allow anon key to select audit_events"
      ON public.audit_events FOR SELECT TO anon USING (true);

    CREATE POLICY "Allow anon key to insert audit_events"
      ON public.audit_events FOR INSERT TO anon WITH CHECK (true);
  `);

  // 3. Ensure profiles table has admin@airline.com properly set
  console.log('Verifying admin in profiles...');
  const res = await client.query(`
    SELECT * FROM public.profiles WHERE email = 'admin@airline.com';
  `);
  console.log('Admin profile row:', res.rows);

  console.log('Policies applied successfully!');
  await client.end();
}

run().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});
