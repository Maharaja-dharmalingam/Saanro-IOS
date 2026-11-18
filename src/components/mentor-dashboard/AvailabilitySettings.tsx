import { useState, useEffect } from 'react';
import { Clock, ChevronLeft, ChevronRight, Check, X, CreditCard as Edit2, RotateCcw, Plus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { MentorAvailability } from '../../lib/types';

interface AvailabilitySettingsProps {
  mentorId: string;
}

interface Override {
  id: string;
  override_date: string;
  is_unavailable: boolean;
  start_hour: number | null;
  start_minute: number | null;
  duration_minutes: number | null;
  note: string;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SHORT_DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// 4 morning slots: 9 AM, 10 AM, 11 AM, 11:30 AM
const MORNING_DEFAULTS = [
  { start_hour: 9, start_minute: 0 },
  { start_hour: 10, start_minute: 0 },
  { start_hour: 11, start_minute: 0 },
  { start_hour: 11, start_minute: 30 },
];
// 4 evening slots: 1 PM, 2 PM, 3 PM, 4 PM
const EVENING_DEFAULTS = [
  { start_hour: 13, start_minute: 0 },
  { start_hour: 14, start_minute: 0 },
  { start_hour: 15, start_minute: 0 },
  { start_hour: 16, start_minute: 0 },
];

const DEFAULT_SLOTS: Omit<MentorAvailability, 'id' | 'mentor_id' | 'created_at'>[] = (
  [1, 2, 3, 4, 5].flatMap(dow => [
    ...MORNING_DEFAULTS.map(s => ({ day_of_week: dow, ...s, duration_minutes: 60, is_active: true })),
    ...EVENING_DEFAULTS.map(s => ({ day_of_week: dow, ...s, duration_minutes: 60, is_active: true })),
  ])
);

function fmt(hour: number, minute: number) {
  const p = hour >= 12 ? 'PM' : 'AM';
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h}:${minute === 0 ? '00' : '30'} ${p}`;
}

function toDateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR + i);

export default function AvailabilitySettings({ mentorId }: AvailabilitySettingsProps) {
  const [slots, setSlots] = useState<MentorAvailability[]>([]);
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingSlot, setEditingSlot] = useState<string | null>(null);
  const [editValues, setEditValues] = useState({ start_hour: 9, start_minute: 0, duration_minutes: 60 });
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  function toggleSection(key: string) {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  }

  function isSectionOpen(key: string, defaultOpen: boolean) {
    return key in openSections ? openSections[key] : defaultOpen;
  }

  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dateModalOpen, setDateModalOpen] = useState(false);
  const [dateEdit, setDateEdit] = useState({ start_hour: 9, start_minute: 0, end_hour: 17, end_minute: 0, note: '' });
  const [dateSlotToggles, setDateSlotToggles] = useState<Record<string, boolean>>({});
  // Extra slots added per-date (not from weekly defaults): key -> duration_minutes
  const [dateExtraSlots, setDateExtraSlots] = useState<Record<string, number>>({});
  const [showAddSlot, setShowAddSlot] = useState(false);
  const [addSlotTime, setAddSlotTime] = useState('9:0');
  const [addSlotDuration, setAddSlotDuration] = useState(60);

  function slotKey(h: number, m: number) { return `${h}:${m}`; }

  function openDateModalWithSlots(dateKey: string) {
    const calDate = new Date(dateKey + 'T12:00:00');
    const dow = calDate.getDay();
    const defaultDaySlots = slots.filter(s => s.day_of_week === dow && s.is_active);
    const existing = overrides.find(o => o.override_date === dateKey);

    let toggles: Record<string, boolean> = {};
    let extras: Record<string, number> = {};

    if (existing && !existing.is_unavailable && existing.note) {
      try {
        const saved: { enabled: string[]; extra: Record<string, number> } = JSON.parse(existing.note);
        const enabled: string[] = Array.isArray(saved) ? saved : (saved.enabled ?? []);
        const defaultKeys = new Set(defaultDaySlots.map(s => slotKey(s.start_hour, s.start_minute)));
        defaultDaySlots.forEach(s => {
          toggles[slotKey(s.start_hour, s.start_minute)] = enabled.includes(slotKey(s.start_hour, s.start_minute));
        });
        // Extra = keys in enabled that are not in the default set
        if (saved.extra) {
          extras = saved.extra;
        } else {
          enabled.forEach(k => { if (!defaultKeys.has(k)) extras[k] = 60; });
        }
      } catch {
        defaultDaySlots.forEach(s => { toggles[slotKey(s.start_hour, s.start_minute)] = true; });
      }
    } else {
      defaultDaySlots.forEach(s => { toggles[slotKey(s.start_hour, s.start_minute)] = true; });
    }
    setDateSlotToggles(toggles);
    setDateExtraSlots(extras);
    setShowAddSlot(false);
    setAddSlotTime('9:0');
    setAddSlotDuration(60);
    openDateModal(dateKey);
  }

  useEffect(() => {
    loadAll();
  }, [mentorId]);

  async function loadAll() {
    setLoading(true);
    const [{ data: slotData }, { data: ovrData }] = await Promise.all([
      supabase.from('mentor_availability').select('*').eq('mentor_id', mentorId).order('day_of_week').order('start_hour'),
      supabase.from('mentor_availability_overrides').select('*').eq('mentor_id', mentorId),
    ]);

    if (slotData && slotData.length === 0) {
      await seedDefaults();
    } else if (slotData) {
      setSlots(slotData as MentorAvailability[]);
    }
    if (ovrData) setOverrides(ovrData as Override[]);
    setLoading(false);
  }

  async function seedDefaults() {
    const rows = DEFAULT_SLOTS.map(s => ({ mentor_id: mentorId, ...s }));
    const { data } = await supabase.from('mentor_availability').insert(rows).select();
    if (data) setSlots(data as MentorAvailability[]);
  }

  async function toggleSlot(slot: MentorAvailability) {
    await supabase.from('mentor_availability').update({ is_active: !slot.is_active }).eq('id', slot.id);
    setSlots(prev => prev.map(s => s.id === slot.id ? { ...s, is_active: !s.is_active } : s));
  }

  async function deleteSlot(id: string) {
    await supabase.from('mentor_availability').delete().eq('id', id);
    setSlots(prev => prev.filter(s => s.id !== id));
  }

  function startEdit(slot: MentorAvailability) {
    setEditingSlot(slot.id);
    setEditValues({ start_hour: slot.start_hour, start_minute: slot.start_minute, duration_minutes: slot.duration_minutes });
  }

  async function saveEdit(slot: MentorAvailability) {
    setSaving(true);
    await supabase.from('mentor_availability').update(editValues).eq('id', slot.id);
    setSlots(prev => prev.map(s => s.id === slot.id ? { ...s, ...editValues } : s));
    setEditingSlot(null);
    setSaving(false);
  }

  async function addSlotForDay(day: number) {
    const existing = slots.filter(s => s.day_of_week === day);
    const usedHours = new Set(existing.map(s => s.start_hour));
    const freeHour = [9, 10, 11, 13, 14, 15, 16].find(h => !usedHours.has(h)) ?? 9;
    const row = { mentor_id: mentorId, day_of_week: day, start_hour: freeHour, start_minute: 0, duration_minutes: 60, is_active: true };
    const { data } = await supabase.from('mentor_availability').insert(row).select().maybeSingle();
    if (data) setSlots(prev => [...prev, data as MentorAvailability]);
  }

  async function resetToDefaults() {
    setSaving(true);
    await supabase.from('mentor_availability').delete().eq('mentor_id', mentorId);
    await seedDefaults();
    setSaving(false);
  }

  // Calendar helpers
  function daysInMonth(year: number, month: number) {
    return new Date(year, month + 1, 0).getDate();
  }

  function firstDayOfMonth(year: number, month: number) {
    return new Date(year, month, 1).getDay();
  }

  function prevMonth() {
    if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); }
    else setCalMonth(m => m - 1);
  }

  function nextMonth() {
    if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); }
    else setCalMonth(m => m + 1);
  }

  function openDateModal(dateKey: string) {
    setSelectedDate(dateKey);
    const existing = overrides.find(o => o.override_date === dateKey);
    if (existing && !existing.is_unavailable) {
      const sh = existing.start_hour ?? 9;
      const sm = existing.start_minute ?? 0;
      const dur = existing.duration_minutes ?? 60;
      const totalEnd = sh * 60 + sm + dur;
      setDateEdit({
        start_hour: sh,
        start_minute: sm,
        end_hour: Math.floor(totalEnd / 60) % 24,
        end_minute: totalEnd % 60,
        note: existing.note ?? '',
      });
    } else {
      setDateEdit({ start_hour: 9, start_minute: 0, end_hour: 17, end_minute: 0, note: '' });
    }
    setDateModalOpen(true);
  }

  async function markUnavailable(dateKey: string) {
    const existing = overrides.find(o => o.override_date === dateKey);
    if (existing) {
      if (existing.is_unavailable) {
        await supabase.from('mentor_availability_overrides').delete().eq('id', existing.id);
        setOverrides(prev => prev.filter(o => o.id !== existing.id));
      } else {
        await supabase.from('mentor_availability_overrides').update({ is_unavailable: true }).eq('id', existing.id);
        setOverrides(prev => prev.map(o => o.id === existing.id ? { ...o, is_unavailable: true } : o));
      }
    } else {
      const { data } = await supabase.from('mentor_availability_overrides')
        .insert({ mentor_id: mentorId, override_date: dateKey, is_unavailable: true })
        .select().maybeSingle();
      if (data) setOverrides(prev => [...prev, data as Override]);
    }
    setDateModalOpen(false);
  }

  async function saveCustomTime(dateKey: string) {
    setSaving(true);
    const existing = overrides.find(o => o.override_date === dateKey);
    const duration_minutes = (dateEdit.end_hour * 60 + dateEdit.end_minute) - (dateEdit.start_hour * 60 + dateEdit.start_minute);
    const payload = { mentor_id: mentorId, override_date: dateKey, is_unavailable: false, start_hour: dateEdit.start_hour, start_minute: dateEdit.start_minute, duration_minutes: Math.max(duration_minutes, 30), note: dateEdit.note };
    if (existing) {
      await supabase.from('mentor_availability_overrides').update(payload).eq('id', existing.id);
      setOverrides(prev => prev.map(o => o.id === existing.id ? { ...o, ...payload } : o));
    } else {
      const { data } = await supabase.from('mentor_availability_overrides').insert(payload).select().maybeSingle();
      if (data) setOverrides(prev => [...prev, data as Override]);
    }
    setSaving(false);
    setDateModalOpen(false);
  }

  async function clearOverride(dateKey: string) {
    const existing = overrides.find(o => o.override_date === dateKey);
    if (!existing) return;
    await supabase.from('mentor_availability_overrides').delete().eq('id', existing.id);
    setOverrides(prev => prev.filter(o => o.id !== existing.id));
    setDateModalOpen(false);
  }

  const grouped = DAYS.reduce<Record<number, MentorAvailability[]>>((acc, _, i) => {
    acc[i] = slots.filter(s => s.day_of_week === i);
    return acc;
  }, {});

  const overrideMap = overrides.reduce<Record<string, Override>>((acc, o) => {
    acc[o.override_date] = o;
    return acc;
  }, {});

  const totalDays = daysInMonth(calYear, calMonth);
  const startDay = firstDayOfMonth(calYear, calMonth);
  const todayKey = toDateKey(today.getFullYear(), today.getMonth(), today.getDate());

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white rounded-2xl border border-stone-100 p-5 animate-pulse">
            <div className="h-4 bg-stone-100 rounded w-1/3 mb-3" />
            <div className="flex gap-2">
              <div className="h-8 bg-stone-100 rounded-xl w-24" />
              <div className="h-8 bg-stone-100 rounded-xl w-24" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-10">
      {/* Calendar section — shown first */}
      <div className="bg-white rounded-2xl border border-stone-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-50">
          <h3 className="font-bold text-stone-800">Date-Specific Overrides</h3>
          <p className="text-xs text-stone-400 mt-0.5">Tap a date to mark it unavailable or set custom hours</p>
        </div>

        {/* Year + Month nav */}
        <div className="px-5 pt-4 pb-2 flex items-center gap-3">
          <select
            value={calYear}
            onChange={e => setCalYear(Number(e.target.value))}
            className="text-sm font-semibold border border-stone-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:border-saffron-400 flex-1"
          >
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={prevMonth} className="p-2 rounded-xl border border-stone-200 hover:bg-stone-50 transition-colors">
            <ChevronLeft size={16} className="text-stone-600" />
          </button>
          <span className="text-sm font-bold text-stone-800 min-w-[80px] text-center">{MONTHS[calMonth]}</span>
          <button onClick={nextMonth} className="p-2 rounded-xl border border-stone-200 hover:bg-stone-50 transition-colors">
            <ChevronRight size={16} className="text-stone-600" />
          </button>
        </div>

        {/* Day headers */}
        <div className="px-4 pb-1">
          <div className="grid grid-cols-7 gap-1 mb-1">
            {SHORT_DAYS.map(d => (
              <div key={d} className="text-center text-[10px] font-bold text-stone-400 uppercase py-1">{d}</div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1 pb-4">
            {Array.from({ length: startDay }).map((_, i) => <div key={`empty-${i}`} />)}
            {Array.from({ length: totalDays }, (_, i) => i + 1).map(day => {
              const dateKey = toDateKey(calYear, calMonth, day);
              const override = overrideMap[dateKey];
              const isPast = dateKey < todayKey;
              const isToday = dateKey === todayKey;
              const isUnavailable = override?.is_unavailable;
              const hasCustom = override && !override.is_unavailable;
              const calDate = new Date(calYear, calMonth, day);
              const dow = calDate.getDay();
              const isWeekend = dow === 0 || dow === 6;
              const hasDefaultSlot = grouped[dow]?.some(s => s.is_active);

              return (
                <button
                  key={day}
                  onClick={() => !isPast && openDateModalWithSlots(dateKey)}
                  disabled={isPast}
                  className={`relative aspect-square flex flex-col items-center justify-center rounded-xl text-xs font-semibold transition-all
                    ${isPast ? 'opacity-30 cursor-default' : 'hover:scale-105 active:scale-95 cursor-pointer'}
                    ${isToday ? 'ring-2 ring-saffron-400 ring-offset-1' : ''}
                    ${isUnavailable ? 'bg-red-100 text-red-500' :
                      hasCustom ? 'bg-blue-100 text-blue-700' :
                      hasDefaultSlot && !isWeekend ? 'bg-emerald-50 text-emerald-700' :
                      isWeekend ? 'bg-stone-50 text-stone-400' :
                      'bg-stone-50 text-stone-500 hover:bg-stone-100'
                    }
                  `}
                >
                  <span>{day}</span>
                  {isUnavailable && <span className="absolute bottom-0.5 text-[8px] font-normal opacity-70">off</span>}
                  {hasCustom && <span className="absolute bottom-0.5 text-[8px] font-normal opacity-70">custom</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="px-5 pb-4 flex flex-wrap gap-3">
          {[
            { color: 'bg-emerald-50 border-emerald-200', label: 'Available (default)' },
            { color: 'bg-red-100 border-red-200', label: 'Unavailable' },
            { color: 'bg-blue-100 border-blue-200', label: 'Custom hours' },
            { color: 'bg-stone-50 border-stone-200', label: 'No schedule' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className={`w-3 h-3 rounded-sm border ${color}`} />
              <span className="text-[10px] text-stone-500">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Weekly schedule removed */}
      {false && <div>

        <div className="divide-y divide-stone-50">
          {DAYS.map((day, i) => {
            const daySlots = grouped[i];
            const isWeekend = i === 0 || i === 6;
            const morningSlots = daySlots.filter(s => s.start_hour < 12);
            const eveningSlots = daySlots.filter(s => s.start_hour >= 12);

            const SlotItem = ({ slot }: { slot: MentorAvailability }) => (
              <div key={slot.id}>
                {editingSlot === slot.id ? (
                  <div className="flex flex-wrap items-center gap-2 p-3 bg-stone-50 rounded-xl border border-stone-200">
                    <select
                      value={editValues.start_hour}
                      onChange={e => setEditValues(v => ({ ...v, start_hour: Number(e.target.value) }))}
                      className="text-xs border border-stone-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-saffron-400"
                    >
                      {HOURS.map(h => <option key={h} value={h}>{fmt(h, 0)}</option>)}
                    </select>
                    <select
                      value={editValues.start_minute}
                      onChange={e => setEditValues(v => ({ ...v, start_minute: Number(e.target.value) }))}
                      className="text-xs border border-stone-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-saffron-400"
                    >
                      <option value={0}>:00</option>
                      <option value={30}>:30</option>
                    </select>
                    <select
                      value={editValues.duration_minutes}
                      onChange={e => setEditValues(v => ({ ...v, duration_minutes: Number(e.target.value) }))}
                      className="text-xs border border-stone-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-saffron-400"
                    >
                      <option value={30}>30 min</option>
                      <option value={45}>45 min</option>
                      <option value={60}>60 min</option>
                      <option value={90}>90 min</option>
                      <option value={120}>2 hr</option>
                    </select>
                    <button
                      onClick={() => saveEdit(slot)}
                      disabled={saving}
                      className="flex items-center gap-1 text-xs font-semibold text-white bg-emerald-500 px-2.5 py-1.5 rounded-lg hover:bg-emerald-600 transition-colors disabled:opacity-50"
                    >
                      <Check size={11} /> Save
                    </button>
                    <button
                      onClick={() => setEditingSlot(null)}
                      className="flex items-center gap-1 text-xs font-semibold text-stone-500 bg-white border border-stone-200 px-2.5 py-1.5 rounded-lg hover:bg-stone-50 transition-colors"
                    >
                      <X size={11} /> Cancel
                    </button>
                  </div>
                ) : (
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all ${
                    slot.is_active
                      ? 'bg-emerald-50 border-emerald-200'
                      : 'bg-stone-50 border-stone-200 opacity-50'
                  }`}>
                    <Clock size={12} className={slot.is_active ? 'text-emerald-500' : 'text-stone-400'} />
                    <span className={`text-xs font-semibold flex-1 ${slot.is_active ? 'text-emerald-800' : 'text-stone-400 line-through'}`}>
                      {fmt(slot.start_hour, slot.start_minute)}
                      <span className="font-normal text-[11px] ml-1 opacity-70">· {slot.duration_minutes}m</span>
                    </span>
                    <button
                      onClick={() => startEdit(slot)}
                      className="p-1 rounded-lg hover:bg-white/60 text-stone-400 hover:text-stone-600 transition-colors"
                      title="Edit time"
                    >
                      <Edit2 size={11} />
                    </button>
                    <button
                      onClick={() => toggleSlot(slot)}
                      className={`p-1 rounded-lg transition-colors ${slot.is_active ? 'text-emerald-500 hover:text-stone-400' : 'text-stone-400 hover:text-emerald-500'}`}
                      title={slot.is_active ? 'Disable' : 'Enable'}
                    >
                      <Check size={12} />
                    </button>
                    <button
                      onClick={() => deleteSlot(slot.id)}
                      className="p-1 rounded-lg text-stone-300 hover:text-red-400 transition-colors"
                      title="Remove slot"
                    >
                      <X size={11} />
                    </button>
                  </div>
                )}
              </div>
            );

            return (
              <div key={day} className={`px-5 py-4 ${isWeekend ? 'bg-stone-50/50' : ''}`}>
                {/* Day header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold uppercase tracking-wider ${daySlots.some(s => s.is_active) ? 'text-stone-800' : 'text-stone-300'}`}>
                      {day}
                    </span>
                    {daySlots.some(s => s.is_active) && (
                      <span className="text-[10px] bg-emerald-50 text-emerald-600 font-semibold px-1.5 py-0.5 rounded-full">
                        {daySlots.filter(s => s.is_active).length} active
                      </span>
                    )}
                    {isWeekend && (
                      <span className="text-[10px] text-stone-300 font-medium">Weekend</span>
                    )}
                  </div>
                  <button
                    onClick={() => addSlotForDay(i)}
                    className="text-[11px] font-semibold text-saffron-600 bg-saffron-50 px-2.5 py-1 rounded-lg hover:bg-saffron-100 transition-colors"
                  >
                    + Add slot
                  </button>
                </div>

                {/* Morning section */}
                {(() => {
                  const key = `${i}-morning`;
                  const open = isSectionOpen(key, true);
                  return (
                    <div className="mb-2">
                      <button
                        onClick={() => toggleSection(key)}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm">☀️</span>
                          <span className="text-xs font-bold text-amber-700">Morning</span>
                          <span className="text-[10px] text-amber-500 font-medium">12 AM – 11:59 AM</span>
                          {morningSlots.length > 0 && (
                            <span className="text-[10px] bg-amber-200 text-amber-800 font-semibold px-1.5 py-0.5 rounded-full">
                              {morningSlots.length}
                            </span>
                          )}
                        </div>
                        <ChevronRight size={14} className={`text-amber-500 transition-transform ${open ? 'rotate-90' : ''}`} />
                      </button>
                      {open && (
                        <div className="mt-2 space-y-2 pl-1">
                          {morningSlots.length === 0 ? (
                            <p className="text-xs text-stone-300 italic px-2">No morning slots</p>
                          ) : (
                            morningSlots.map(slot => <SlotItem key={slot.id} slot={slot} />)
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Evening section */}
                {(() => {
                  const key = `${i}-evening`;
                  const open = isSectionOpen(key, true);
                  return (
                    <div>
                      <button
                        onClick={() => toggleSection(key)}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm">🌆</span>
                          <span className="text-xs font-bold text-blue-700">Evening</span>
                          <span className="text-[10px] text-blue-400 font-medium">12 PM – 11:59 PM</span>
                          {eveningSlots.length > 0 && (
                            <span className="text-[10px] bg-blue-200 text-blue-800 font-semibold px-1.5 py-0.5 rounded-full">
                              {eveningSlots.length}
                            </span>
                          )}
                        </div>
                        <ChevronRight size={14} className={`text-blue-400 transition-transform ${open ? 'rotate-90' : ''}`} />
                      </button>
                      {open && (
                        <div className="mt-2 space-y-2 pl-1">
                          {eveningSlots.length === 0 ? (
                            <p className="text-xs text-stone-300 italic px-2">No evening slots</p>
                          ) : (
                            eveningSlots.map(slot => <SlotItem key={slot.id} slot={slot} />)
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      </div>}

      {/* Date override modal */}
      {dateModalOpen && selectedDate && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm" onClick={() => setDateModalOpen(false)}>
          <div className="bg-white rounded-t-3xl w-full max-w-md p-6 pb-10 animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-[11px] text-stone-400 font-semibold uppercase tracking-wider">Date Override</p>
                <h3 className="font-bold text-stone-800 text-base mt-0.5">
                  {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                </h3>
              </div>
              <button onClick={() => setDateModalOpen(false)} className="p-2 rounded-xl hover:bg-stone-100">
                <X size={18} className="text-stone-500" />
              </button>
            </div>

            {(() => {
              const calDate = new Date(selectedDate + 'T12:00:00');
              const dow = calDate.getDay();
              const daySlots = slots.filter(s => s.day_of_week === dow && s.is_active).sort((a, b) => a.start_hour * 60 + a.start_minute - (b.start_hour * 60 + b.start_minute));

              // Merge default slots + extra slots into a unified list
              const extraEntries = Object.entries(dateExtraSlots).map(([k, dur]) => {
                const [h, m] = k.split(':').map(Number);
                return { key: k, start_hour: h, start_minute: m, duration_minutes: dur, isExtra: true };
              });
              const defaultEntries = daySlots.map(s => ({ key: slotKey(s.start_hour, s.start_minute), start_hour: s.start_hour, start_minute: s.start_minute, duration_minutes: s.duration_minutes, isExtra: false }));
              const allEntries = [...defaultEntries, ...extraEntries].sort((a, b) => a.start_hour * 60 + a.start_minute - (b.start_hour * 60 + b.start_minute));

              const morningEntries = allEntries.filter(e => e.start_hour < 12);
              const eveningEntries = allEntries.filter(e => e.start_hour >= 12);

              // All currently occupied slot keys (to exclude from Add slot picker)
              const occupiedKeys = new Set(allEntries.map(e => e.key));

              // Available times for the add-slot picker (all half-hours 6 AM–10 PM, not already in list)
              const availableTimes = HOURS.flatMap(h => [0, 30].map(m => ({ h, m, key: slotKey(h, m) }))).filter(t => !occupiedKeys.has(t.key) && t.h >= 6 && t.h <= 21);

              const SlotToggle = ({ entry }: { entry: typeof allEntries[0] }) => {
                const on = entry.isExtra ? true : (dateSlotToggles[entry.key] ?? true);
                return (
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all ${
                    on ? 'bg-emerald-50 border-emerald-200' : 'bg-stone-50 border-stone-200 opacity-50'
                  }`}>
                    <Clock size={12} className={on ? 'text-emerald-500' : 'text-stone-400'} />
                    <span className={`text-xs font-semibold flex-1 ${on ? 'text-emerald-800' : 'text-stone-400 line-through'}`}>
                      {fmt(entry.start_hour, entry.start_minute)}
                      <span className="font-normal text-[11px] ml-1 opacity-70">· {entry.duration_minutes}m</span>
                    </span>
                    {entry.isExtra ? (
                      <button
                        onClick={() => setDateExtraSlots(prev => { const next = { ...prev }; delete next[entry.key]; return next; })}
                        className="p-1 rounded-lg text-stone-300 hover:text-red-400 transition-colors"
                        title="Remove"
                      >
                        <X size={11} />
                      </button>
                    ) : (
                      <button
                        onClick={() => setDateSlotToggles(prev => ({ ...prev, [entry.key]: !on }))}
                        className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all flex-shrink-0 ${on ? 'bg-emerald-500 border-emerald-500' : 'border-stone-300'}`}
                      >
                        {on && <Check size={10} className="text-white" />}
                      </button>
                    )}
                  </div>
                );
              };

              return (
                <div className="space-y-4 mb-6">
                  {allEntries.length === 0 && !showAddSlot && (
                    <p className="text-xs text-stone-400 italic">No default slots for this day. Add a custom slot below.</p>
                  )}

                  {/* Morning */}
                  {morningEntries.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm">☀️</span>
                        <span className="text-xs font-bold text-amber-700">Morning</span>
                        <span className="text-[10px] text-amber-500">12 AM – 11:59 AM</span>
                      </div>
                      <div className="space-y-2">
                        {morningEntries.map(e => <SlotToggle key={e.key} entry={e} />)}
                      </div>
                    </div>
                  )}

                  {/* Evening */}
                  {eveningEntries.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm">🌆</span>
                        <span className="text-xs font-bold text-blue-700">Evening</span>
                        <span className="text-[10px] text-blue-400">12 PM – 11:59 PM</span>
                      </div>
                      <div className="space-y-2">
                        {eveningEntries.map(e => <SlotToggle key={e.key} entry={e} />)}
                      </div>
                    </div>
                  )}

                  {/* Add slot inline form */}
                  {showAddSlot ? (
                    <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 space-y-3">
                      <p className="text-xs font-bold text-stone-600">New Slot</p>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <label className="block text-[11px] font-semibold text-stone-400 mb-1">Time</label>
                          <select
                            value={addSlotTime}
                            onChange={e => setAddSlotTime(e.target.value)}
                            className="w-full text-xs border border-stone-200 rounded-xl px-2.5 py-2 bg-white focus:outline-none focus:border-saffron-400"
                          >
                            {availableTimes.length === 0 ? (
                              <option disabled>All times taken</option>
                            ) : (
                              availableTimes.map(({ h, m, key }) => (
                                <option key={key} value={key}>{fmt(h, m)}</option>
                              ))
                            )}
                          </select>
                        </div>
                        <div className="flex-1">
                          <label className="block text-[11px] font-semibold text-stone-400 mb-1">Duration</label>
                          <select
                            value={addSlotDuration}
                            onChange={e => setAddSlotDuration(Number(e.target.value))}
                            className="w-full text-xs border border-stone-200 rounded-xl px-2.5 py-2 bg-white focus:outline-none focus:border-saffron-400"
                          >
                            <option value={30}>30 min</option>
                            <option value={45}>45 min</option>
                            <option value={60}>60 min</option>
                            <option value={90}>90 min</option>
                            <option value={120}>2 hr</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            if (availableTimes.length === 0) return;
                            const key = addSlotTime;
                            setDateExtraSlots(prev => ({ ...prev, [key]: addSlotDuration }));
                            // Set default selection for next add
                            const remaining = availableTimes.filter(t => t.key !== key);
                            if (remaining.length > 0) setAddSlotTime(remaining[0].key);
                            setShowAddSlot(false);
                          }}
                          disabled={availableTimes.length === 0}
                          className="flex-1 py-2 bg-saffron-500 text-white text-xs font-bold rounded-xl hover:bg-saffron-600 active:scale-[0.98] transition-all disabled:opacity-40"
                        >
                          Add
                        </button>
                        <button
                          onClick={() => setShowAddSlot(false)}
                          className="flex-1 py-2 border border-stone-200 text-stone-500 text-xs font-semibold rounded-xl hover:bg-white active:scale-[0.98] transition-all"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        const remaining = availableTimes;
                        if (remaining.length > 0) setAddSlotTime(remaining[0].key);
                        setShowAddSlot(true);
                      }}
                      className="w-full flex items-center justify-center gap-1.5 py-2.5 border-2 border-dashed border-stone-200 rounded-xl text-xs font-semibold text-stone-400 hover:border-saffron-300 hover:text-saffron-500 transition-all"
                    >
                      <Plus size={13} />
                      Add slot
                    </button>
                  )}
                </div>
              );
            })()}

            <div className="space-y-2">
              <button
                onClick={async () => {
                  setSaving(true);
                  const enabledKeys = [
                    ...Object.entries(dateSlotToggles).filter(([, on]) => on).map(([k]) => k),
                    ...Object.keys(dateExtraSlots),
                  ];
                  const existing = overrides.find(o => o.override_date === selectedDate);
                  const payload = {
                    mentor_id: mentorId,
                    override_date: selectedDate,
                    is_unavailable: false,
                    start_hour: dateEdit.start_hour,
                    start_minute: dateEdit.start_minute,
                    duration_minutes: 60,
                    note: JSON.stringify({ enabled: enabledKeys, extra: dateExtraSlots }),
                  };
                  if (existing) {
                    await supabase.from('mentor_availability_overrides').update(payload).eq('id', existing.id);
                    setOverrides(prev => prev.map(o => o.id === existing.id ? { ...o, ...payload } : o));
                  } else {
                    const { data } = await supabase.from('mentor_availability_overrides').insert(payload).select().maybeSingle();
                    if (data) setOverrides(prev => [...prev, data as Override]);
                  }
                  setSaving(false);
                  setDateModalOpen(false);
                }}
                disabled={saving}
                className="w-full py-3 bg-saffron-500 text-white text-sm font-bold rounded-2xl hover:bg-saffron-600 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                Save
              </button>
              <button
                onClick={() => markUnavailable(selectedDate)}
                className={`w-full py-3 border-2 text-sm font-bold rounded-2xl active:scale-[0.98] transition-all ${
                  overrideMap[selectedDate]?.is_unavailable
                    ? 'border-stone-200 text-stone-500 hover:bg-stone-50'
                    : 'border-red-100 text-red-500 hover:bg-red-50'
                }`}
              >
                {overrideMap[selectedDate]?.is_unavailable ? 'Remove Unavailable Mark' : 'Mark as Unavailable'}
              </button>
              {overrideMap[selectedDate] && (
                <button
                  onClick={() => clearOverride(selectedDate)}
                  className="w-full py-3 border border-stone-200 text-stone-500 text-sm font-semibold rounded-2xl hover:bg-stone-50 active:scale-[0.98] transition-all"
                >
                  Clear Override (Use Default Schedule)
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
