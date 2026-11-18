import { X, MapPin, Clock, Star, Briefcase, Globe, Linkedin, CheckCircle } from 'lucide-react';
import { Mentor } from '../../lib/types';
import Avatar from '../common/Avatar';
import { useCurrency } from '../../hooks/useCurrency';
import { useAuth } from '../../contexts/AuthContext';

interface MentorProfileModalProps {
  mentor: Mentor;
  onClose: () => void;
  onBook: (mentorId: string) => void;
}

export default function MentorProfileModal({ mentor, onClose, onBook }: MentorProfileModalProps) {
  const profile = mentor.profiles;
  const { profile: userProfile } = useAuth();
  const { formatPriceFrom } = useCurrency();
  const effectivePrice30 = mentor.session_price_30min || mentor.session_price_60min || 0;
  const effectivePrice60 = mentor.session_price_60min || mentor.session_price_30min || 0;
  if (!profile) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 modal-overlay" />

      <div
        className="relative w-full max-w-md bg-white rounded-t-3xl max-h-[90vh] overflow-y-auto modal-content"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white pt-3 pb-2 px-4 flex items-center justify-between border-b border-stone-100 z-10">
          <div className="w-10 h-1 bg-stone-200 rounded-full mx-auto absolute left-1/2 -translate-x-1/2 top-2" />
          <div />
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-stone-50 active:scale-95 transition-all ml-auto mt-1"
          >
            <X size={20} className="text-stone-500" />
          </button>
        </div>

        <div className="px-4 pt-4 pb-32">
          <div className="flex items-start gap-4">
            <Avatar name={profile.full_name} imageUrl={profile.avatar_url} size="xl" />
            <div className="flex-1 min-w-0 pt-1">
              <h2 className="font-bold text-stone-800 text-xl leading-tight">{profile.full_name}</h2>
              <p className="text-sm text-stone-500 mt-0.5">{mentor.headline}</p>
              <div className="flex items-center gap-2 mt-2">
                <div className="flex items-center gap-1">
                  <Star size={14} className="text-amber-400 fill-amber-400" />
                  <span className="font-bold text-stone-700">{mentor.rating.toFixed(1)}</span>
                </div>
                <span className="text-stone-300">·</span>
                <span className="text-sm text-stone-500">{mentor.total_sessions} sessions</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-6">
            {[
              { label: 'Experience', value: `${mentor.years_experience}y` },
              { label: 'Sessions', value: mentor.total_sessions.toString() },
              { label: 'Rating', value: mentor.rating.toFixed(1) },
            ].map(stat => (
              <div key={stat.label} className="bg-stone-50 rounded-2xl p-3 text-center">
                <p className="font-bold text-stone-800 text-lg">{stat.value}</p>
                <p className="text-xs text-stone-400">{stat.label}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 space-y-2">
            <div className="flex items-center gap-2 text-sm text-stone-600">
              <MapPin size={14} className="text-stone-400 flex-shrink-0" />
              <span>{profile.location || profile.native_region}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-stone-600">
              <Globe size={14} className="text-stone-400 flex-shrink-0" />
              <span>Native Region: {profile.native_region}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-stone-600">
              <Briefcase size={14} className="text-stone-400 flex-shrink-0" />
              <span>{mentor.industry} · {mentor.tamil_proficiency} Tamil</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-stone-600">
              <Clock size={14} className="text-stone-400 flex-shrink-0" />
              <span>{formatPriceFrom(effectivePrice30, mentor.profiles?.preferred_currency || 'USD', userProfile?.preferred_currency || 'USD')} / 30 min · {formatPriceFrom(effectivePrice60, mentor.profiles?.preferred_currency || 'USD', userProfile?.preferred_currency || 'USD')} / 60 min</span>
            </div>
            {profile.linkedin_url && (
              <div className="flex items-center gap-2 text-sm text-blue-600">
                <Linkedin size={14} className="flex-shrink-0" />
                <a href={profile.linkedin_url} target="_blank" rel="noopener noreferrer">LinkedIn Profile</a>
              </div>
            )}
          </div>

          <div className="mt-5">
            <h3 className="font-semibold text-stone-800 text-sm mb-2">About</h3>
            <p className="text-sm text-stone-600 leading-relaxed">{profile.bio}</p>
          </div>

          <div className="mt-5">
            <h3 className="font-semibold text-stone-800 text-sm mb-2">Areas of Expertise</h3>
            <div className="flex flex-wrap gap-2">
              {mentor.expertise.map(skill => (
                <span
                  key={skill}
                  className="flex items-center gap-1 px-3 py-1.5 bg-saffron-50 text-saffron-700 text-xs font-medium rounded-xl"
                >
                  <CheckCircle size={10} />
                  {skill}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-5">
            <h3 className="font-semibold text-stone-800 text-sm mb-2">Languages</h3>
            <div className="flex flex-wrap gap-2">
              {mentor.languages.map(lang => (
                <span key={lang} className="px-3 py-1.5 bg-stone-100 text-stone-600 text-xs font-medium rounded-xl">
                  {lang}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md px-4 pb-6 bg-white border-t border-stone-100 pt-3">
          <button
            onClick={() => { onBook(mentor.id); onClose(); }}
            disabled={!mentor.is_available}
            className="w-full btn-primary text-base py-4"
          >
            {mentor.is_available ? 'Request Appointment' : 'Currently Unavailable'}
          </button>
        </div>
      </div>
    </div>
  );
}
