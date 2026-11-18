import { ReactNode } from 'react';
import { ArrowLeft, Bell } from 'lucide-react';

interface HeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightAction?: ReactNode;
  showNotification?: boolean;
  onNotificationClick?: () => void;
  unreadCount?: number;
  transparent?: boolean;
}

export default function Header({
  title,
  subtitle,
  showBack,
  onBack,
  rightAction,
  showNotification,
  onNotificationClick,
  unreadCount = 0,
  transparent,
}: HeaderProps) {
  return (
    <header className={`sticky top-0 z-30 ${
      transparent ? 'bg-transparent' : 'bg-white border-b border-stone-100'
    }`}>
      <div className="max-w-md mx-auto px-4 py-3 flex items-center gap-3">
        {showBack && (
          <button
            onClick={onBack}
            className="p-2 -ml-2 rounded-xl hover:bg-stone-50 active:scale-95 transition-all"
          >
            <ArrowLeft size={20} className="text-stone-600" />
          </button>
        )}

        <div className="flex-1 min-w-0">
          <h1 className={`font-semibold truncate ${
            transparent ? 'text-white' : 'text-stone-800'
          } ${subtitle ? 'text-base' : 'text-lg'}`}>
            {title}
          </h1>
          {subtitle && (
            <p className={`text-xs truncate ${transparent ? 'text-white/70' : 'text-stone-400'}`}>
              {subtitle}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {showNotification && (
            <button
              onClick={onNotificationClick}
              className="relative p-2 rounded-xl hover:bg-stone-50 active:scale-95 transition-all"
            >
              <Bell size={20} className="text-stone-500" />
              {unreadCount > 0 ? (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              ) : (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-stone-300 rounded-full" />
              )}
            </button>
          )}
          {rightAction}
        </div>
      </div>
    </header>
  );
}
