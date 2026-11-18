import { useState, useEffect } from 'react';
import { LayoutDashboard, CircleUser as UserCircle, Calendar, DollarSign, Users, BookOpen, ChevronRight, Star, Clock, TrendingUp, Bell, ArrowLeft, CalendarDays, CreditCard } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { Mentor } from '../lib/types';
import Avatar from '../components/common/Avatar';
import ProfileEditor from '../components/mentor-dashboard/ProfileEditor';
import AvailabilitySettings from '../components/mentor-dashboard/AvailabilitySettings';
import EarningsDashboard from '../components/mentor-dashboard/EarningsDashboard';
import ActiveRoster from '../components/mentor-dashboard/ActiveRoster';
import ResourceLibrary from '../components/mentor-dashboard/ResourceLibrary';
import WordOfDay from '../components/dashboard/WordOfDay';
import StripeConnectButton from '../components/mentor-dashboard/StripeConnectButton';

type DashTab = 'overview' | 'profile' | 'availability' | 'stripe' | 'earnings' | 'roster' | 'resources';

interface NavItem {
  key: DashTab | 'bookings';
  label: string;
  icon: React.ElementType;
  group: 'main' | 'operations' | 'crm';
}

const NAV_ITEMS: NavItem[] = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard, group: 'main' },
  { key: 'profile', label: 'Profile & Brand', icon: UserCircle, group: 'main' },
  { key: 'availability', label: 'Availability', icon: Calendar, group: 'operations' },
  { key: 'bookings', label: 'Bookings', icon: CalendarDays, group: 'operations' },
  { key: 'stripe', label: 'Connect to Stripe', icon: CreditCard, group: 'operations' },
  { key: 'earnings', label: 'Earnings', icon: DollarSign, group: 'operations' },
  { key: 'roster', label: 'Active Mentees', icon: Users, group: 'crm' },
  { key: 'resources', label: 'Resource Library', icon: BookOpen, group: 'crm' },
];

const GROUP_LABELS: Record<string, string> = {
  main: 'Dashboard',
  operations: 'Operations',
  crm: 'Mentee Management',
};

const TAB_SUBTITLES: Partial<Record<DashTab, string>> = {
  overview: 'Your mentor command center',
  profile: 'Edit your professional presence',
  availability: 'Manage your open time slots',
  stripe: 'Set up payouts to receive payments',
  earnings: 'Track revenue and payouts',
  roster: 'Your active mentee relationships',
  resources: 'Share materials with mentees',
};

interface MentorDashboardPageProps {
  onNotificationsClick?: () => void;
  unreadCount?: number;
  initialTab?: DashTab;
  onClose?: () => void;
}

