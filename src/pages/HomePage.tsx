import { useState, useEffect, useMemo } from 'react';
import { TrendingUp, Users, CalendarCheck, ChevronRight, Sparkles, Bell } from 'lucide-react';
import { Mentor, Booking } from '../lib/types';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import WordOfDay from '../components/dashboard/WordOfDay';
import MentorCard from '../components/mentor/MentorCard';
import { formatTime, getGreeting } from '../lib/utils';

interface HomePageProps {
  onNotificationsClick?: () => void;
  unreadCount?: number;
}

export default function HomePage({ onNotificationsClick, unreadCount = 0 }: HomePageProps) {
  const { user, profile } = useAuth();
  const { setCurrentPage, openBookingModal, setSelectedMentorId } = useApp();

  function handleStatClick(target: 'bookings' | 'discover' | 'mentors') {
    if (target === 'mentors') {
      setCurrentPage('home');
      setTimeout(() => {
        document.getElementById('mentors-near-you')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } else {
      setCurrentPage(target);
    }
  }
  const [featuredMentors, setFeaturedMentors] = useState<Mentor[]>([]);
  const [upcomingBookings, setUpcomingBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchFeaturedMentors(), fetchUpcomingBookings()]).finally(() => setLoading(false));
  }, [profile]);

  async function fetchFeaturedMentors() {
    const { data } = await supabase
      .from('mentors_public')
      // Ensure we are selecting the mentor_id if it exists,
      // or select from 'mentors' directly to be safe
      .select('*, profiles(*)')
      .eq('is_available', true)
      .limit(4);

    if (data) {
      // Standardize the data structure before setting state
      const formattedData = data.map(m => ({
        ...m,
        // If the view's 'id' is a profile ID, and there is a 'mentor_id' field,
        // we must ensure the modal gets the mentor_id.
        id: m.mentor_id || m.id
      }));

      const sorted = profile?.native_region
        ? [...formattedData].sort((a, b) => {
            const aMatch = a.profiles?.native_region === profile.native_region ? -1 : 1;
            const bMatch = b.profiles?.native_region === profile.native_region ? -1 : 1;
            return aMatch - bMatch;
          })
        : formattedData;
      setFeaturedMentors(sorted as Mentor[]);
    }
  }

  async function fetchUpcomingBookings() {
    if (!profile) return;
    const now = new Date().toISOString();

    if (profile.role === 'mentor') {
      const { data: mentorRow } = await supabase
        .from('mentors')
        .select('id')
        .eq('profile_id', profile.id)
        .maybeSingle();
      if (!mentorRow) return;
      const { data } = await supabase
        .from('bookings')
        .select('*, mentor:mentors(*, profile:profiles(*))')
        .eq('mentor_id', mentorRow.id)
        .in('status', ['confirmed', 'pending'])
        .gte('scheduled_at', now)
        .order('scheduled_at', { ascending: true })
        .limit(3);
      if (data) setUpcomingBookings(data as Booking[]);
    } else {
      const { data } = await supabase
        .from('bookings')
        .select('*, mentor:mentors(*, profile:profiles(*))')
        .eq('mentee_id', profile.id)
        .in('status', ['confirmed', 'pending'])
        .gte('scheduled_at', now)
        .order('scheduled_at', { ascending: true })
        .limit(3);
      if (data) setUpcomingBookings(data as Booking[]);
    }
  }

  const greeting = getGreeting();

  // DEEP NAME RESOLUTION:
  // 1. Use DB name if valid.
  // 2. Use Auth Metadata if DB name is "there".
  // 3. Use Email prefix as final human-readable fallback (never "there").
  const displayName = useMemo(() => {
    const dbName = profile?.full_name?.trim();
    if (dbName && dbName.toLowerCase() !== 'there') return dbName;

    const metaName = user?.user_metadata?.full_name;
    if (metaName && metaName.toLowerCase() !== 'there') return metaName;

    const emailName = user?.email?.split('@')[0];
    return emailName || 'User';
  }, [profile, user]);

  const firstName = displayName.split(' ')[0];

  const cultureMatchCount = featuredMentors.filter(
    m => m.profiles?.native_region === profile?.native_region
  ).length;

  return (
    <div className="pb-24 animate-fade-in">
      <div className="gradient-hero px-4 pt-6 pb-8">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/60 text-sm font-medium">{greeting}!</p>
              <h2 className="text-white text-2xl font-bold mt-0.5">
                Welcome back, {firstName}
              </h2>
              <p className="text-white/50 text-xs mt-1 text-tamil">வணக்கம்</p>
            </div>
            <button
              onClick={onNotificationsClick}
              className="relative p-2.5 rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 transition-all"
            >
              <Bell size={20} className="text-white" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-50 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
          </div>

          {cultureMatchCount > 0 && (
            <div className="mt-4 flex items-center gap-2 bg-saffron-500/20 rounded-2xl px-3 py-2 w-fit">
              <Sparkles size={14} className="text-saffron-300" />
              <span className="text-white/90 text-xs font-medium">
                {cultureMatchCount} mentor{cultureMatchCount > 1 ? 's' : ''} from {profile?.native_region}
              </span>
            </div>
          )}

          <div className="flex gap-3 mt-5">
            {[
              { label: 'Sessions', value: upcomingBookings.length, icon: CalendarCheck, target: 'bookings' as const },
              { label: 'Mentors', value: featuredMentors.length + '+', icon: Users, target: 'mentors' as const },
              { label: 'Global', value: '50+', icon: TrendingUp, target: 'discover' as const },
            ].map(({ label, value, icon: Icon, target }) => (
              <button
                key={label}
                type="button"
                onClick={() => handleStatClick(target)}
                className="flex-1 bg-white/10 rounded-2xl p-3 text-center active:scale-95 transition-transform cursor-pointer"
              >
                <Icon size={16} className="text-saffron-300 mx-auto mb-1" />
                <p className="text-white font-bold text-lg leading-none">{value}</p>
                <p className="text-white/50 text-[10px] mt-0.5">{label}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 -mt-4 space-y-5 max-w-md mx-auto">
        <WordOfDay />

        {upcomingBookings.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-stone-800">Upcoming Sessions</h3>
              <button
                onClick={() => setCurrentPage('bookings')}
                className="flex items-center gap-1 text-saffron-500 text-xs font-semibold"
              >
                View all <ChevronRight size={14} />
              </button>
            </div>
            <div className="space-y-2">
              {upcomingBookings.map(booking => {
                const mentor = booking.mentor;
                const mp = mentor?.profiles;
                return (
                  <div key={booking.id} className="card p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-saffron-50 flex flex-col items-center justify-center flex-shrink-0">
                      <span className="text-saffron-600 font-bold text-sm leading-none">
                        {new Date(booking.scheduled_at).getDate()}
                      </span>
                      <span className="text-saffron-400 text-[10px]">
                        {new Date(booking.scheduled_at).toLocaleDateString('en-US', { month: 'short' })}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-stone-800 text-sm truncate">
                        Session with {mp?.full_name}
                      </p>
                      <p className="text-xs text-stone-400">
                        {formatTime(booking.scheduled_at)} · {booking.duration_minutes} min
                      </p>
                    </div>
                    <span className={`badge text-[10px] ${
                      booking.status === 'confirmed'
                        ? 'bg-green-50 text-green-600'
                        : 'bg-amber-50 text-amber-600'
                    }`}>
                      {booking.status}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div id="mentors-near-you">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-bold text-stone-800">
                {profile?.native_region ? `Mentors Near You` : 'Featured Mentors'}
              </h3>
              {profile?.native_region && (
                <p className="text-xs text-stone-400">{profile.native_region} & beyond</p>
              )}
            </div>
            <button
              onClick={() => setCurrentPage('discover')}
              className="flex items-center gap-1 text-saffron-500 text-xs font-semibold"
            >
              See all <ChevronRight size={14} />
            </button>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2].map(i => (
                <div key={i} className="card p-4">
                  <div className="flex gap-3">
                    <div className="w-16 h-16 rounded-full bg-stone-100 animate-pulse flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-stone-100 rounded animate-pulse w-3/4" />
                      <div className="h-3 bg-stone-100 rounded animate-pulse w-1/2" />
                      <div className="h-3 bg-stone-100 rounded animate-pulse w-2/3" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {featuredMentors.slice(0, 3).map(mentor => (
                <MentorCard
                  key={mentor.id}
                  mentor={mentor}
                  onBook={(m) => {
                    console.log("Booking Modal Opening for Mentor ID:", m);
                    openBookingModal(m);
                  }}
                  onView={setSelectedMentorId}
                  isCultureMatch={mentor.profiles?.native_region === profile?.native_region}
                />
              ))}
            </div>
          )}
        </div>

        <button
          onClick={() => setCurrentPage('discover')}
          className="w-full py-4 border-2 border-dashed border-saffron-200 rounded-2xl text-saffron-500 text-sm font-semibold hover:bg-saffron-50 active:scale-[0.98] transition-all"
        >
          Explore All Mentors
        </button>
      </div>
    </div>
  );
}
