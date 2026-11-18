import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@13.11.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { booking_id, provider_id, total_amount } = await req.json();

    if (!booking_id || !provider_id || !total_amount) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: booking_id, provider_id, total_amount' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) {
      return new Response(
        JSON.stringify({ error: 'Stripe secret key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const stripe = new Stripe(stripeSecretKey);

    // Look up mentor's Stripe account ID
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const { data: mentor, error: mentorError } = await fetch(
      `${supabaseUrl}/rest/v1/mentors?id=eq.${provider_id}&select=stripe_account_id`,
      {
        headers: {
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
      }
    ).then(res => res.json());

    if (mentorError || !mentor || mentor.length === 0 || !mentor[0]?.stripe_account_id) {
      return new Response(
        JSON.stringify({ error: 'Mentor has not connected their Stripe account' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const stripeAccountId = mentor[0].stripe_account_id;

    // Create payment intent on connected Stripe account
    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: total_amount,
        currency: 'usd',
        application_fee_amount: Math.round(total_amount * 0.1), // 10% platform fee
        transfer_data: {
          destination: stripeAccountId,
        },
        metadata: {
          booking_id,
          provider_id,
        },
      },
      {
        stripeAccount: stripeAccountId,
      }
    );

    return new Response(
      JSON.stringify({ client_secret: paymentIntent.client_secret }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || 'Failed to create payment intent' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
