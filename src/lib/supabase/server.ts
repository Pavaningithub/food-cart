import { createClient } from '@supabase/supabase-js';

// Server-side client with service role key (bypasses RLS)
// Only use in API routes and server actions
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
