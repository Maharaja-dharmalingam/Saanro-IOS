import { useState, useEffect } from 'react';
import { ChevronLeft, Bell, Calendar, MessageSquare, Star, Megaphone } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface NotificationsScreenProps {
  onBack: () => void;
}

type PrefKey =
  | 'session_reminders'
  | 'booking_updates'
  | 'new_messages'
  | 'reviews_ratings'
  | 'announcements';

interface Prefs {
  session_reminders: boolean;
  booking_updates: boolean;
  new_messages: boolean;
  reviews_ratings: boolean;
  announcements: boolean;
}

const DEFAULT_PREFS: Prefs = {
  session_reminders: true,
  booking_updates: true,
  new_messages: true,
  reviews_ratings: true,
  announcements: true,
};

interface ToggleRowProps {
  label: string;
  desc: string;
  value: boolean;
  onChange: (v: boolean) => void;
  icon: React.ReactNode;
}

function ToggleRow({ label, desc, value, onChange, icon }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3.5 border-b border-stone-50 last:border-0">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-stone-50 flex items-center justify-center flex-shrink-0">
          {icon}
        </div>
        <div>
          <p className="text-sm font-medium text-stone-700">{label}</p>
          <p className="text-xs text-stone-400 mt-0.5">{desc}</p>
        </div>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0 ${value ? 'bg-blue-500' : 'bg-stone-200'}`}
      >
        <span
          className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${value ? 'translate-x-5' : 'translate-x-0.5'}`}
        />
      </button>
    </div>
  );
}

export default function NotificationsScreen({ onBack }: NotificationsScreenProps) {
  const { profile } = useAuth();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [savingKey, setSavingKey] = useState<PrefKey | null>(null);

  useEffect(() => {
    if (!profile) return;
    const p = profile.notification_preferences;
    if (p) {
      setPrefs({ ...DEFAULT_PREFS, ...p });
    }
  }, [profile]);

  async function updatePref(key: PrefKey, value: boolean) {
    if (!profile) return;
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    setSavingKey(key);
    try {
      await supabase
        .from('profiles')
        .update({ notification_preferences: next })
        .eq('id', profile.id);
    } catch (e) {
      // Revert on failure so the UI reflects reality.
      console.error('Failed to save notification preference', e);
      setPrefs(prefs);
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <div className="min-h-screen bg-stone-50 animate-fade-in">
      <div className="bg-white px-4 pt-12 pb-4 border-b border-stone-100">
        <div className="max-w-md mx-auto flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-9 h-9 flex items-center justify-center rounded-xl border border-stone-200 bg-white hover:bg-stone-50 active:scale-95 transition-all flex-shrink-0"
          >
            <ChevronLeft size={18} className="text-stone-600" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-stone-800">Notifications</h1>
            <p className="text-xs text-stone-400">Manage your alert preferences</p>
          </div>
        </div>
      </div>

      <div className="px-4 pt-6 max-w-md mx-auto space-y-4">
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-stone-50">
            <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Session Alerts</p>
          </div>
          <ToggleRow
            label="Session Reminders"
            desc="Get notified before upcoming sessions"
            value={prefs.session_reminders}
            onChange={(v) => updatePref('session_reminders', v)}
            icon={<Calendar size={15} className="text-blue-500" />}
          />
          <ToggleRow
            label="Booking Updates"
            desc="Confirmations, cancellations and changes"
            value={prefs.booking_updates}
            onChange={(v) => updatePref('booking_updates', v)}
            icon={<Bell size={15} className="text-saffron-500" />}
          />
        </div>

        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-stone-50">
            <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Community</p>
          </div>
          <ToggleRow
            label="New Messages"
            desc="When mentors or mentees send you a message"
            value={prefs.new_messages}
            onChange={(v) => updatePref('new_messages', v)}
            icon={<MessageSquare size={15} className="text-green-500" />}
          />
          <ToggleRow
            label="Reviews & Ratings"
            desc="When someone leaves you a review"
            value={prefs.reviews_ratings}
            onChange={(v) => updatePref('reviews_ratings', v)}
            icon={<Star size={15} className="text-yellow-500" />}
          />
          <ToggleRow
            label="Announcements"
            desc="Platform updates and new features"
            value={prefs.announcements}
            onChange={(v) => updatePref('announcements', v)}
            icon={<Megaphone size={15} className="text-stone-400" />}
          />
        </div>

        <p className="text-xs text-stone-400 text-center px-4 pb-6">
          {savingKey ? 'Saving…' : 'Your preferences are saved automatically.'}
        </p>
      </div>
    </div>
  );
}
