import { useState, useEffect, useRef } from 'react';
import {
  Clock,
  Calendar as CalendarIcon,
  CheckCircle2,
  XCircle,
  Video,
  Link2,
  X,
  Plus,
  CreditCard
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useApp, BookingsTab } from '../contexts/AppContext';
import { Mentor } from '../lib/types';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ReviewModal from '../components/booking/ReviewModal';
import PostAcceptancePaymentModal from '../components/booking/PostAcceptancePaymentModal';

export default function BookingsPage() {
  const { profile } = useAuth();
  const { bookingsTab, navigateToBookings } = useApp();

  // Unified tab state using AppContext as source of truth
  const activeTab = bookingsTab;
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mentorData, setMentorData] = useState<Mentor | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<any | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchIdRef = useRef(0);

  useEffect(() => {
    if (profile?.role === 'mentor') {
      fetchMentorProfile();
    }
  }, [profile]);

  // Sync: Re-fetch whenever profile, active tab, or mentor data changes
  useEffect(() => {
    if (profile) {
      fetchBookings();
    }
  }, [profile, activeTab, mentorData]);

  async function fetchMentorProfile() {
    if (!profile) return;
    try {
      const { data } = await supabase
        .from('mentors')
        .select('*')
        .eq('profile_id', profile.id)
        .maybeSingle();
      setMentorData(data as Mentor);
    } catch (err) {
      console.error('[Bookings] Error fetching mentor profile:', err);
    }
  }

  async function fetchBookings(tabOverride?: BookingsTab) {
    if (!profile) return;

    if (profile.role === 'mentor' && !mentorData) {
      setLoading(true);
      return;
    }

    const currentFetchId = ++fetchIdRef.current;
    setLoading(true);

    const activeTabToQuery = tabOverride || activeTab;

    try {
      let query = supabase
        .from('bookings')
        .select(`
          *,
          mentee:profiles!bookings_mentee_id_fkey(*),
          mentor:mentors(*, profile:profiles(*))
        `);

      if (profile.role === 'mentor') {
        query = query.eq('mentor_id', mentorData!.id);
      } else {
        query = query.eq('mentee_id', profile.id);
      }

      if (activeTabToQuery === 'pending') {
        query = query.eq('status', 'pending');
      } else if (activeTabToQuery === 'accepted') {
        query = query.eq('status', 'accepted');
      } else if (activeTabToQuery === 'upcoming') {
        query = query.eq('status', 'confirmed');
      } else if (activeTabToQuery === 'past') {
        query = query.or('status.eq.completed,status.eq.cancelled');
      }

      query = query.order('scheduled_at', { ascending: activeTabToQuery !== 'past' });

      const { data, error } = await query;

      if (currentFetchId !== fetchIdRef.current) return;
      if (error) throw error;

      setBookings(data || []);
    } catch (error) {
      console.error('[Bookings] Error fetching bookings:', error);
    } finally {
      if (currentFetchId === fetchIdRef.current) {
        setLoading(false);
      }
    }
  }

  const handleTabChange = (tab: BookingsTab) => {
    if (tab === activeTab) return;
    setBookings([]);
    navigateToBookings(tab);
    fetchBookings(tab);
  }

  const [showLinkModal, setShowLinkModal] = useState(false);

  async function handleStatusUpdate(booking: any, status: string, meetingLink?: string) {
    if (processingId) return;
    setProcessingId(booking.id);

    try {
      const updates: any = {
        status,
        updated_at: new Date().toISOString()
      };

      if (meetingLink !== undefined) {
        updates.meeting_link = meetingLink;
      }

      const { data, error } = await supabase
        .from('bookings')
        .update(updates)
        .eq('id', booking.id)
        .select();

      if (error) throw error;

      if (!data || data.length === 0) {
        throw new Error('Booking record not found or permission denied.');
      }

      setBookings(prev => prev.filter(b => b.id !== booking.id));

      if (status === 'cancelled' && booking.time_slot_id) {
        await supabase.from('time_slots').update({ is_booked: false }).eq('id', booking.time_slot_id);
      }

      setShowLinkModal(false);

      // Navigate to the appropriate tab
      const targetTab: BookingsTab = status === 'confirmed' ? 'upcoming' :
                                     status === 'completed' ? 'past' :
                                     status === 'cancelled' ? 'upcoming' : 'accepted';

      navigateToBookings(targetTab);
      fetchBookings(targetTab);

    } catch (error: any) {
      console.error('[Bookings] Error:', error);
      setProcessingId(null);
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-amber-100 text-amber-700';
      case 'accepted': return 'bg-orange-100 text-orange-700';
      case 'confirmed': return 'bg-green-100 text-green-700';
      case 'cancelled': return 'bg-red-100 text-red-700';
      case 'completed': return 'bg-blue-100 text-blue-700';
      default: return 'bg-stone-100 text-stone-600';
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTimeRange = (scheduledAt: string, duration: number) => {
    const start = new Date(scheduledAt);
    const end = new Date(start.getTime() + duration * 60000);
    const options: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit', hour12: true };
    return `${start.toLocaleTimeString('en-US', options)} - ${end.toLocaleTimeString('en-US', options)}`;
  };

  if (loading && bookings.length === 0) return <LoadingSpinner />;

  const tabs: Array<{ key: BookingsTab; label: string }> = [
    { key: 'pending', label: 'Pending' },
    { key: 'accepted', label: 'Accepted' },
    { key: 'upcoming', label: 'Confirmed' },
    { key: 'past', label: 'History' },
  ];

  return (
    <div className="pb-24">
      <div className="bg-white border-b border-stone-100 sticky top-0 z-10 px-4">
        <div className="flex overflow-x-auto no-scrollbar gap-6">
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => handleTabChange(key)}
              className={`py-4 text-sm font-semibold capitalize whitespace-nowrap border-b-2 transition-all ${
                activeTab === key
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-stone-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-6">
        {bookings.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-stone-100 shadow-sm">
            <div className="w-16 h-16 bg-stone-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <CalendarIcon size={24} className="text-stone-300" />
            </div>
            <h3 className="text-stone-800 font-bold mb-1">No sessions found</h3>
            <p className="text-stone-400 text-sm">Your {activeTab === 'upcoming' ? 'confirmed' : activeTab === 'past' ? 'past' : activeTab} sessions will appear here.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {bookings.map((booking) => {
              const displayProfile = profile?.role === 'mentor' ? booking.mentee : booking.mentor?.profile;
              const isUpdating = processingId === booking.id;

              return (
                <div
                  key={booking.id}
                  className={`bg-white rounded-3xl p-5 border border-stone-100 shadow-sm hover:shadow-md transition-all ${isUpdating ? 'opacity-50 grayscale pointer-events-none' : ''}`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-stone-100 overflow-hidden border-2 border-white shadow-sm">
                        {displayProfile?.avatar_url ? (
                          <img src={displayProfile.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-green-50 text-green-600 font-bold text-lg leading-none">
                            {displayProfile?.full_name?.charAt(0) || '?'}
                          </div>
                        )}
                      </div>
                      <div>
                        <h4 className="font-bold text-stone-800 leading-tight">
                          {displayProfile?.full_name || 'User'}
                        </h4>
                        <div className="flex items-center gap-1.5 text-[11px] text-stone-400 font-medium uppercase tracking-wider mt-0.5">
                          <span className="px-1.5 py-0.5 bg-stone-50 rounded-md border border-stone-100">
                            {profile?.role === 'mentor' ? 'Mentee' : (booking.mentor?.industry || 'Mentor')}
                          </span>
                        </div>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${getStatusColor(booking.status)}`}>
                      {booking.status === 'confirmed' ? 'Confirmed' : booking.status === 'accepted' ? 'Accepted' : booking.status}
                    </span>
                  </div>

                  <div className="bg-stone-50 rounded-2xl p-4 mb-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center text-stone-400 shadow-sm">
                        <CalendarIcon size={14} />
                      </div>
                      <span className="text-sm font-semibold text-stone-700">
                        {formatDate(booking.scheduled_at)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center text-stone-400 shadow-sm">
                        <Clock size={14} />
                      </div>
                      <span className="text-sm font-semibold text-stone-700">
                        {formatTimeRange(booking.scheduled_at, booking.duration_minutes)}
                      </span>
                    </div>
                  </div>

                  {profile?.role === 'mentor' && booking.status === 'pending' && (
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleStatusUpdate(booking, 'cancelled')}
                        disabled={isUpdating}
                        className="flex-1 py-3 px-4 rounded-xl border border-red-100 text-red-500 text-sm font-bold flex items-center justify-center gap-2 hover:bg-red-50 active:scale-95 transition-all"
                      >
                        <XCircle size={16} />
                        Decline
                      </button>
                      <button
                        onClick={() => {
                          setSelectedBooking(booking);
                          setShowLinkModal(true);
                        }}
                        disabled={isUpdating}
                        className="flex-1 py-3 px-4 rounded-xl bg-green-500 text-white text-sm font-bold flex items-center justify-center gap-2 hover:bg-green-600 transition-colors shadow-lg shadow-green-100"
                      >
                        <CheckCircle2 size={16} />
                        Accept
                      </button>
                    </div>
                  )}

                  {(booking.status === 'accepted' || booking.status === 'confirmed') && (
                    <div className="flex flex-col gap-3">
                      {booking.meeting_link ? (
                        <div className="flex gap-2">
                          <a
                            href={booking.meeting_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => handleStatusUpdate(booking, 'completed')}
                            className="flex-1 py-3 px-4 rounded-xl bg-stone-800 text-white text-sm font-bold flex items-center justify-center gap-2 hover:bg-stone-900 transition-colors"
                          >
                            <Video size={16} />
                            Join Meeting
                          </a>
                          {profile?.role === 'mentor' && (
                            <button
                              onClick={() => {
                                setSelectedBooking(booking);
                                setShowLinkModal(true);
                              }}
                              className="p-3 rounded-xl border border-stone-200 text-stone-400 hover:text-stone-600 hover:bg-stone-50 transition-all"
                            >
                              <Link2 size={18} />
                            </button>
                          )}
                        </div>
                      ) : (
                        profile?.role === 'mentor' && (
                          <button
                            onClick={() => {
                              setSelectedBooking(booking);
                              setShowLinkModal(true);
                            }}
                            className="w-full py-3 px-4 rounded-xl border-2 border-dashed border-stone-200 text-stone-500 text-sm font-bold flex items-center justify-center gap-2 hover:border-green-300 hover:text-green-600 transition-all"
                          >
                            <Plus size={16} />
                            Add Meeting Link
                          </button>
                        )
                      )}

                      {profile?.role === 'mentee' && !booking.meeting_link && booking.status !== 'completed' && (
                        <div className="flex items-center justify-center gap-2 py-3 px-4 bg-stone-50 rounded-xl text-stone-400 text-xs font-medium italic">
                          <Clock size={12} />
                          Mentor will provide the meeting link soon
                        </div>
                      )}

                      {profile?.role === 'mentee' && booking.status === 'accepted' && (
                        <button
                          onClick={() => {
                            setSelectedBooking(booking);
                            setShowPaymentModal(true);
                          }}
                          className="w-full py-3 px-4 rounded-xl bg-orange-500 text-white text-sm font-bold flex items-center justify-center gap-2 hover:bg-orange-600 active:scale-[0.98] transition-all"
                        >
                          <CreditCard size={16} />
                          Pay & Confirm
                        </button>
                      )}

                      {booking.status === 'confirmed' && new Date(booking.scheduled_at) < new Date() && (
                        <button
                          onClick={() => handleStatusUpdate(booking, 'completed')}
                          disabled={isUpdating}
                          className="w-full py-3 px-4 rounded-xl bg-green-50 text-green-600 border border-green-100 text-sm font-bold flex items-center justify-center gap-2 hover:bg-green-100 transition-all shadow-sm"
                        >
                          <CheckCircle2 size={16} />
                          Mark as Completed
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showLinkModal && selectedBooking && (
        <MeetingLinkModal
          onClose={() => {
            setShowLinkModal(false);
            setSelectedBooking(null);
          }}
          initialLink={selectedBooking.meeting_link || ''}
          onConfirm={(link) => handleStatusUpdate(selectedBooking, 'accepted', link)}
        />
      )}

      {showPaymentModal && selectedBooking && profile?.role === 'mentee' && (
        <PostAcceptancePaymentModal
          booking={selectedBooking}
          onClose={() => {
            setShowPaymentModal(false);
            setSelectedBooking(null);
          }}
          onSuccess={() => {
            setShowPaymentModal(false);
            setSelectedBooking(null);
            fetchBookings('upcoming');
          }}
        />
      )}

      {showReviewModal && selectedBooking && (
        <ReviewModal
          isOpen={showReviewModal}
          booking={selectedBooking}
          onClose={() => {
            setShowReviewModal(false);
            setSelectedBooking(null);
          }}
          onSuccess={() => {
            setShowReviewModal(false);
            fetchBookings('past');
          }}
        />
      )}
    </div>
  );
}

function MeetingLinkModal({ onClose, onConfirm, initialLink = '' }: { onClose: () => void, onConfirm: (link: string) => void, initialLink?: string }) {
  const [link, setLink] = useState(initialLink);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);

  const handleSubmit = () => {
    if (link && !link.startsWith('http')) {
      setError('Please enter a valid URL (starting with http:// or https://)');
      return;
    }
    setProcessing(true);
    onConfirm(link);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white w-full max-w-sm rounded-t-[32px] sm:rounded-[32px] p-6 shadow-2xl animate-in slide-in-from-bottom duration-300">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-green-50 text-green-500 flex items-center justify-center">
              <Video size={20} />
            </div>
            <h3 className="text-lg font-bold text-stone-800">Meeting Link</h3>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 transition-colors">
            <X size={20} />
          </button>
        </div>
        <p className="text-sm text-stone-500 mb-4 leading-relaxed">
          Add or update the meeting link for this session.
        </p>
        <label className="block text-xs font-semibold text-stone-600 mb-1.5">
          Meeting Link <span className="font-normal text-stone-400">(optional)</span>
        </label>
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">
            <Link2 size={15} />
          </div>
          <input
            type="url"
            value={link}
            onChange={(e) => { setLink(e.target.value); setError(''); }}
            placeholder="e.g. https://meet.google.com/abc-def-ghi"
            className="w-full pl-9 pr-4 py-3 border border-stone-200 rounded-xl text-sm text-stone-800 placeholder-stone-300 focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent transition-all"
          />
        </div>
        {error && <p className="text-xs text-red-500 mt-1.5">{error}</p>}
        <div className="flex gap-2 mt-5">
          <button
            onClick={onClose}
            className="flex-1 py-3 border border-stone-200 text-stone-600 text-sm font-semibold rounded-xl hover:bg-stone-50 active:scale-95 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={processing}
            className="flex-1 py-3 bg-green-500 text-white text-sm font-bold rounded-xl hover:bg-green-600 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {processing ? '...' : 'Accept & Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
