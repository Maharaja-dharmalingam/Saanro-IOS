import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@17.4.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function decodeJWT(token: string): any {
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const jsonPayload = decodeURIComponent(
    atob(base64)
      .split('')
      .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
      .join('')
  );
  return JSON.parse(jsonPayload);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Handle GET requests - Stripe redirects back here after onboarding
  // Return a simple HTML page that the browser can display
  if (req.method === 'GET') {
    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Stripe Onboarding Complete</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>body{font-family:-apple-system,sans-serif;text-align:center;padding:40px;background:#f5f5f5}.msg{background:white;padding:20px;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,0.1);display:inline-block;}</style>
</head>
<body>
<div class="msg">
<h2 style="color:#059669;margin-top:0">✓ Onboarding Complete</h2>
<p style="color:#374151">You can close this window or go back to the app.</p>
</div>
</body>
</html>`;
    const h = new Headers();
    h.set('Content-Type', 'text/html; charset=utf-8');
    h.set('Cache-Control', 'no-cache');
    return new Response(html, { status: 200, headers: h });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const jwt = authHeader.replace('Bearer ', '');
    if (!jwt || jwt.length < 20) {
      return new Response(JSON.stringify({ error: 'Invalid Authorization header format' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let userId: string | null = null;
    try {
      const payload = decodeJWT(jwt);
      userId = payload.sub;
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JWT format' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized: no user id in token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Look up profile by user_id
    const profileRes = await fetch(
      `${supabaseUrl}/rest/v1/profiles?select=id&user_id=eq.${userId}`,
      {
        headers: {
          apikey: supabaseServiceKey,
          Authorization: `Bearer ${supabaseServiceKey}`,
        },
      }
    );

    const profileText = await profileRes.text();
    let profiles: any[] = [];
    try {
      const parsed = JSON.parse(profileText);
      if (Array.isArray(parsed)) profiles = parsed;
    } catch {
      // ignore parse error
    }

    const profile = profiles?.[0];
    if (!profile?.id) {
      return new Response(JSON.stringify({ error: 'Profile not found for user' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Look up mentor record by profile_id
    const mentorRes = await fetch(
      `${supabaseUrl}/rest/v1/mentors?select=id,stripe_account_id&profile_id=eq.${profile.id}`,
      {
        headers: {
          apikey: supabaseServiceKey,
          Authorization: `Bearer ${supabaseServiceKey}`,
        },
      }
    );

    const mentorText = await mentorRes.text();
    let mentors: any[] = [];
    try {
      const parsed = JSON.parse(mentorText);
      if (Array.isArray(parsed)) mentors = parsed;
    } catch {
      // ignore parse error
    }

    const mentor = mentors?.[0];

    if (!mentor) {
      return new Response(JSON.stringify({ error: 'Mentor profile not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) {
      return new Response(JSON.stringify({ error: 'Stripe secret key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const stripe = new Stripe(stripeSecretKey);
    let stripeAccountId = mentor.stripe_account_id;

    if (!stripeAccountId) {
      try {
        const account = await stripe.accounts.create({
          type: 'express',
          capabilities: { transfers: { requested: true } },
        });
        stripeAccountId = account.id;
      } catch (accountError: any) {
        if (accountError?.message?.includes('Accounts v1')) {
          return new Response(
            JSON.stringify({
              error: 'Stripe Accounts v1 is disabled. Enable in Stripe Dashboard.',
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        throw accountError;
      }

      await fetch(`${supabaseUrl}/rest/v1/mentors?id=eq.${mentor.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          apikey: supabaseServiceKey,
          Authorization: `Bearer ${supabaseServiceKey}`,
          Prefer: 'return=representation',
        },
        body: JSON.stringify({ stripe_account_id: stripeAccountId, stripe_onboarding_complete: true }),
      });
    }

    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${supabaseUrl}/functions/v1/create-stripe-onboarding-link`,
      return_url: `${supabaseUrl}/functions/v1/create-stripe-onboarding-link`,
      type: 'account_onboarding',
    });

    return new Response(
      JSON.stringify({ onboarding_url: accountLink.url, stripe_account_id: stripeAccountId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || 'Failed to create onboarding link' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
