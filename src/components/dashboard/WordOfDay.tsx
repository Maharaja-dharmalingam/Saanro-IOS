import { useState, useEffect } from 'react';
import { BookOpen, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { Thirukkural } from '../../lib/types';
import { ALL_KURALS } from '../../lib/data/all_kurals';

function pickRandom(list: Thirukkural[], excludeId?: number): Thirukkural {
  if (list.length === 0) return list[0];
  if (list.length === 1) return list[0];
  let candidate = list[Math.floor(Math.random() * list.length)];
  if (excludeId !== undefined && candidate.id === excludeId) {
    const others = list.filter((k) => k.id !== excludeId);
    candidate = others[Math.floor(Math.random() * others.length)];
  }
  return candidate;
}

export default function WordOfDay() {
  const [kural, setKural] = useState<Thirukkural | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);

  // All 1330 kurals are bundled locally so the feature works offline and
  // always has the full set regardless of Supabase state.
  const list = ALL_KURALS;

  function showInitial() {
    setLoading(true);
    // Deterministic "of the Day" pick based on the day of the year.
    const dayIndex = Math.floor((Date.now() / 86400000)) % list.length;
    setKural(list[dayIndex]);
    setLoading(false);
  }

  function refreshKural() {
    if (spinning) return;
    setSpinning(true);
    setKural(pickRandom(list, kural?.id));
    setTimeout(() => setSpinning(false), 350);
  }

  useEffect(() => { showInitial(); }, []);

  if (loading) {
    return (
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 bg-stone-100 rounded-lg animate-pulse" />
          <div className="h-4 w-32 bg-stone-100 rounded animate-pulse" />
        </div>
        <div className="space-y-2">
          <div className="h-5 bg-stone-100 rounded animate-pulse" />
          <div className="h-4 w-3/4 bg-stone-100 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (!kural) return null;

  return (
    <div className="card overflow-hidden animate-fade-in">
      <div className="gradient-hero px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-saffron-500/20 rounded-xl flex items-center justify-center">
              <BookOpen size={14} className="text-saffron-300" />
            </div>
            <div>
              <p className="text-white/60 text-xs font-medium">Thirukkural of the Day</p>
              <p className="text-white/40 text-[10px]">Kural #{kural.kural_number} · {kural.chapter}</p>
            </div>
          </div>
          <button
            onClick={refreshKural}
            aria-label="Show a new Thirukkural"
            className={`p-1.5 rounded-xl hover:bg-white/10 active:scale-95 transition-all ${spinning ? 'animate-spin' : ''}`}
          >
            <RefreshCw size={14} className="text-white/50" />
          </button>
        </div>

        <p className="text-tamil text-white text-base leading-relaxed mt-3 font-medium">
          {kural.tamil_text}
        </p>
        <p className="text-white/60 text-xs mt-1 italic leading-relaxed">
          {kural.transliteration}
        </p>
      </div>

      <div className="px-4 py-3">
        <p className="text-stone-700 text-sm leading-relaxed">{kural.english_meaning}</p>

        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-saffron-500 text-xs font-medium mt-2 active:scale-95 transition-all"
        >
          Career Application
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>

        {expanded && (
          <div className="mt-2 p-3 bg-saffron-50 rounded-xl animate-fade-in">
            <p className="text-saffron-800 text-xs leading-relaxed">{kural.career_application}</p>
          </div>
        )}
      </div>
    </div>
  );
}
