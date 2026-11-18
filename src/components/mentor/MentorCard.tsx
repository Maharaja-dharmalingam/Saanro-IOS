import { MapPin, Clock, Briefcase, Star, Sparkles } from 'lucide-react';
import { Mentor } from '../../lib/types';
import Avatar from '../common/Avatar';
import { useCurrency } from '../../hooks/useCurrency';
import { useAuth } from '../../contexts/AuthContext';
import { resolveLocaleFromLocation } from '../../lib/localization';

interface MentorCardProps {
  mentor: Mentor;
  onBook: (mentorId: string) => void;
  onView: (mentorId: string) => void;
  isCultureMatch?: boolean;
  compact?: boolean;
}

export default function MentorCard({ mentor, onBook, onView, isCultureMatch, compact }: MentorCardProps) {
  const mentorProfile = mentor.profiles;
  const { profile: userProfile } = useAuth();
  const { formatPriceFrom } = useCurrency();
  const effectivePrice30 = mentor.session_price_30min || mentor.session_price_60min || 0;
  const effectivePrice60 = mentor.session_price_60min || mentor.session_price_30min || 0;
  const displayPrice = effectivePrice30;
  const displayDuration = mentor.session_price_30min > 0 ? '30min' : '60min';
  const mentorCurrency = (mentorProfile?.location
    ? resolveLocaleFromLocation(mentorProfile.location)?.currency
    : mentorProfile?.preferred_currency) || 'USD';
  if (!mentorProfile) return null;

  const industryColors: Record<string, string> = {
    'Technology': 'bg-blue-50 text-blue-700',
    'Business': 'bg-emerald-50 text-emerald-700',
    'Finance': 'bg-purple-50 text-purple-700',
    'Healthcare': 'bg-rose-50 text-rose-700',
    'Arts & Culture': 'bg-blue-50 text-blue-700',
    'Education': 'bg-teal-50 text-teal-700',
    'Law': 'bg-stone-100 text-stone-600',
  };

  const industryColor = industryColors[mentor.industry] || 'bg-stone-100 text-stone-600';

  if (compact) {
    return (
      <div
        className="card p-4 flex items-center gap-3 cursor-pointer active:scale-[0.98] transition-transform"
        onClick={() => onView(mentor.id)}
      >
        <Avatar name={mentorProfile.full_name} imageUrl={mentorProfile.avatar_url} size="md" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="font-semibold text-stone-800 text-sm truncate">{mentorProfile.full_name}</p>
            {isCultureMatch && (
              <Sparkles size={12} className="text-saffron-500 flex-shrink-0" />
            )}
          </div>
          <p className="text-xs text-stone-400 truncate">{mentor.headline}</p>
          <div className="flex items-center gap-1 mt-0.5">
            <Star size={10} className="text-amber-400 fill-amber-400" />
            <span className="text-xs font-medium text-stone-600">{mentor.rating.toFixed(1)}</span>
            <span className="text-xs text-stone-300 mx-0.5">·</span>
            <span className="text-xs text-stone-400">{mentorProfile.native_region}</span>
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onBook(mentor.id); }}
          className="flex-shrink-0 px-3 py-1.5 bg-saffron-500 text-white text-xs font-semibold rounded-xl active:scale-95 transition-all"
        >
          Book
        </button>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden animate-fade-in">
      {isCultureMatch && (
        <div className="bg-saffron-500 px-4 py-1.5 flex items-center gap-1.5">
          <Sparkles size={12} className="text-white" />
          <span className="text-white text-xs font-semibold">Culture Match — Same Region</span>
        </div>
      )}

      <div className="p-4">
        <div className="flex items-start gap-3">
          <Avatar name={mentorProfile.full_name} imageUrl={mentorProfile.avatar_url} size="lg" />

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-bold text-stone-800 text-base leading-tight">{mentorProfile.full_name}</h3>
                <p className="text-xs text-stone-500 mt-0.5 leading-tight">{mentor.headline}</p>
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <div className="flex items-center gap-1">
                  <Star size={12} className="text-amber-400 fill-amber-400" />
                  <span className="text-sm font-bold text-stone-700">{mentor.rating.toFixed(1)}</span>
                </div>
                <span className="text-xs text-stone-400">{mentor.total_sessions} sessions</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 mt-2">
              <span className={`badge ${industryColor}`}>
                <Briefcase size={10} />
                {mentor.industry}
              </span>
              <span className="badge bg-saffron-50 text-saffron-700">
                {mentor.tamil_proficiency} Tamil
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-3 text-xs text-stone-500">
          <span className="flex items-center gap-1">
            <MapPin size={11} className="text-stone-400" />
            {mentorProfile.location || mentorProfile.native_region}
          </span>
          <span className="flex items-center gap-1">
            <Clock size={11} className="text-stone-400" />
            {mentor.years_experience}y exp
          </span>
          <span className="ml-auto font-semibold text-stone-700">
            {effectivePrice30 === 0 ? "Free" : `${formatPriceFrom(effectivePrice30, mentorCurrency, userProfile?.preferred_currency || 'USD')}/${displayDuration}`}
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5 mt-3">
          {mentor.expertise.slice(0, 3).map(skill => (
            <span key={skill} className="px-2 py-0.5 bg-stone-50 text-stone-600 text-xs rounded-lg border border-stone-100">
              {skill}
            </span>
          ))}
          {mentor.expertise.length > 3 && (
            <span className="px-2 py-0.5 bg-stone-50 text-stone-400 text-xs rounded-lg border border-stone-100">
              +{mentor.expertise.length - 3}
            </span>
          )}
        </div>

        <p className="text-xs text-stone-500 mt-3 line-clamp-2 leading-relaxed">
          {mentorProfile.bio}
        </p>

        <div className="flex gap-2 mt-4">
          <button
            onClick={() => onView(mentor.id)}
            className="flex-1 py-2.5 border border-stone-200 text-stone-700 text-sm font-semibold rounded-xl active:scale-95 transition-all hover:bg-stone-50"
          >
            View Profile
          </button>
          <button
            onClick={() => onBook(mentor.id)}
            disabled={!mentor.is_available}
            className="flex-1 py-2.5 bg-saffron-500 text-white text-sm font-semibold rounded-xl active:scale-95 transition-all hover:bg-saffron-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {mentor.is_available ? 'Request Appointment' : 'Unavailable'}
          </button>
        </div>
      </div>
    </div>
  );
}
