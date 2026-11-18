import { useState, useEffect, useCallback } from 'react';
import { Search, SlidersHorizontal, X, Sparkles } from 'lucide-react';
import { Mentor, FilterState, INDUSTRIES, DIALECTS, REGIONS } from '../lib/types';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import MentorCard from '../components/mentor/MentorCard';
import MentorProfileModal from '../components/mentor/MentorProfileModal';
import AppointmentRequestModal from '../components/booking/AppointmentRequestModal';

export default function DiscoverPage() {
  const { profile } = useAuth();
  const { openBookingModal } = useApp();
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [filtered, setFiltered] = useState<Mentor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [viewMentor, setViewMentor] = useState<Mentor | null>(null);
  const [bookMentor, setBookMentor] = useState<Mentor | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    industry: 'All',
    tamil_proficiency: '',
    native_region: '',
  });

  useEffect(() => { fetchMentors(); }, []);

  async function fetchMentors() {
    let query = supabase
      .from('mentors_public')
      .select('*, profiles(*)')
      .order('rating', { ascending: false });

    // Exclude the logged-in mentor from their own discover feed
    if (profile?.id) {
      query = query.neq('profile_id', profile.id);
    }

    const { data } = await query;
    if (data) {
      setMentors(data as Mentor[]);
      applyFilters(data as Mentor[], filters);
    }
    setLoading(false);
  }

  const applyFilters = useCallback((list: Mentor[], f: FilterState) => {
    let result = [...list];

    if (f.search.trim()) {
      const q = f.search.toLowerCase();
      result = result.filter(m =>
        m.profiles?.full_name.toLowerCase().includes(q) ||
        m.headline.toLowerCase().includes(q) ||
        m.expertise.some(e => e.toLowerCase().includes(q)) ||
        m.industry.toLowerCase().includes(q) ||
        m.profiles?.native_region.toLowerCase().includes(q)
      );
    }

    if (f.industry && f.industry !== 'All') {
      result = result.filter(m => m.industry === f.industry);
    }

    if (f.tamil_proficiency) {
      result = result.filter(m =>
        m.tamil_proficiency === f.tamil_proficiency || m.tamil_proficiency === 'Both'
      );
    }

    if (f.native_region) {
      result = result.filter(m => m.profiles?.native_region === f.native_region);
    }

    if (profile?.native_region) {
      result = [...result].sort((a, b) => {
        const am = a.profiles?.native_region === profile.native_region ? -1 : 1;
        const bm = b.profiles?.native_region === profile.native_region ? -1 : 1;
        return am - bm;
      });
    }

    setFiltered(result);
  }, [profile]);

  function updateFilter(key: keyof FilterState, value: string) {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    applyFilters(mentors, newFilters);
  }

  function clearFilters() {
    const reset: FilterState = { search: '', industry: 'All', tamil_proficiency: '', native_region: '' };
    setFilters(reset);
    applyFilters(mentors, reset);
    setShowFilters(false);
  }

  const activeFilterCount = [
    filters.industry !== 'All' ? 1 : 0,
    filters.tamil_proficiency ? 1 : 0,
    filters.native_region ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  const cultureMatches = filtered.filter(m => m.profiles?.native_region === profile?.native_region);

  return (
    <div className="pb-24 animate-fade-in">
      <div className="sticky top-0 bg-white z-20 border-b border-stone-100 px-4 pt-4 pb-3">
        <div className="max-w-md mx-auto">
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                value={filters.search}
                onChange={e => updateFilter('search', e.target.value)}
                placeholder="Search mentors, skills, regions..."
                className="w-full pl-9 pr-4 py-2.5 bg-stone-50 border border-stone-100 rounded-xl text-sm text-stone-700 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-saffron-300 focus:border-transparent"
              />
              {filters.search && (
                <button
                  onClick={() => updateFilter('search', '')}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  <X size={14} className="text-stone-400" />
                </button>
              )}
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`relative p-2.5 rounded-xl border transition-all active:scale-95 ${
                activeFilterCount > 0
                  ? 'bg-saffron-500 border-saffron-500 text-white'
                  : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
              }`}
            >
              <SlidersHorizontal size={16} />
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          {showFilters && (
            <div className="mt-3 space-y-3 animate-fade-in pb-1">
              <div>
                <p className="text-xs font-semibold text-stone-500 mb-1.5">Industry</p>
                <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                  {INDUSTRIES.map(ind => (
                    <button
                      key={ind}
                      onClick={() => updateFilter('industry', ind)}
                      className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                        filters.industry === ind
                          ? 'bg-saffron-500 text-white border-saffron-500'
                          : 'bg-white text-stone-600 border-stone-200'
                      }`}
                    >
                      {ind}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-stone-500 mb-1.5">Tamil Proficiency</p>
                <div className="flex gap-1.5">
                  {DIALECTS.map(d => (
                    <button
                      key={d}
                      onClick={() => updateFilter('tamil_proficiency', filters.tamil_proficiency === d ? '' : d)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                        filters.tamil_proficiency === d
                          ? 'bg-saffron-500 text-white border-saffron-500'
                          : 'bg-white text-stone-600 border-stone-200'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-stone-500 mb-1.5">Native Region</p>
                <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                  {REGIONS.slice(0, 8).map(region => (
                    <button
                      key={region}
                      onClick={() => updateFilter('native_region', filters.native_region === region ? '' : region)}
                      className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                        filters.native_region === region
                          ? 'bg-saffron-500 text-white border-saffron-500'
                          : 'bg-white text-stone-600 border-stone-200'
                      }`}
                    >
                      {region}
                    </button>
                  ))}
                </div>
              </div>

              {activeFilterCount > 0 && (
                <button onClick={clearFilters} className="text-xs text-red-500 font-medium flex items-center gap-1">
                  <X size={12} /> Clear all filters
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="px-4 pt-4 max-w-md mx-auto">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-stone-600">
            {filtered.length} mentor{filtered.length !== 1 ? 's' : ''} found
          </p>
          {profile?.native_region && cultureMatches.length > 0 && (
            <div className="flex items-center gap-1 text-saffron-500 text-xs font-medium">
              <Sparkles size={11} />
              {cultureMatches.length} culture match{cultureMatches.length > 1 ? 'es' : ''}
            </div>
          )}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="card p-4">
                <div className="flex gap-3">
                  <div className="w-16 h-16 rounded-full bg-stone-100 animate-pulse flex-shrink-0" />
                  <div className="flex-1 space-y-2 pt-1">
                    <div className="h-4 bg-stone-100 rounded animate-pulse w-3/4" />
                    <div className="h-3 bg-stone-100 rounded animate-pulse w-1/2" />
                    <div className="h-3 bg-stone-100 rounded animate-pulse w-2/3" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Search size={40} className="text-stone-200 mx-auto mb-3" />
            <p className="text-stone-500 font-medium">No mentors found</p>
            <p className="text-stone-400 text-sm mt-1">Try adjusting your search or filters</p>
            <button onClick={clearFilters} className="mt-4 text-saffron-500 text-sm font-medium">
              Clear filters
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(mentor => (
              <MentorCard
                key={mentor.id}
                mentor={mentor}
                onBook={(id) => {
                  const m = mentors.find(m => m.id === id);
                  if (m) setBookMentor(m);
                }}
                onView={(id) => {
                  const m = mentors.find(m => m.id === id);
                  if (m) setViewMentor(m);
                }}
                isCultureMatch={mentor.profiles?.native_region === profile?.native_region}
              />
            ))}
          </div>
        )}
      </div>

      {viewMentor && (
        <MentorProfileModal
          mentor={viewMentor}
          onClose={() => setViewMentor(null)}
          onBook={(id) => {
            const m = mentors.find(m => m.id === id);
            setViewMentor(null);
            if (m) setBookMentor(m);
          }}
        />
      )}

      {bookMentor && (
        <AppointmentRequestModal
          mentor={bookMentor}
          onClose={() => setBookMentor(null)}
          onSuccess={() => setBookMentor(null)}
        />
      )}
    </div>
  );
}
