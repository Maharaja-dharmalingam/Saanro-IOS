import { useState, useEffect, useRef, useCallback } from 'react';
import { MapPin, Loader2, X } from 'lucide-react';

interface Suggestion {
  id: string;
  city: string;
  region: string;
  country: string;
  display: string;
}

interface LocationAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export default function LocationAutocomplete({
  value,
  onChange,
  placeholder = 'e.g., Toronto, Canada',
  className = '',
}: LocationAutocompleteProps) {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep local query in sync if parent resets value externally
  useEffect(() => {
    if (!open) setQuery(value);
  }, [value, open]);

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    setLoading(true);
    try {
      const url = `https://wft-geo-db.p.rapidapi.com/v1/geo/cities?namePrefix=${encodeURIComponent(q)}&limit=8&sort=-population&types=CITY`;
      const res = await fetch(url, {
        headers: {
          'X-RapidAPI-Key': 'SIGN-UP-FOR-KEY', // fallback to open API below
          'X-RapidAPI-Host': 'wft-geo-db.p.rapidapi.com',
        },
      });

      if (!res.ok) throw new Error('geo-db failed');

      const json = await res.json();
      const items: Suggestion[] = (json.data ?? []).map((c: {
        id: number; city: string; regionCode: string; countryCode: string; country: string;
      }) => ({
        id: String(c.id),
        city: c.city,
        region: c.regionCode ?? '',
        country: c.country ?? c.countryCode,
        display: `${c.city}, ${c.country}`,
      }));
      setSuggestions(items);
      setOpen(items.length > 0);
    } catch {
      // Fallback: Nominatim (OpenStreetMap) — no API key required
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&limit=8&featuretype=city&q=${encodeURIComponent(q)}`,
          { headers: { 'Accept-Language': 'en' } }
        );
        const json: Array<{ place_id: number; display_name: string; address?: { city?: string; town?: string; village?: string; state?: string; country?: string } }> = await res.json();

        const seen = new Set<string>();
        const items: Suggestion[] = [];

        for (const place of json) {
          // Strict filter: only accept results with a recognized city/town/village
          const city =
            place.address?.city ||
            place.address?.town ||
            place.address?.village;

          if (!city) continue; // skip countries, regions, landmarks, etc.

          const region = place.address?.state ?? '';
          const country = place.address?.country ?? '';
          const display = country ? `${city}, ${country}` : city;

          if (!seen.has(display)) {
            seen.add(display);
            items.push({ id: String(place.place_id), city, region, country, display });
          }
        }

        setSuggestions(items);
        setOpen(items.length > 0);
      } catch {
        setSuggestions([]);
        setOpen(false);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setQuery(v);
    onChange(v);
    setActiveIdx(-1);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(v), 300);
  }

  function handleSelect(s: Suggestion) {
    setQuery(s.display);
    onChange(s.display);
    setSuggestions([]);
    setOpen(false);
    setActiveIdx(-1);
  }

  function handleClear() {
    setQuery('');
    onChange('');
    setSuggestions([]);
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIdx >= 0 && suggestions[activeIdx]) handleSelect(suggestions[activeIdx]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  // Close on outside click
  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <MapPin
          size={14}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none"
        />
        <input
          type="text"
          value={query}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (suggestions.length > 0) setOpen(true); }}
          placeholder={placeholder}
          autoComplete="off"
          className="input-field pl-9 pr-9"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
          {loading && <Loader2 size={14} className="text-stone-400 animate-spin" />}
          {!loading && query && (
            <button
              type="button"
              onClick={handleClear}
              className="text-stone-300 hover:text-stone-500 transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 bg-white border border-stone-200 rounded-2xl shadow-lg overflow-hidden">
          {suggestions.map((s, i) => (
            <li key={s.id}>
              <button
                type="button"
                onMouseDown={e => { e.preventDefault(); handleSelect(s); }}
                className={`w-full flex items-center gap-2.5 px-4 py-3 text-left text-sm transition-colors ${
                  i === activeIdx
                    ? 'bg-saffron-50 text-saffron-700'
                    : 'hover:bg-stone-50 text-stone-700'
                } ${i !== suggestions.length - 1 ? 'border-b border-stone-50' : ''}`}
              >
                <MapPin size={12} className={i === activeIdx ? 'text-saffron-400' : 'text-stone-300'} />
                <span className="font-medium">{s.city}</span>
                {s.country && (
                  <span className={`text-xs ${i === activeIdx ? 'text-saffron-400' : 'text-stone-400'}`}>
                    {s.country}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
