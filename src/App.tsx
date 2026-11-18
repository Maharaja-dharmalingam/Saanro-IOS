import { useEffect, useRef, useState, useMemo } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AppProvider, useApp } from './contexts/AppContext';
import BottomNav from './components/layout/BottomNav';
import Header from './components/layout/Header';
import LoadingSpinner from './components/common/LoadingSpinner';
import AuthPage from './pages/AuthPage';
import OnboardingPage from './pages/OnboardingPage';
import HomePage from './pages/HomePage';
import DiscoverPage from './pages/DiscoverPage';
import BookingsPage from './pages/BookingsPage';
import ProfilePage from './pages/ProfilePage';
import MentorDashboardPage from './pages/MentorDashboardPage';
import NotificationsPage from './pages/NotificationsPage';
//import BookingModal from './components/booking/BookingModal';
import AppointmentRequestModal from './components/booking/AppointmentRequestModal';
import MentorProfileModal from './components/mentor/MentorProfileModal';
import { supabase } from './lib/supabase';
import { Mentor } from './lib/types';
import { AlertCircle, RefreshCw } from 'lucide-react';

const PAGE_HEADERS: Record<string, { title: string; subtitle?: string }> = {
  discover: { title: 'Find a Mentor', subtitle: 'Explore Tamil professionals worldwide' },
  bookings: { title: 'My Sessions', subtitle: 'Your Saanro journey' },
  profile: { title: 'Profile', subtitle: 'Your cultural identity' },
};

