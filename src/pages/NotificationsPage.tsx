import { useState, useEffect } from 'react';
import { Bell, CalendarCheck, CheckCircle, XCircle, X, ArrowLeft, Check, CreditCard } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useApp, BookingsTab } from '../contexts/AppContext';

interface AppNotification {
  id: string;
  type: 'booking_requested' | 'booking_accepted' | 'booking_confirmed' | 'booking_declined' | 'booking_cancelled';
  title: string;
  body: string;
  booking_id: string | null;
  is_read: boolean;
  created_at: string;
}

type NotifType = AppNotification['type'];

const TYPE_CONFIG: Record<NotifType, {
  icon: typeof CalendarCheck;
  iconBg: string;
  iconColor: string;
  dot: string;
  bookingsTab: BookingsTab;
  hint: string;
}> = {
  booking_requested: {
    icon: CalendarCheck,
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-500',
    dot: 'bg-blue-500',
    bookingsTab: 'pending',
    hint: 'View pending requests',
  },
  booking_accepted: {
    icon: CreditCard,
    iconBg: 'bg-orange-50',
    iconColor: 'text-orange-500',
    dot: 'bg-orange-500',
    bookingsTab: 'pending',
    hint: 'Pay now to confirm',
  },
  booking_confirmed: {
    icon: CheckCircle,
    iconBg: 'bg-green-50',
    iconColor: 'text-green-500',
    dot: 'bg-green-500',
    bookingsTab: 'upcoming',
    hint: 'View upcoming sessions',
  },
  booking_declined: {
    icon: XCircle,
    iconBg: 'bg-red-50',
    iconColor: 'text-red-500',
    dot: 'bg-red-500',
    bookingsTab: 'past',
    hint: 'View session history',
  },
  booking_cancelled: {
    icon: X,
    iconBg: 'bg-stone-100',
    iconColor: 'text-stone-500',
    dot: 'bg-stone-400',
    bookingsTab: 'past',
    hint: 'View session history',
  },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface NotificationsPageProps {
  onBack: () => void;
  onUnreadCountChange: (count: number) => void;
}

export default function NotificationsPage({ onBack, onUnreadCountChange }: NotificationsPageProps) {
  const { profile } = useAuth();
  const { navigateToBookings, setCurrentPage } = useApp();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  useEffect(() => {
    if (profile) fetchNotifications();
  }, [profile]);

  async function fetchNotifications() {
    setLoading(true);
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', profile!.id)
      .order('created_at', { ascending: false })
      .limit(50);

    const items = (data as AppNotification[]) || [];
    setNotifications(items);
    onUnreadCountChange(items.filter(n => !n.is_read).length);
    setLoading(false);
  }

  async function markAsRead(id: string) {
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, is_read: true } : n)
    );
    onUnreadCountChange(notifications.filter(n => !n.is_read && n.id !== id).length);
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
  }

  async function handleNotificationClick(notif: AppNotification) {
    if (!notif.is_read) await markAsRead(notif.id);

    // Mentors receive booking_requested and booking_confirmed (as mentor) notifications.
    // Their inbox is on the home/dashboard page, not the mentee BookingsPage.
    const isMentor = profile?.role === 'mentor';
    const mentorNotifTypes: NotifType[] = ['booking_requested', 'booking_cancelled'];
    if (isMentor && mentorNotifTypes.includes(notif.type)) {
      setCurrentPage('home');
      return;
    }

    navigateToBookings(TYPE_CONFIG[notif.type].bookingsTab);
  }

  async function markAllRead() {
    setMarkingAll(true);
    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
    if (unreadIds.length > 0) {
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      onUnreadCountChange(0);
      await supabase.from('notifications').update({ is_read: true }).eq('user_id', profile!.id).eq('is_read', false);
    }
    setMarkingAll(false);
  }

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="min-h-screen bg-stone-50 animate-fade-in">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white border-b border-stone-100">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 -ml-2 rounded-xl hover:bg-stone-50 active:scale-95 transition-all"
          >
            <ArrowLeft size={20} className="text-stone-600" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-stone-800 text-base">Notifications</h1>
            {unreadCount > 0 && (
              <p className="text-xs text-stone-400">{unreadCount} unread</p>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              disabled={markingAll}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-saffron-600 bg-saffron-50 rounded-xl hover:bg-saffron-100 active:scale-95 transition-all disabled:opacity-50"
            >
              <Check size={12} />
              Mark all read
            </button>
          )}
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 pt-4 pb-28">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-white rounded-2xl border border-stone-100 p-4 flex gap-3 animate-pulse">
                <div className="w-11 h-11 rounded-2xl bg-stone-100 flex-shrink-0" />
                <div className="flex-1 space-y-2 pt-1">
                  <div className="h-4 bg-stone-100 rounded w-3/4" />
                  <div className="h-3 bg-stone-100 rounded w-full" />
                  <div className="h-3 bg-stone-100 rounded w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Bell size={28} className="text-stone-300" />
            </div>
            <p className="font-semibold text-stone-500 text-base">No notifications yet</p>
            <p className="text-sm text-stone-400 mt-1 max-w-xs leading-relaxed">
              You'll be notified here when there are updates to your bookings.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map(notif => {
              const config = TYPE_CONFIG[notif.type];
              const Icon = config.icon;
              return (
                <button
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`w-full text-left rounded-2xl border transition-all active:scale-[0.99] hover:shadow-md ${
                    notif.is_read
                      ? 'bg-white border-stone-100 opacity-70'
                      : 'bg-white border-stone-200 shadow-sm'
                  }`}
                >
                  <div className="p-4 flex items-start gap-3">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 ${config.iconBg}`}>
                      <Icon size={20} className={config.iconColor} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm leading-snug ${notif.is_read ? 'font-medium text-stone-600' : 'font-bold text-stone-800'}`}>
                          {notif.title}
                        </p>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span className="text-[11px] text-stone-400 whitespace-nowrap">
                            {timeAgo(notif.created_at)}
                          </span>
                          {!notif.is_read && (
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${config.dot}`} />
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-stone-500 mt-0.5 leading-relaxed">
                        {notif.body}
                      </p>
                      <p className={`text-[11px] font-semibold mt-1.5 ${config.iconColor}`}>
                        {config.hint} →
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}