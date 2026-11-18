import { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Clock, MessageSquare, CheckCircle, CalendarCheck } from 'lucide-react';
import { Mentor } from '../../lib/types';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  getCalendarDays, isSameDay, isToday, isPastDate,
  generateTimeSlots, MONTH_NAMES, formatTime, getUserTimezone, getTimezoneAbbr
} from '../../lib/utils';
import Avatar from '../common/Avatar';
import { useCurrency } from '../../hooks/useCurrency';

interface AppointmentRequestModalProps {
  mentor: Mentor;
  onClose: () => void;
  onSuccess: () => void;
}

type Step = 'calendar' | 'timeslot' | 'confirm';

export default function AppointmentRequestModal({ mentor, onClose, onSuccess }: AppointmentRequestModalProps) {
  const { profile } = useAuth();

  const [step, setStep] = useState<Step>('calendar');

  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());

  const [selectedDate, setSelectedDate] = useState<Date | null>(() => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      return d;
  });
  const [selectedDuration, setSelectedDuration] = useState<30 | 60>(30);
  const [selectedSlot, setSelectedSlot] = useState<{ start: Date; end: Date; label: string } | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [bookedSlots, setBookedSlots] = useState<{ start: Date; end: Date }[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const tz = getUserTimezone();
  const tzAbbr = getTimezoneAbbr();
  const calendarDays = getCalendarDays(currentYear, currentMonth);

  // Slots are generated based on the normalized date
  const timeSlots = selectedDate ? generateTimeSlots(selectedDate, selectedDuration) : [];
  const { formatPrice, formatPriceFrom } = useCurrency();
  const effectivePrice30 = mentor.session_price_30min || mentor.session_price_60min || 0;
  const effectivePrice60 = mentor.session_price_60min || mentor.session_price_30min || 0;

  useEffect(() => {if (!selectedDate || !mentor.id) return;
    fetchBookedSlots(selectedDate);
  }, [selectedDate, selectedDuration, mentor.id]); // Added mentor.id

  async function fetchBookedSlots(date: Date) {
      setLoadingSlots(true);
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);

      try {
        // We query the 'bookings' table for CONFIRMED sessions
        const { data, error } = await supabase
          .from('bookings')
          .select('scheduled_at, duration_minutes')
          .eq('mentor_id', mentor.id)
          .eq('status', 'confirmed') // Only block slots that are officially confirmed
          .gte('scheduled_at', dayStart.toISOString())
          .lte('scheduled_at', dayEnd.toISOString());

        if (error) throw error;

        if (data) {
          const slots = data.map(b => {
            const start = new Date(b.scheduled_at);
            const end = new Date(start.getTime() + b.duration_minutes * 60000);
            return { start, end };
          });
          setBookedSlots(slots);
        }
      } catch (err) {
        console.error("Error fetching confirmed bookings:", err);
      } finally {
        setLoadingSlots(false);
      }

  }

  function isSlotBooked(slot: { start: Date; end: Date }): boolean {
    return bookedSlots.some(booked =>
      slot.start < booked.end && slot.end > booked.start
    );
  }

  const mentorProfile = mentor.profiles;

  function prevMonth() {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1); }
    else setCurrentMonth(m => m - 1);
  }

  function nextMonth() {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1); }
    else setCurrentMonth(m => m + 1);
  }

  async function handleRequest() {
    if (!profile || !selectedSlot) return;
    setLoading(true);
    setError('');

    try {
      console.log('[AppointmentRequestModal] Inserting time_slot...');
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

      if (slotError) {
        console.error('[AppointmentRequestModal] time_slots insert error:', slotError);
        alert('time_slots insert error: ' + JSON.stringify(slotError));
        throw slotError;
      }
      console.log('[AppointmentRequestModal] time_slot created:', slotData.id);

      console.log('[AppointmentRequestModal] Inserting booking...');
      const { error: bookingError } = await supabase
        .from('bookings')
        .insert({
          mentee_id: profile.id,
          mentor_id: mentor.id,
          time_slot_id: slotData.id,
          scheduled_at: selectedSlot.start.toISOString(),
          requested_at: new Date().toISOString(),
          duration_minutes: selectedDuration,
          status: 'pending',
          mentee_timezone: tz,
          mentee_message: message.trim(),
        });

      if (bookingError) {
        console.error('[AppointmentRequestModal] bookings insert error:', bookingError);
        throw bookingError;
      }
      console.log('[AppointmentRequestModal] booking created successfully');

      setSuccess(true);
      setTimeout(() => { onSuccess(); onClose(); }, 2500);
    } catch (err: unknown) {
      const message = (err as Error)?.message || 'Request failed. Please try again.';
      console.error('[AppointmentRequestModal] handleRequest failed:', err, message);
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
        <div className="absolute inset-0 bg-black/50" />
        <div className="relative w-full max-w-sm bg-white rounded-3xl p-8 text-center modal-content">
          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <CalendarCheck size={32} className="text-blue-500" />
          </div>
          <h3 className="text-xl font-bold text-stone-800 mb-2">Request Sent!</h3>
          <p className="text-stone-500 text-sm leading-relaxed">
            Your appointment request has been sent to {mentorProfile?.full_name}.
            You'll be notified once they respond.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 modal-overlay" />

      <div
        className="relative w-full max-w-md bg-white rounded-t-3xl max-h-[90vh] overflow-y-auto modal-content shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white z-10 pt-3 pb-3 px-4 border-b border-stone-100">
          <div className="w-10 h-1 bg-stone-200 rounded-full mx-auto absolute left-1/2 -translate-x-1/2 top-2" />
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-2">
              {step !== 'calendar' && (
                <button
                  onClick={() => setStep(step === 'confirm' ? 'timeslot' : 'calendar')}
                  className="p-1 rounded-lg hover:bg-stone-50"
                >
                  <ChevronLeft size={18} className="text-stone-500" />
                </button>
              )}
              <h2 className="font-bold text-stone-800 text-base">
                {step === 'calendar' && 'Choose a Date'}
                {step === 'timeslot' && 'Pick a Time Slot'}
                {step === 'confirm' && 'Confirm Request'}
              </h2>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-stone-50">
              <X size={18} className="text-stone-500" />
            </button>
          </div>
        </div>

        <div className="p-4">
          {mentorProfile && (
            <div className="flex items-center gap-3 p-3 bg-stone-50 rounded-2xl mb-4">
              <Avatar name={mentorProfile.full_name} imageUrl={mentorProfile.avatar_url} size="sm" />
              <div className="flex-1">
                <p className="font-semibold text-stone-800 text-sm">{mentorProfile.full_name}</p>
                <p className="text-xs text-stone-400 truncate max-w-[180px]">{mentor.headline}</p>
              </div>
              <div className="flex items-center gap-1 bg-amber-50 text-amber-600 text-[10px] font-bold px-2 py-1 rounded-lg whitespace-nowrap">
                <Clock size={10} />
                PENDING APPROVAL
              </div>
            </div>
          )}

          {step === 'calendar' && (
            <div className="animate-fade-in">
              <div className="flex items-center justify-between mb-4">
                <button onClick={prevMonth} className="p-2 rounded-xl hover:bg-stone-50">
                  <ChevronLeft size={18} className="text-stone-600" />
                </button>
                <h3 className="font-semibold text-stone-800">
                  {MONTH_NAMES[currentMonth]} {currentYear}
                </h3>
                <button onClick={nextMonth} className="p-2 rounded-xl hover:bg-stone-50">
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
                  const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
                  const isTodayDay = isToday(day);

                  return (
                    <button
                      key={i}
                      disabled={isPast || !isCurrentMonth}
                      onClick={() => {
                        const normalizedDate = new Date(day);
                        normalizedDate.setHours(0, 0, 0, 0);
                        setSelectedDate(normalizedDate);
                        setStep('timeslot');
                      }}
                      className={`
                        aspect-square flex items-center justify-center rounded-xl text-sm font-medium
                        transition-all duration-150 active:scale-95
                        ${!isCurrentMonth ? 'text-stone-200 cursor-default' : ''}
                        ${isCurrentMonth && isPast ? 'text-stone-300 cursor-default' : ''}
                        ${isCurrentMonth && !isPast && !isSelected ? 'text-stone-700 hover:bg-saffron-50 hover:text-saffron-600' : ''}
                        ${isSelected ? 'bg-saffron-500 text-white shadow-sm' : ''}
                        ${isTodayDay && !isSelected ? 'ring-2 ring-saffron-300 ring-offset-1' : ''}
                      `}
                    >
                      {day.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 'timeslot' && selectedDate && (
            <div className="animate-fade-in">
              <div className="flex gap-2 mb-4">
                {([30, 60] as const).map(dur => (
                  <button
                    key={dur}
                    onClick={() => setSelectedDuration(dur)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all active:scale-95 flex items-center justify-center gap-1.5 ${
                      selectedDuration === dur
                        ? 'bg-saffron-500 text-white border-saffron-500'
                        : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                    }`}
                  >
                    <Clock size={14} />
                    {dur} min
                  </button>
                ))}
              </div>

              <p className="text-xs text-stone-500 font-medium mb-3">
                Available slots — {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>

              {loadingSlots ? (
                <div className="grid grid-cols-3 gap-2">
                  {[...Array(9)].map((_, i) => (
                    <div key={i} className="py-2.5 rounded-xl bg-stone-100 animate-pulse h-9" />
                  ))}
                </div>
              ) : timeSlots.length === 0 ? (
                <div className="text-center py-8">
                  <Clock size={32} className="text-stone-200 mx-auto mb-2" />
                  <p className="text-stone-400 text-sm">No slots available for this date</p>
                  <button onClick={() => setStep('calendar')} className="mt-2 text-saffron-500 text-sm font-medium">
                    Choose another date
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {timeSlots.map((slot, i) => {
                    const isSelected = selectedSlot?.label === slot.label;
                    const booked = isSlotBooked(slot);
                    return (
                      <button
                        key={i}
                        disabled={booked}
                        onClick={() => { setSelectedSlot(slot); setStep('confirm'); }}
                        className={`py-2.5 rounded-xl text-xs font-semibold border transition-all active:scale-95 ${
                          booked
                            ? 'bg-stone-100 text-stone-300 border-stone-100 cursor-not-allowed line-through'
                            : isSelected
                              ? 'bg-saffron-500 text-white border-saffron-500'
                              : 'bg-white text-stone-700 border-stone-200 hover:border-saffron-300 hover:text-saffron-600'
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

          {step === 'confirm' && selectedSlot && (
            <div className="animate-fade-in space-y-4">
              <div className="bg-blue-50 rounded-2xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-stone-500">Date</span>
                  <span className="font-semibold text-stone-800">{selectedDate ? selectedDate.toLocaleDateString() : ''}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-stone-500">Time</span>
                  <span className="font-semibold text-stone-800">{selectedSlot.label}</span>
                </div>
                <div className="flex justify-between text-sm border-t border-blue-100 pt-2">
                  <span className="text-stone-500">Fee</span>
                  <span className="font-bold text-blue-600">
                    {formatPriceFrom(selectedDuration === 30 ? effectivePrice30 : effectivePrice60, mentor.profiles?.preferred_currency || 'USD', profile?.preferred_currency || 'USD')}
                  </span>
                </div>
              </div>

              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Message to mentor (optional)..."
                rows={3}
                className="w-full p-3 rounded-xl border border-stone-200 text-sm outline-none focus:border-saffron-500"
              />

              {error ? (
                <p className="text-red-500 text-xs font-medium bg-red-50 rounded-xl px-3 py-2">
                  {error}
                </p>
              ) : null}

              <button
                onClick={handleRequest}
                disabled={loading}
                className="w-full py-4 bg-blue-600 text-white font-bold rounded-2xl disabled:opacity-50"
              >
                {loading ? 'Sending...' : 'Send Request'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}