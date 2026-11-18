import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Browser } from '@capacitor/browser';

interface StripeConnectButtonProps {
  mentorId: string;
  stripeAccountId: string | null;
  stripeOnboardingComplete: boolean;
  onComplete?: () => void;
}

export default function StripeConnectButton({ mentorId, stripeAccountId, stripeOnboardingComplete, onComplete }: StripeConnectButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    const handler = async () => {
      console.log('browserFinished fired, refreshing mentor state');
      await onComplete?.();
    };
    Browser.addListener('browserFinished', handler);
    return () => {
      Browser.removeListener('browserFinished', handler);
    };
  }, [onComplete]);

  async function handleConnect() {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-stripe-onboarding-link`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ mentorId }),
        }
      );

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to start Stripe onboarding');

      if (!json.onboarding_url) throw new Error('Not a valid URL');

      let opened = false;
      try {
        await Browser.open({ url: json.onboarding_url });
        opened = true;
      } catch (e) {
        console.warn('Capacitor Browser failed, falling back to window.open', e);
        try {
          const w = window.open(json.onboarding_url, '_blank');
          if (w) opened = true;
        } catch (e2) {
          console.warn('window.open also failed', e2);
        }
      }
      if (!opened) setError('Could not open browser. Please check your internet connection.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleReset() {
    setResetting(true);
    setError(null);
    try {
      const { error } = await supabase
        .from('mentors')
        .update({ stripe_account_id: null, stripe_onboarding_complete: false })
        .eq('id', mentorId);
      if (error) throw new Error(error.message || 'Failed to reset payment setup');
      onComplete?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      setError(message);
    } finally {
      setResetting(false);
    }
  }

  if (stripeAccountId && stripeOnboardingComplete) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-800">Stripe is connected</p>
            <p className="text-xs text-slate-500">Your payment setup is ready to receive payouts.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleReset}
            disabled={resetting}
            className="flex-1 py-3 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {resetting ? 'Resetting...' : 'Reset payment setup'}
          </button>
          <button
            onClick={async () => { await Browser.open({ url: 'https://dashboard.stripe.com' }); }}
            className="flex-1 py-3 bg-[#635BFF] hover:bg-[#4F46E5] text-white rounded-xl text-sm font-semibold active:scale-[0.98] transition-all"
          >
            View Stripe dashboard
          </button>
        </div>
        {error && <p className="text-red-600 text-xs">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 p-4 bg-slate-50 border border-slate-100 rounded-xl">
        <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800">Connect Stripe to receive payments</p>
          <p className="text-xs text-slate-500 mt-0.5">You'll be redirected to Stripe to complete setup. Payments will be sent to this account.</p>
        </div>
      </div>
      <button
        onClick={handleConnect}
        disabled={loading}
        className="w-full py-3 bg-[#635BFF] hover:bg-[#4F46E5] text-white rounded-xl font-semibold active:scale-[0.98] transition-all disabled:opacity-50"
      >
        {loading ? 'Connecting...' : 'Connect Stripe Account'}
      </button>
      {error && <p className="text-red-600 text-xs">{error}</p>}
    </div>
  );
}