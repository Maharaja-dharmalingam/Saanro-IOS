import { useState } from 'react';
import { X, CheckCircle, Loader2, CalendarDays, Clock, CreditCard } from 'lucide-react';
import { Booking } from '../../lib/types';
import { supabase } from '../../lib/supabase';
import { getUserTimezone, getTimezoneAbbr, formatDate, formatTime } from '../../lib/utils';
import StripePaymentForm, { PaymentSummary } from './StripePaymentForm';
import { useCurrency } from '../../hooks/useCurrency';

interface PostAcceptancePaymentModalProps {
  booking: Booking;
  onClose: () => void;
  onSuccess: () => void;
}

type Step = 'review' | 'payment';

export default function PostAcceptancePaymentModal({ booking, onSuccess, onClose }: PostAcceptancePaymentModalProps) {
  const [step, setStep] = useState<Step>('review');
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [initialising, setInitialising] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const tz = getUserTimezone();
  const tzAbbr = getTimezoneAbbr();
  const { formatPrice } = useCurrency();

  const mentor = booking.mentor;
  const mentorProfile = mentor?.profiles;
  const sessionPrice = booking.duration_minutes === 30
    ? mentor?.session_price_30min ?? 0
    : mentor?.session_price_60min ?? 0;

  async function handleProceedToPayment() {
    setInitialising(true);
    setError('');
    try {
      // Free session — confirm directly without payment
      if (sessionPrice === 0) {
        await handlePaymentSuccess();
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const amountCents = Math.round(sessionPrice * 100);

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-payment-intent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            booking_id: booking.id,
            provider_id: booking.mentor_id,
            total_amount: amountCents,
          }),
        }
      );

      const json = await res.json();
      if (!res.ok || !json.client_secret) {
        throw new Error(json.error || 'Could not initialise payment');
      }

      setClientSecret(json.client_secret);
      setStep('payment');
    } catch (err: unknown) {
      setError((err as Error).message || 'Something went wrong. Please try again.');
    } finally {
      setInitialising(false);
    }
  }

  async function handlePaymentSuccess() {
    await supabase
      .from('bookings')
      .update({ status: 'confirmed', updated_at: new Date().toISOString() })
      .eq('id', booking.id);

    if (booking.time_slot_id) {
      await supabase
        .from('time_slots')
        .update({ is_booked: true })
        .eq('id', booking.time_slot_id);
    }

    setSuccess(true);
    setTimeout(() => { onSuccess(); onClose(); }, 2200);
  }

  if (success) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
        <div className="absolute inset-0 bg-black/50" />
        <div className="relative w-full max-w-sm bg-white rounded-3xl p-8 text-center">
          <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-green-500" />
          </div>
          <h3 className="text-xl font-bold text-stone-800 mb-2">Session Confirmed!</h3>
          <p className="text-stone-500 text-sm leading-relaxed">
            Payment received. Your session with {mentorProfile?.full_name} is now confirmed.
          </p>
        </div>
      </div>
    );
  }

  const summary: PaymentSummary = {
    mentorName: mentorProfile?.full_name ?? 'Mentor',
    date: formatDate(booking.scheduled_at, tz),
    time: formatTime(booking.scheduled_at, tz),
    tzAbbr,
    durationMinutes: booking.duration_minutes,
    totalAmountUsd: sessionPrice,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative w-full max-w-md bg-white rounded-t-3xl max-h-[92vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white z-10 pt-3 pb-3 px-4 border-b border-stone-100">
          <div className="w-10 h-1 bg-stone-200 rounded-full mx-auto absolute left-1/2 -translate-x-1/2 top-2" />
          <div className="flex items-center justify-between mt-2">
            <h2 className="font-bold text-stone-800 text-base">
              {step === 'review' ? 'Complete Your Booking' : 'Secure Payment'}
            </h2>
            <button onClick={onClose} disabled={initialising} className="p-1.5 rounded-xl hover:bg-stone-50">
              <X size={18} className="text-stone-500" />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {step === 'review' && (
            <div className="animate-fade-in space-y-4">
              {/* Mentor accepted banner */}
              <div className="flex items-center gap-2 bg-green-50 border border-green-100 rounded-2xl px-4 py-3">
                <CheckCircle size={16} className="text-green-500 flex-shrink-0" />
                <p className="text-sm text-green-700 font-medium">
                  {sessionPrice === 0
                    ? `${mentorProfile?.full_name ?? 'Your mentor'} has accepted your request. This is a free session — confirm to lock it in.`
                    : `${mentorProfile?.full_name ?? 'Your mentor'} has accepted your request. Complete payment to confirm your session.`}
                </p>
              </div>

              {/* Session details */}
              <div className="bg-stone-50 rounded-2xl p-4 space-y-2.5">
                <div className="flex items-center gap-2 text-sm text-stone-600">
                  <CalendarDays size={14} className="text-stone-400 flex-shrink-0" />
                  <span>{formatDate(booking.scheduled_at, tz)}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-stone-600">
                  <Clock size={14} className="text-stone-400 flex-shrink-0" />
                  <span>{formatTime(booking.scheduled_at, tz)} ({tzAbbr})</span>
                </div>
                <div className="flex justify-between text-sm border-t border-stone-200 pt-2.5">
                  <span className="text-stone-500">{booking.duration_minutes}-min session</span>
                  <span className="font-bold text-stone-900 text-base">{formatPrice(sessionPrice)}</span>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-100 rounded-xl p-3">
                  <p className="text-red-600 text-sm">{error}</p>
                </div>
              )}

              <button
                onClick={handleProceedToPayment}
                disabled={initialising}
                className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 active:scale-[0.98] text-white font-bold text-base py-4 rounded-2xl transition-all disabled:opacity-60"
              >
                {initialising ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Preparing payment…
                  </>
                ) : (
                  <>
                    <CreditCard size={17} />
                    {sessionPrice === 0 ? 'Confirm Session — Free' : `Proceed to Payment · ${formatPrice(sessionPrice)}`}
                  </>
                )}
              </button>
            </div>
          )}

          {step === 'payment' && clientSecret && (
            <StripePaymentForm
              clientSecret={clientSecret}
              summary={summary}
              onSuccess={handlePaymentSuccess}
              onBack={() => setStep('review')}
            />
          )}
        </div>
      </div>
    </div>
  );
}
