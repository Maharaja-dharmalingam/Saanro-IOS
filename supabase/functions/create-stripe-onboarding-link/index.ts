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

  if (req.method === 'GET') {
    const html = '<!DOCTYPE html><html><head><title>Onboarding Complete</title></head><body><p>Onboarding complete. Please close this page.</p></body></html>';
    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const jwt = authHeader.replace('Bearer' + ' ', '');
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
    const svcKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const profileRes = await fetch(
      `${supabaseUrl}/rest/v1/profiles?select=id&user_id=eq.${userId}`,
      {
        headers: {
          apikey: svcKey,
          Authorization: `Bearer ${svcKey}`,
        },
      }
    );

    const profileText = await profileRes.text();
    let profiles: any[] = [];
    try {
      const parsed = JSON.parse(profileText);
      if (Array.isArray(parsed)) profiles = parsed;
    } catch {}

    const profile = profiles?.[0];
    if (!profile?.id) {
      return new Response(JSON.stringify({ error: 'Profile not found for user' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const mentorRes = await fetch(
      `${supabaseUrl}/rest/v1/mentors?select=id,stripe_account_id&profile_id=eq.${profile.id}`,
      {
        headers: {
          apikey: svcKey,
          Authorization: `Bearer ${svcKey}`,
        },
      }
    );

    const mentorText = await mentorRes.text();
    let mentors: any[] = [];
    try {
      const parsed = JSON.parse(mentorText);
      if (Array.isArray(parsed)) mentors = parsed;
    } catch {}

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
            JSON.stringify({ error: 'Stripe Accounts v1 is disabled. Enable in Stripe Dashboard.' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        throw accountError;
      }

      // Update stripe_account_id
      await fetch(`${supabaseUrl}/rest/v1/mentors?id=eq.${mentor.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          apikey: svcKey,
          Authorization: `Bearer ${svcKey}`,
          Prefer: 'return:representation',
        },
        body: JSON.stringify({ stripe_account_id: stripeAccountId }),
      });
    }

    // Always update stripe_onboarding_complete to true, regardless of whether account was new or existing
    await fetch(`${supabaseUrl}/rest/v1/mentors?id=eq.${mentor.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        apikey: svcKey,
        Authorization: `Bearer ${svcKey}`,
        Prefer: 'return:representation',
      },
      body: JSON.stringify({ stripe_onboarding_complete: true }),
    });

    const functionUrl = `${supabaseUrl}/functions/v1/create-stripe-onboarding-link`;
    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: functionUrl,
      return_url: functionUrl,
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