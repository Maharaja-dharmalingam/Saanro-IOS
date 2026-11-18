import { Home, Search, CalendarDays, User, Bell } from 'lucide-react';
import { Page } from '../../lib/types';
import { useApp } from '../../contexts/AppContext';

const NAV_ITEMS: Array<{ page: Page; label: string; icon: typeof Home; tamilLabel: string }> = [
  { page: 'home', label: 'Home', tamilLabel: 'இல்லம்', icon: Home },
  { page: 'discover', label: 'Discover', tamilLabel: 'கண்டறி', icon: Search },
  { page: 'bookings', label: 'Bookings', tamilLabel: 'முன்பதிவு', icon: CalendarDays },
  { page: 'notifications', label: 'Alerts', tamilLabel: 'அறிவிப்பு', icon: Bell },
  { page: 'profile', label: 'Profile', tamilLabel: 'சுயவிவரம்', icon: User },
];

export default function BottomNav() {
  const { currentPage, setCurrentPage, openMentorDashboard, setOpenMentorDashboard, unreadCount } = useApp();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-stone-100 safe-bottom">
      <div className="max-w-md mx-auto flex items-stretch">
        {NAV_ITEMS.map(({ page, label, tamilLabel, icon: Icon }) => {
          const active = currentPage === page;
          const showBadge = page === 'notifications' && unreadCount > 0;
          return (
            <button
              key={page}
              onClick={() => {
                if (openMentorDashboard && page !== 'profile') {
                  setOpenMentorDashboard(false);
                }
                setCurrentPage(page);
              }}
              className="bottom-nav-item"
              aria-label={label}
            >
              <div className={`relative p-1.5 rounded-xl transition-all duration-200 ${
                active ? 'bg-saffron-50' : ''
              }`}>
                <Icon
                  size={22}
                  className={active ? 'text-saffron-500' : 'text-stone-400'}
                  strokeWidth={active ? 2.5 : 1.8}
                />
                {showBadge && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </div>
              <span className={`text-[10px] font-medium leading-tight ${
                active ? 'text-saffron-500' : 'text-stone-400'
              }`}>
                {label}
              </span>
              <span className={`text-[8px] text-tamil leading-none ${
                active ? 'text-saffron-400' : 'text-stone-300'
              }`}>
                {tamilLabel}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