export default function MentorDashboardPage({ onNotificationsClick, unreadCount = 0, initialTab, onClose }: MentorDashboardPageProps) {
  const { profile } = useAuth();
  const { navigateToBookings } = useApp();

  const [mentor, setMentor] = useState<Mentor | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<DashTab>(initialTab ?? 'overview');
  const [pendingRequests, setPendingRequests] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (profile) loadMentor();
  }, [profile]);

  async function loadMentor() {
    setLoading(true);
    const { data } = await supabase
      .from('mentors')
      .select('*, profiles(*)')
      .eq('profile_id', profile!.id)
      .maybeSingle();
    if (data) {
      setMentor(data as Mentor);
      loadPendingRequests(data.id);
    }
    setLoading(false);
  }

  async function loadPendingRequests(mentorId: string) {
    const { count } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('mentor_id', mentorId)
      .eq('status', 'pending');
    setPendingRequests(count || 0);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!mentor) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-6 text-center">
        <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <UserCircle size={28} className="text-slate-400" />
        </div>
        <h2 className="text-slate-800 font-bold text-xl mb-2">Mentor Profile Not Found</h2>
        <p className="text-slate-500 text-sm max-w-xs">
          Your mentor profile hasn't been set up yet. Please complete onboarding or contact support.
        </p>
      </div>
    );
  }

  const mp = mentor.profiles!;

  function navigate(tab: DashTab | 'bookings' | 'upcoming') {
    if (tab === 'bookings') {
      navigateToBookings('pending');
      return;
    }
    if (tab === 'upcoming') {
      navigateToBookings('upcoming');
      return;
    }
    setActiveTab(tab);
    setSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const activeNav = activeTab === 'stripe'
    ? { key: 'stripe', label: 'Connect to Stripe' }
    : NAV_ITEMS.find(n => n.key === activeTab) || NAV_ITEMS[0];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex h-screen overflow-hidden">
        <aside className={`
          fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 flex flex-col
          transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:relative lg:translate-x-0 lg:flex
        `}>
          <div className="p-5 border-b border-slate-800">
            <div className="flex items-center gap-3 mb-1">
              <Avatar name={mp.full_name} imageUrl={mp.avatar_url} size="md" />
              <div className="min-w-0">
                <p className="text-white font-semibold text-sm truncate">{mp.full_name}</p>
                <p className="text-slate-400 text-xs truncate">{mentor.industry}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <span className="flex items-center gap-1 text-xs text-yellow-400 font-semibold">
                <Star size={11} fill="currentColor" /> {mentor.rating.toFixed(1)}
              </span>
              <span className="text-slate-600 text-xs">·</span>
              <span className="text-slate-400 text-xs">{mentor.total_sessions} sessions</span>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
            {(['main', 'operations', 'crm'] as const).map(group => (
              <div key={group}>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-2 mb-2">
                  {GROUP_LABELS[group]}
                </p>
                <div className="space-y-0.5">
                  {NAV_ITEMS.filter(n => n.group === group).map(item => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.key;
                    return (
                      <button
                        key={item.key}
                        onClick={() => navigate(item.key)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                          isActive
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                        }`}
                      >
                        <Icon size={16} />
                        <span className="flex-1 text-left">{item.label}</span>
                        {item.key === 'bookings' && pendingRequests > 0 && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                            isActive ? 'bg-white text-blue-600' : 'bg-red-500 text-white'
                          }`}>
                            {pendingRequests}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div className="p-3 border-t border-slate-800">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-slate-500 text-xs">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              Mentor Dashboard · v1.0
            </div>
          </div>
        </aside>

        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <div className="flex-1 flex flex-col overflow-hidden">
          <header className="bg-white border-b border-slate-100 px-5 py-4 flex items-center gap-4 flex-shrink-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              <LayoutDashboard size={16} className="text-slate-600" />
            </button>
            {activeTab !== 'overview' && (
              <button
                onClick={() => (onClose && activeTab === (initialTab ?? 'profile') ? onClose() : navigate('overview'))}
                className="flex items-center justify-center w-9 h-9 rounded-xl border border-stone-200 hover:bg-stone-50 active:scale-95 transition-all"
                title={onClose && activeTab === (initialTab ?? 'profile') ? 'Back to Profile' : 'Back to Overview'}
              >
                <ArrowLeft size={16} className="text-stone-600" />
              </button>
            )}
            <div className="flex-1">
              <h1 className="text-lg font-bold text-slate-800">{activeNav.label}</h1>
              <p className="text-xs text-slate-400 hidden sm:block">
                {TAB_SUBTITLES[activeTab as DashTab]}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onNotificationsClick}
                className="relative flex items-center justify-center w-9 h-9 rounded-xl border border-slate-200 hover:bg-slate-50 active:scale-95 transition-all"
                title="Notifications"
              >
                <Bell size={16} className="text-slate-600" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
              <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl">
                <div className="w-2 h-2 rounded-full bg-green-400" />
                <span className="text-xs font-semibold text-slate-600">Active</span>
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto">
            <div className="p-5 max-w-3xl mx-auto">
              {activeTab === 'overview' && (
                <OverviewTab mentor={mentor} pendingRequests={pendingRequests} onNavigate={navigate} />
              )}
              {activeTab === 'profile' && (
                <ProfileEditor mentor={mentor} onUpdated={loadMentor} />
              )}
              {activeTab === 'availability' && (
                <AvailabilitySettings mentorId={mentor.id} />
              )}
              {activeTab === 'stripe' && (
                <div className="space-y-5 pb-8 animate-fade-in">
                  <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5">
                    <p className="font-bold text-indigo-900 text-sm mb-2">Connect Stripe to receive payments</p>
                    <p className="text-indigo-700 text-xs mb-3">
                      You’ll be redirected to Stripe to complete setup. Payments will be sent to this account.
                    </p>
                    <StripeConnectButton
                      mentorId={mentor.id}
                      stripeAccountId={mentor.stripe_account_id ?? null}
                      stripeOnboardingComplete={!!mentor.stripe_onboarding_complete}
                      onComplete={() => {
                        setMentor((prev) =>
                          prev
                            ? {
                                ...prev,
                                stripe_account_id: null,
                                stripe_onboarding_complete: false,
                              }
                            : prev
                        );
                      }}
                    />
                  </div>
                </div>
              )}
              {activeTab === 'earnings' && (
                <EarningsDashboard mentorId={mentor.id} totalSessions={mentor.total_sessions} />
              )}
              {activeTab === 'roster' && (
                <ActiveRoster mentorId={mentor.id} />
              )}
              {activeTab === 'resources' && (
                <ResourceLibrary mentorId={mentor.id} />
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

function OverviewTab({
  mentor,
  pendingRequests,
  onNavigate,
}: {
  mentor: Mentor;
  pendingRequests: number;
  onNavigate: (tab: DashTab | 'bookings' | 'upcoming') => void;
}) {
  const mp = mentor.profiles!;

  return (
    <div className="space-y-5 pb-8 animate-fade-in">
      <div className="bg-gradient-to-br from-slate-800 to-slate-700 rounded-2xl p-5 text-white">
        <p className="text-slate-400 text-sm">Vanakkam,</p>
        <h2 className="text-2xl font-bold mt-0.5">{mp.full_name.split(' ')[0]}</h2>
        <p className="text-slate-400 text-xs mt-1">{mentor.headline || mentor.industry}</p>
        <div className="grid grid-cols-3 gap-3 mt-5">
          {[
            { label: 'Rating', value: mentor.rating.toFixed(1), icon: Star, color: 'text-yellow-400' },
            { label: 'Sessions', value: mentor.total_sessions, icon: Clock, color: 'text-blue-400', onClick: () => onNavigate('upcoming') },
            { label: 'Pending', value: pendingRequests, icon: CalendarDays, color: pendingRequests > 0 ? 'text-red-400' : 'text-slate-400', onClick: () => onNavigate('bookings') },
          ].map(({ label, value, icon: Icon, color, onClick }) => (
            <div
              key={label}
              className={`bg-white/10 rounded-xl p-3 text-center ${onClick ? 'cursor-pointer hover:bg-white/20 active:scale-95 transition-all' : ''}`}
              onClick={onClick}
            >
              <Icon size={16} className={`${color} mx-auto mb-1`} />
              <p className="text-white font-bold text-lg leading-none">{value}</p>
              <p className="text-slate-400 text-[10px] mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      <WordOfDay />

      {pendingRequests > 0 && (
        <button
          onClick={() => onNavigate('bookings')}
          className="w-full bg-red-50 border border-red-100 rounded-2xl p-4 flex items-center justify-between hover:bg-red-100 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-red-100 rounded-xl flex items-center justify-center">
              <CalendarDays size={17} className="text-red-500" />
            </div>
            <div className="text-left">
              <p className="font-bold text-red-700 text-sm">
                {pendingRequests} Pending Request{pendingRequests > 1 ? 's' : ''}
              </p>
              <p className="text-xs text-red-400">Review and respond to mentee requests</p>
            </div>
          </div>
          <ChevronRight size={16} className="text-red-400" />
        </button>
      )}

      <div className="grid grid-cols-2 gap-3">
        {[
          { key: 'profile' as DashTab, label: 'Profile & Brand', desc: 'Edit info & packages', icon: UserCircle, color: 'bg-blue-50 text-blue-600' },
          { key: 'availability' as DashTab, label: 'Availability', desc: 'Manage time slots', icon: Calendar, color: 'bg-green-50 text-green-600' },
          { key: 'earnings' as DashTab, label: 'Earnings', desc: 'Revenue & payouts', icon: TrendingUp, color: 'bg-amber-50 text-amber-600' },
          { key: 'roster' as DashTab, label: 'Mentees', desc: 'CRM & notes', icon: Users, color: 'bg-slate-100 text-slate-600' },
          { key: 'resources' as DashTab, label: 'Resources', desc: 'Share materials', icon: BookOpen, color: 'bg-rose-50 text-rose-500' },
          { key: 'bookings' as DashTab | 'bookings', label: 'Bookings', desc: 'Requests & sessions', icon: CalendarDays, color: 'bg-slate-100 text-slate-600' },
        ].map(({ key, label, desc, icon: Icon, color }) => (
          <button
            key={key}
            onClick={() => onNavigate(key)}
            className="bg-white rounded-2xl border border-slate-100 p-4 flex flex-col gap-2 hover:border-slate-300 hover:shadow-sm transition-all text-left active:scale-[0.98]"
          >
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
              <Icon size={17} />
            </div>
            <div>
              <p className="font-bold text-slate-800 text-sm">{label}</p>
              <p className="text-xs text-slate-400">{desc}</p>
            </div>
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 p-5">
        <h3 className="font-bold text-slate-800 mb-3">Profile Completeness</h3>
        <div className="space-y-2.5">
          {[
            { label: 'Headline', done: !!mentor.headline },
            { label: 'Bio', done: !!mp.bio },
            { label: 'Expertise areas', done: mentor.expertise?.length > 0 },
            { label: 'Session pricing', done: mentor.session_price_60min > 0 },
            { label: 'Profile photo', done: !!mp.avatar_url },
          ].map(({ label, done }) => (
            <div key={label} className="flex items-center gap-3">
              <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${
                done ? 'bg-green-500' : 'bg-slate-200'
              }`}>
                {done && <span className="text-white text-[9px] font-bold">✓</span>}
              </div>
              <span className={`text-sm ${done ? 'text-slate-600' : 'text-slate-400'}`}>{label}</span>
            </div>
          ))}
        </div>
        {(() => {
          const score = [
            !!mentor.headline, !!mp.bio,
            mentor.expertise?.length > 0,
            mentor.session_price_60min > 0,
            !!mp.avatar_url,
          ].filter(Boolean).length;
          const pct = Math.round((score / 5) * 100);
          return (
            <div className="mt-4">
              <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span>{pct}% complete</span>
                <span>{score}/5 items</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all duration-700"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
