import { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Clock, MessageSquare, CheckCircle, Loader2 } from 'lucide-react';
import { Mentor } from '../../lib/types';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  getCalendarDays, isSameDay, isToday, isPastDate,
  generateTimeSlots, MONTH_NAMES, formatTime, getUserTimezone, getTimezoneAbbr
} from '../../lib/utils';
import Avatar from '../common/Avatar';
import StripePaymentForm, { PaymentSummary } from './StripePaymentForm';
import { useCurrency } from '../../hooks/useCurrency';

interface BookingModalProps {
  mentor: Mentor;
  onClose: () => void;
  onSuccess: () => void;
}

interface AvailabilityOverride {
  override_date: string;
  is_unavailable: boolean;
  start_hour: number | null;
  start_minute: number | null;
  duration_minutes: number | null;
  note: string | null;
}

interface WeeklySlot {
  day_of_week: number;
  start_hour: number;
  start_minute: number;
  duration_minutes: number;
  is_active: boolean;
}

interface SlotWindow {
  startMin: number;
  durationMinutes: number;
}

type Step = 'calendar' | 'timeslot' | 'confirm' | 'payment';

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function BookingModal({ mentor, onClose, onSuccess }: BookingModalProps) {
  const { profile } = useAuth();
  const [step, setStep] = useState<Step>('calendar');
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<30 | 60>(30);
  const [selectedSlot, setSelectedSlot] = useState<{ start: Date; end: Date; label: string } | null>(null);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [overrides, setOverrides] = useState<AvailabilityOverride[]>([]);
  const [weeklySlots, setWeeklySlots] = useState<WeeklySlot[]>([]);

  // Payment state
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [pendingBookingId, setPendingBookingId] = useState<string | null>(null);
  const [paymentInitialising, setPaymentInitialising] = useState(false);

  const tz = getUserTimezone();
  const tzAbbr = getTimezoneAbbr();
  const calendarDays = getCalendarDays(currentYear, currentMonth);
  const { formatPrice, formatPriceFrom } = useCurrency();
  const effectivePrice30 = mentor.session_price_30min || mentor.session_price_60min || 0;
  const effectivePrice60 = mentor.session_price_60min || mentor.session_price_30min || 0;

  useEffect(() => {
    Promise.all([
      supabase
        .from('mentor_availability_overrides')
        .select('override_date, is_unavailable, start_hour, start_minute, duration_minutes, note')
        .eq('mentor_id', mentor.id),
      supabase
        .from('mentor_availability')
        .select('day_of_week, start_hour, start_minute, duration_minutes, is_active')
        .eq('mentor_id', mentor.id),
    ]).then(([{ data: ovrData }, { data: slotData }]) => {
      if (ovrData) setOverrides(ovrData as AvailabilityOverride[]);
      if (slotData) setWeeklySlots(slotData as WeeklySlot[]);
    });
  }, [mentor.id]);

  const overrideMap = overrides.reduce<Record<string, AvailabilityOverride>>((acc, o) => {
    acc[o.override_date] = o;
    return acc;
  }, {});

  function isDateUnavailable(date: Date) {
    return overrideMap[toDateKey(date)]?.is_unavailable === true;
  }

  function getAllowedWindows(date: Date): SlotWindow[] {
    const dateKey = toDateKey(date);
    const override = overrideMap[dateKey];

    if (override && !override.is_unavailable && override.note) {
      try {
        const saved = JSON.parse(override.note);
        const enabled: string[] = Array.isArray(saved) ? saved : (saved.enabled ?? []);
        const extra: Record<string, number> = (!Array.isArray(saved) && saved.extra) ? saved.extra : {};

        const dow = date.getDay();
        const defaultSlotMap = new Map(
          weeklySlots
            .filter(s => s.day_of_week === dow)
            .map(s => [`${s.start_hour}:${s.start_minute}`, s.duration_minutes])
        );

        return enabled.map(k => {
          const [h, m] = k.split(':').map(Number);
          const dur = extra[k] ?? defaultSlotMap.get(k) ?? 60;
          return { startMin: h * 60 + m, durationMinutes: dur };
        });
      } catch {
        // fall through to weekly
      }
    }

    const dow = date.getDay();
    const active = weeklySlots.filter(s => s.day_of_week === dow && s.is_active);
    return active.map(s => ({ startMin: s.start_hour * 60 + s.start_minute, durationMinutes: s.duration_minutes }));
  }

  const timeSlots = selectedDate
    ? generateTimeSlots(selectedDate, selectedDuration).filter(slot => {
        const windows = getAllowedWindows(selectedDate);
        if (windows.length === 0) return false;
        const slotStart = slot.start.getHours() * 60 + slot.start.getMinutes();
        const slotEnd = slotStart + selectedDuration;
        return windows.some(w => slotStart >= w.startMin && slotEnd <= w.startMin + w.durationMinutes);
      })
    : [];

  const mentorProfile = mentor.profiles;
  const sessionPrice = selectedDuration === 30 ? effectivePrice30 : effectivePrice60;

  function prevMonth() {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1); }
    else setCurrentMonth(m => m - 1);
  }

  function nextMonth() {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1); }
    else setCurrentMonth(m => m + 1);
  }

  // Step 1: create time_slot + booking (status pending_payment), then fetch client_secret
  async function handleProceedToPayment() {
    if (!profile || !selectedSlot) return;
    setPaymentInitialising(true);
    setError('');

    try {
      const { data: slotData, error: slotError } = await supabase
        .from('time_slots')
        .insert({
          mentor_id: mentor.id,
          start_time: selectedSlot.start.toISOString(),
          end_time: selectedSlot.end.toISOString(),
          duration_minutes: selectedDuration,
          timezone: tz,
          is_booked: false,
        })
        .select()
        .single();

      if (slotError) throw slotError;

      const { data: bookingData, error: bookingError } = await supabase
        .from('bookings')
        .insert({
          mentee_id: profile.id,
          mentor_id: mentor.id,
          time_slot_id: slotData.id,
          scheduled_at: selectedSlot.start.toISOString(),
          duration_minutes: selectedDuration,
          status: 'pending',
          mentee_timezone: tz,
          mentee_message: question.trim(),
        })
        .select()
        .single();

      if (bookingError) throw bookingError;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      // total_amount in cents
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
            booking_id: bookingData.id,
            provider_id: mentor.id,
            total_amount: amountCents,
          }),
        }
      );

      const json = await res.json();
      if (!res.ok || !json.client_secret) {
        throw new Error(json.error || 'Could not initialise payment');
      }

      setPendingBookingId(bookingData.id);
      setClientSecret(json.client_secret);
      setStep('payment');
    } catch (err: unknown) {
      setError((err as Error).message || 'Something went wrong. Please try again.');
    } finally {
      setPaymentInitialising(false);
    }
  }

  // Step 2: after Stripe confirms payment, mark booking confirmed and slot booked
  async function handlePaymentSuccess() {
    if (pendingBookingId) {
      const slotQuery = await supabase
        .from('bookings')
        .select('time_slot_id')
        .eq('id', pendingBookingId)
        .maybeSingle();

      await supabase
        .from('bookings')
        .update({ status: 'confirmed' })
        .eq('id', pendingBookingId);

      if (slotQuery.data?.time_slot_id) {
        await supabase
          .from('time_slots')
          .update({ is_booked: true })
          .eq('id', slotQuery.data.time_slot_id);
      }

      if (question.trim()) {
        await supabase.from('questions').insert({
          booking_id: pendingBookingId,
          author_id: profile!.id,
          content: question.trim(),
        });
      }
    }

    setSuccess(true);
    setTimeout(() => { onSuccess(); onClose(); }, 2200);
  }

  const stepTitle: Record<Step, string> = {
    calendar: 'Choose a Date',
    timeslot: 'Pick a Time Slot',
    confirm: 'Review & Pay',
    payment: 'Secure Payment',
  };

  function goBack() {
    if (step === 'timeslot') setStep('calendar');
    else if (step === 'confirm') setStep('timeslot');
    else if (step === 'payment') setStep('confirm');
  }

  if (success) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
        <div className="absolute inset-0 bg-black/50" />
        <div className="relative w-full max-w-sm bg-white rounded-3xl p-8 text-center modal-content">
          <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-green-500" />
          </div>
          <h3 className="text-xl font-bold text-stone-800 mb-2">Session Confirmed!</h3>
          <p className="text-stone-500 text-sm leading-relaxed">
            Payment received. Your session with {mentorProfile?.full_name} is confirmed.
            You'll receive a meeting link shortly.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 modal-overlay" />

      <div
        className="relative w-full max-w-md bg-white rounded-t-3xl max-h-[92vh] overflow-y-auto modal-content"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white z-10 pt-3 pb-3 px-4 border-b border-stone-100">
          <div className="w-10 h-1 bg-stone-200 rounded-full mx-auto absolute left-1/2 -translate-x-1/2 top-2" />
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-2">
              {step !== 'calendar' && (
                <button
                  onClick={goBack}
                  className="p-1 rounded-lg hover:bg-stone-50"
                  disabled={paymentInitialising}
                >
                  <ChevronLeft size={18} className="text-stone-500" />
                </button>
              )}
              <h2 className="font-bold text-stone-800 text-base">{stepTitle[step]}</h2>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-stone-50" disabled={paymentInitialising}>
              <X size={18} className="text-stone-500" />
            </button>
          </div>
        </div>

        {/* Step progress indicator */}
        <div className="px-4 pt-3 pb-0">
          <div className="flex items-center gap-1">
            {(['calendar', 'timeslot', 'confirm', 'payment'] as Step[]).map((s, i) => {
              const steps: Step[] = ['calendar', 'timeslot', 'confirm', 'payment'];
              const currentIdx = steps.indexOf(step);
              const stepIdx = i;
              const done = stepIdx < currentIdx;
              const active = stepIdx === currentIdx;
              return (
                <div key={s} className="flex items-center gap-1 flex-1">
                  <div className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                    done ? 'bg-orange-400' : active ? 'bg-orange-500' : 'bg-stone-100'
                  }`} />
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-4">
          {/* Mentor pill — shown on all steps except payment (minimal footprint on payment step) */}
          {mentorProfile && step !== 'payment' && (
            <div className="flex items-center gap-3 p-3 bg-stone-50 rounded-2xl mb-4">
              <Avatar name={mentorProfile.full_name} imageUrl={mentorProfile.avatar_url} size="sm" />
              <div>
                <p className="font-semibold text-stone-800 text-sm">{mentorProfile.full_name}</p>
                <p className="text-xs text-stone-400">{mentor.headline}</p>
              </div>
            </div>
          )}

          {/* ── CALENDAR STEP ── */}
          {step === 'calendar' && (
            <div className="animate-fade-in">
              <div className="flex items-center justify-between mb-4">
                <button onClick={prevMonth} className="p-2 rounded-xl hover:bg-stone-50 active:scale-95 transition-all">
                  <ChevronLeft size={18} className="text-stone-600" />
                </button>
                <h3 className="font-semibold text-stone-800">
                  {MONTH_NAMES[currentMonth]} {currentYear}
                </h3>
                <button onClick={nextMonth} className="p-2 rounded-xl hover:bg-stone-50 active:scale-95 transition-all">
                  <ChevronRight size={18} className="text-stone-600" />
                </button>
              </div>

              <div className="grid grid-cols-7 mb-2">
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                  <div key={d} className="text-center text-xs font-medium text-stone-400 py-1">{d}</div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day, i) => {
                  const isCurrentMonth = day.getMonth() === currentMonth;
                  const isPast = isPastDate(day);
                  const unavailable = isCurrentMonth && !isPast && isDateUnavailable(day);
                  const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
                  const isTodayDay = isToday(day);
                  const isDisabled = isPast || !isCurrentMonth || unavailable;

                  return (
                    <button
                      key={i}
                      disabled={isDisabled}
                      onClick={() => { setSelectedDate(day); setStep('timeslot'); }}
                      className={`
                        relative aspect-square flex items-center justify-center rounded-xl text-sm font-medium
                        transition-all duration-150 active:scale-95
                        ${!isCurrentMonth ? 'text-stone-200 cursor-default' : ''}
                        ${isCurrentMonth && isPast ? 'text-stone-300 cursor-default' : ''}
                        ${isCurrentMonth && !isPast && !isSelected && !unavailable ? 'text-stone-700 hover:bg-orange-50 hover:text-orange-500' : ''}
                        ${isSelected ? 'bg-orange-500 text-white shadow-sm' : ''}
                        ${isTodayDay && !isSelected ? 'ring-2 ring-orange-300 ring-offset-1' : ''}
                        ${unavailable ? 'bg-red-50 text-red-300 cursor-not-allowed line-through' : ''}
                      `}
                    >
                      {day.getDate()}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-3 mt-3 justify-center">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm bg-red-50 border border-red-200" />
                  <span className="text-[10px] text-stone-400">Unavailable</span>
                </div>
              </div>

              <p className="text-xs text-stone-400 text-center mt-4">
                All times in your local timezone ({tzAbbr})
              </p>
            </div>
          )}

          {/* ── DATE UNAVAILABLE ── */}
          {step === 'timeslot' && selectedDate && isDateUnavailable(selectedDate) && (
            <div className="animate-fade-in text-center py-10">
              <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-3">
                <X size={24} className="text-red-400" />
              </div>
              <p className="font-semibold text-stone-700 mb-1">Date Unavailable</p>
              <p className="text-sm text-stone-400 mb-4">The mentor has marked this date as unavailable.</p>
              <button onClick={() => setStep('calendar')} className="text-orange-500 text-sm font-semibold">
                Choose another date
              </button>
            </div>
          )}

          {/* ── TIMESLOT STEP ── */}
          {step === 'timeslot' && selectedDate && !isDateUnavailable(selectedDate) && (
            <div className="animate-fade-in">
              <div className="flex gap-2 mb-4">
                {([30, 60] as const).map(dur => (
                  <button
                    key={dur}
                    onClick={() => setSelectedDuration(dur)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all active:scale-95 flex items-center justify-center gap-1.5 ${
                      selectedDuration === dur
                        ? 'bg-orange-500 text-white border-orange-500'
                        : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                    }`}
                  >
                    <Clock size={14} />
                    {dur} min
                    <span className={`text-xs ${selectedDuration === dur ? 'text-orange-100' : 'text-stone-400'}`}>
                      {formatPriceFrom(dur === 30 ? effectivePrice30 : effectivePrice60, mentor.profiles?.preferred_currency || 'USD', profile?.preferred_currency || 'USD')}
                    </span>
                  </button>
                ))}
              </div>

              <p className="text-xs text-stone-500 font-medium mb-3">
                Available slots — {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>

              {timeSlots.length === 0 ? (
                <div className="text-center py-8">
                  <Clock size={32} className="text-stone-200 mx-auto mb-2" />
                  <p className="text-stone-400 text-sm">No slots available for this date</p>
                  <button onClick={() => setStep('calendar')} className="mt-2 text-orange-500 text-sm font-medium">
                    Choose another date
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {timeSlots.map((slot, i) => {
                    const isSelected = selectedSlot?.label === slot.label;
                    return (
                      <button
                        key={i}
                        onClick={() => { setSelectedSlot(slot); setStep('confirm'); }}
                        className={`py-2.5 rounded-xl text-xs font-semibold border transition-all active:scale-95 ${
                          isSelected
                            ? 'bg-orange-500 text-white border-orange-500'
                            : 'bg-white text-stone-700 border-stone-200 hover:border-orange-300 hover:text-orange-500'
                        }`}
                      >
                        {slot.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── CONFIRM / REVIEW STEP ── */}
          {step === 'confirm' && selectedDate && selectedSlot && (
            <div className="animate-fade-in space-y-4">
              {/* Booking details */}
              <div className="bg-stone-50 rounded-2xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-stone-500">Date</span>
                  <span className="font-semibold text-stone-800">
                    {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-stone-500">Time</span>
                  <span className="font-semibold text-stone-800">{selectedSlot.label} ({tzAbbr})</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-stone-500">Duration</span>
                  <span className="font-semibold text-stone-800">{selectedDuration} minutes</span>
                </div>
                <div className="flex justify-between text-sm border-t border-stone-200 pt-2">
                  <span className="text-stone-500">Session Fee</span>
                  <span className="font-bold text-stone-900 text-base">
                    {formatPrice(sessionPrice)}
                  </span>
                </div>
              </div>

              {/* Optional pre-session question */}
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-stone-700 mb-2">
                  <MessageSquare size={14} className="text-orange-500" />
                  Pre-session Question (Optional)
                </label>
                <textarea
                  value={question}
                  onChange={e => setQuestion(e.target.value)}
                  placeholder="What would you like to discuss? E.g., 'How do I break into tech from a non-CS background?'"
                  rows={3}
                  className="input-field resize-none text-sm"
                  maxLength={500}
                />
                <p className="text-xs text-stone-400 text-right mt-1">{question.length}/500</p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-100 rounded-xl p-3">
                  <p className="text-red-600 text-sm">{error}</p>
                </div>
              )}

              <button
                onClick={handleProceedToPayment}
                disabled={paymentInitialising}
                className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 active:scale-[0.98] text-white font-bold text-base py-4 rounded-2xl transition-all disabled:opacity-60"
              >
                {paymentInitialising ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Preparing payment…
                  </>
                ) : (
                  `Proceed to Payment · ${formatPrice(sessionPrice)}`
                )}
              </button>
            </div>
          )}

          {/* ── PAYMENT STEP ── */}
          {step === 'payment' && clientSecret && selectedDate && selectedSlot && (
            <StripePaymentForm
              clientSecret={clientSecret}
              summary={{
                mentorName: mentorProfile?.full_name ?? 'Mentor',
                date: selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
                time: selectedSlot.label,
                tzAbbr,
                durationMinutes: selectedDuration,
                totalAmountUsd: sessionPrice,
              } satisfies PaymentSummary}
              onSuccess={handlePaymentSuccess}
              onBack={() => setStep('confirm')}
            />
          )}
        </div>
      </div>
    </div>
  );
}
