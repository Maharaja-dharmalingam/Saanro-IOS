import { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { ShieldCheck, CalendarDays, Clock, CreditCard, Loader2, AlertCircle } from 'lucide-react';
import { useCurrency } from '../../hooks/useCurrency';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? '');

export interface PaymentSummary {
  mentorName: string;
  date: string;        // formatted display string
  time: string;        // formatted display string
  tzAbbr: string;
  durationMinutes: number;
  totalAmountUsd: number; // in dollars (e.g. 120)
}

interface StripePaymentFormProps {
  clientSecret: string;
  summary: PaymentSummary;
  onSuccess: () => void;
  onBack: () => void;
}

export default function StripePaymentForm(props: StripePaymentFormProps) {
  const options = {
    clientSecret: props.clientSecret,
    appearance: {
      theme: 'stripe' as const,
      variables: {
        colorPrimary: '#f97316',
        colorBackground: '#ffffff',
        colorText: '#1c1917',
        colorDanger: '#ef4444',
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        borderRadius: '12px',
        spacingUnit: '4px',
      },
    },
  };

  return (
    <Elements stripe={stripePromise} options={options}>
      <CheckoutForm {...props} />
    </Elements>
  );
}

function CheckoutForm({ summary, onSuccess, onBack }: StripePaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const { formatPrice } = useCurrency();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setProcessing(true);
    setErrorMsg(null);

    const { error } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    });

    if (error) {
      setErrorMsg(error.message ?? 'Payment failed. Please try again.');
      setProcessing(false);
    } else {
      onSuccess();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="animate-fade-in space-y-4">
      {/* Order summary — shows session details and total only, no fee breakdown */}
      <div className="bg-stone-50 rounded-2xl p-4 space-y-2.5">
        <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-1">Order Summary</p>

        <div className="flex items-center gap-2 text-sm">
          <CalendarDays size={13} className="text-stone-400 flex-shrink-0" />
          <span className="text-stone-600">{summary.date}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Clock size={13} className="text-stone-400 flex-shrink-0" />
          <span className="text-stone-600">{summary.time} ({summary.tzAbbr})</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-stone-500">
            {summary.durationMinutes}-min session with {summary.mentorName.split(' ')[0]}
          </span>
        </div>

        <div className="border-t border-stone-200 pt-2.5 flex justify-between items-center">
          <span className="text-sm font-semibold text-stone-700">Total</span>
          <span className="text-lg font-bold text-stone-900">
            {formatPrice(summary.totalAmountUsd)}
          </span>
        </div>
      </div>

      {/* Stripe card input */}
      <div>
        <label className="flex items-center gap-2 text-sm font-semibold text-stone-700 mb-2">
          <CreditCard size={14} className="text-orange-500" />
          Payment Details
        </label>
        <div className="rounded-2xl border border-stone-200 p-3 bg-white">
          <PaymentElement
            options={{
              layout: 'tabs',
              fields: { billingDetails: { address: 'never' } },
            }}
          />
        </div>
      </div>

      {errorMsg && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
          <AlertCircle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-red-600 text-xs leading-relaxed">{errorMsg}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || !elements || processing}
        className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 active:scale-[0.98] text-white font-bold text-base py-4 rounded-2xl transition-all disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {processing ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            Processing…
          </>
        ) : (
          <>
            <CreditCard size={17} />
            Pay {formatPrice(summary.totalAmountUsd)}
          </>
        )}
      </button>

      <button
        type="button"
        onClick={onBack}
        disabled={processing}
        className="w-full py-3 text-sm font-medium text-stone-500 hover:text-stone-700 transition-colors disabled:opacity-50"
      >
        Back
      </button>

      <div className="flex items-center justify-center gap-1.5 text-stone-400 text-xs">
        <ShieldCheck size={12} />
        Secured by Stripe · Your card details are never stored
      </div>
    </form>
  );
}
