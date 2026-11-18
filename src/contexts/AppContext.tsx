import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Page } from '../lib/types';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { initPushNotifications } from '../lib/pushNotifications';

export type BookingsTab = 'upcoming' | 'pending' | 'accepted' | 'past';

interface AppContextType {
  currentPage: Page;
  setCurrentPage: (page: Page) => void;
  selectedMentorId: string | null;
  setSelectedMentorId: (id: string | null) => void;
  selectedBookingId: string | null;
  setSelectedBookingId: (id: string | null) => void;
  bookingMentorId: string | null;
  openBookingModal: (mentorId: string) => void;
  closeBookingModal: () => void;
  unreadCount: number;
  setUnreadCount: (count: number) => void;
  bookingsTab: BookingsTab;
  navigateToBookings: (tab: BookingsTab) => void;
  openMentorDashboard: boolean;
  setOpenMentorDashboard: (open: boolean) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [selectedMentorId, setSelectedMentorId] = useState<string | null>(null);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [bookingMentorId, setBookingMentorId] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [bookingsTab, setBookingsTab] = useState<BookingsTab>('upcoming');
  const [openMentorDashboard, setOpenMentorDashboard] = useState(false);

  function navigateToBookings(tab: BookingsTab) {
    setBookingsTab(tab);
    setCurrentPage('bookings');
  }

  const fetchUnreadCount = useCallback(async () => {
    if (!profile) return;
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', profile.id)
      .eq('is_read', false);
    setUnreadCount(count ?? 0);
  }, [profile?.id]);

  useEffect(() => {
    if (!profile) return;
    fetchUnreadCount();
    initPushNotifications(profile.id);

    const channel = supabase
      .channel('app-notifications-' + profile.id)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` },
        () => fetchUnreadCount()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [profile?.id, fetchUnreadCount]);

  function openBookingModal(mentorId: string) {
    setBookingMentorId(mentorId);
  }

  function closeBookingModal() {
    setBookingMentorId(null);
  }

  return (
    <AppContext.Provider value={{
      currentPage, setCurrentPage,
      selectedMentorId, setSelectedMentorId,
      selectedBookingId, setSelectedBookingId,
      bookingMentorId, openBookingModal, closeBookingModal,
      unreadCount, setUnreadCount,
      bookingsTab, navigateToBookings,
      openMentorDashboard, setOpenMentorDashboard,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