function AppShell() {
  const { user, profile, loading, isRegistering, signOut, refreshProfile } = useAuth();
  const {
    currentPage, setCurrentPage,
    bookingMentorId, closeBookingModal, openBookingModal,
    selectedMentorId, setSelectedMentorId,
    unreadCount, setUnreadCount,
    openMentorDashboard, setOpenMentorDashboard,
  } = useApp();

  const [bookingMentor, setBookingMentor] = useState<Mentor | null>(null);
  const [viewMentor, setViewMentor] = useState<Mentor | null>(null);

  // States to track session lifecycle
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const lastUserIdRef = useRef<string | null>(null);

  // CRITICAL FIX: Standardize the ID check to avoid the infinite loop.
  // We use null consistently to avoid undefined !== null mismatches.
  const currentUserId = user?.id || null;
  if (currentUserId !== lastUserIdRef.current) {
    lastUserIdRef.current = currentUserId;
    // Reset session states synchronously during the render phase
    setOnboardingDismissed(false);
    setRetryCount(0);
  }

  const MAX_RETRIES = 3;

  useEffect(() => {
    if (!bookingMentorId) { setBookingMentor(null); return; }
    supabase
      .from('mentors_public')
      .select('*, profiles(*)')
      .eq('id', bookingMentorId)
      .maybeSingle()
      .then(({ data }) => { if (data) setBookingMentor(data as Mentor); });
  }, [bookingMentorId]);

  useEffect(() => {
    if (!selectedMentorId) { setViewMentor(null); return; }
    supabase
      .from('mentors_public')
      .select('*, profiles(*)')
      .eq('id', selectedMentorId)
      .maybeSingle()
      .then(({ data }) => { if (data) setViewMentor(data as Mentor); else setViewMentor(null); });
  }, [selectedMentorId]);

  // Derive onboarding status:
  // We force onboarding if:
  // 1. Profile is null (new user)
  // 2. Role is missing
  // 3. Bio or Native Region is missing
  // 4. The name is still the placeholder "there"
  const isProfileIncomplete = useMemo(() => {
    if (!profile) return true;
    const hasRole = !!profile.role;
    const hasRegion = !!profile.native_region?.trim();
    const hasBio = !!profile.bio?.trim();
    // Catch users with the placeholder name
    const rawName = (profile.full_name || '').trim().toLowerCase();
    const hasValidName = rawName !== '' && rawName !== 'there';

    return !hasRole || !hasRegion || !hasBio || !hasValidName;
  }, [profile]);

  const showOnboarding = isProfileIncomplete && !onboardingDismissed;

  // Handle automatic retries for profile fetching if user exists but profile is null
  useEffect(() => {
    // Only retry if we AREN'T in the middle of an explicit registration flow and NOT showing onboarding
    if (user && !profile && !loading && !isRegistering && !showOnboarding && retryCount < MAX_RETRIES) {
      const timer = setTimeout(() => {
        setRetryCount(prev => prev + 1);
        refreshProfile();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [user, profile, loading, isRegistering, showOnboarding, retryCount, refreshProfile]);

  // Main loading check: stay on spinner while checking auth OR while a registration is in progress
  if (loading || isRegistering) return <LoadingSpinner fullScreen />;

  // If not logged in, show Auth Page
  if (!user) return <AuthPage onAuthSuccess={() => {}} />;

  // 1. PRIORITY: Check for Onboarding status
  // We prioritize this over the error screen so users with "there" names can set up their account properly.
  if (showOnboarding) {
    return (
      <OnboardingPage
        onComplete={() => {
          setRetryCount(0);
          setOnboardingDismissed(true);
        }}
      />
    );
  }

  // 2. FALLBACK: Error Screen
  // Only show this if onboarding was bypassed/completed but profile is STILL missing after retries.
  if (!profile) {
    if (retryCount < MAX_RETRIES) return <LoadingSpinner fullScreen />;

    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mb-4">
          <AlertCircle size={30} className="text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-stone-800 mb-2">Connection Issue</h2>
        <p className="text-stone-500 text-sm mb-8 leading-relaxed max-w-xs mx-auto">
          We found your account, but couldn't load your profile details. This might be a temporary sync issue.
        </p>
        <button
          onClick={() => {
            setRetryCount(0);
            refreshProfile();
          }}
          className="w-full btn-primary py-4 text-base max-w-xs mb-4 flex items-center justify-center gap-2"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          Retry Sync
        </button>
        <button
          onClick={() => signOut()}
          className="text-stone-400 text-sm font-medium hover:text-stone-600 transition-colors"
        >
          Sign Out
        </button>
      </div>
    );
  }

  if (profile?.role === 'mentor' && currentPage === 'home') {
    return (
      <div className="min-h-screen bg-gray-50">
        <MentorDashboardPage
          onNotificationsClick={() => setCurrentPage('notifications')}
          unreadCount={unreadCount}
        />
        <BottomNav />
      </div>
    );
  }

  if (openMentorDashboard) {
    return (
      <div className="min-h-screen bg-gray-50">
        <MentorDashboardPage
          onNotificationsClick={() => { setOpenMentorDashboard(false); setCurrentPage('notifications'); }}
          unreadCount={unreadCount}
          initialTab="profile"
          onClose={() => setOpenMentorDashboard(false)}
        />
        <BottomNav />
      </div>
    );
  }

  if (currentPage === 'notifications') {
    return (
      <div className="min-h-screen bg-stone-50">
        <div className="max-w-md mx-auto relative">
          <NotificationsPage
            onBack={() => setCurrentPage('home')}
            onUnreadCountChange={setUnreadCount}
          />
          <BottomNav />
        </div>
      </div>
    );
  }

  const headerConfig = PAGE_HEADERS[currentPage];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto relative">
        {currentPage !== 'home' && headerConfig && (
          <Header
            title={headerConfig.title}
            subtitle={headerConfig.subtitle}
            showNotification
            onNotificationClick={() => setCurrentPage('notifications')}
            unreadCount={unreadCount}
            showBack={currentPage === 'profile'}
            onBack={() => setCurrentPage('home')}
          />
        )}

        <main>
          {currentPage === 'home' && (
            <HomePage
              onNotificationsClick={() => setCurrentPage('notifications')}
              unreadCount={unreadCount}
            />
          )}
          {currentPage === 'discover' && <DiscoverPage />}
          {currentPage === 'bookings' && <BookingsPage />}
          {currentPage === 'profile' && <ProfilePage />}
        </main>

        <BottomNav />
      </div>

      {viewMentor && (
        <MentorProfileModal
          mentor={viewMentor}
          onClose={() => setSelectedMentorId(null)}
          onBook={(id) => {
            setSelectedMentorId(null);
            openBookingModal(id);
          }}
        />
      )}

       {bookingMentor && (
          <AppointmentRequestModal
            mentor={bookingMentor}
            onClose={closeBookingModal}
            onSuccess={closeBookingModal}
          />
       )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <AppShell />
      </AppProvider>
    </AuthProvider>
  );
}
