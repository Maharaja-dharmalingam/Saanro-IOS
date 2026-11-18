import { useState, useEffect } from 'react';
import { ChevronRight, X, Save, Plus, MapPin, Target, StickyNote } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Profile, MenteeNote, Booking } from '../../lib/types';
import Avatar from '../common/Avatar';

interface ActiveRosterProps {
  mentorId: string;
}

interface MenteeWithNote {
  profile: Profile;
  notes: MenteeNote[];
  bookingCount: number;
  lastSession: string | null;
  goals: string[];
}

export default function ActiveRoster({ mentorId }: ActiveRosterProps) {
  const [mentees, setMentees] = useState<MenteeWithNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<MenteeWithNote | null>(null);
  const [newNote, setNewNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  useEffect(() => {
    loadRoster();
  }, [mentorId]);

  async function loadRoster() {
    setLoading(true);
    const { data: bookings } = await supabase
      .from('bookings')
      .select('mentee_id, scheduled_at, notes, status, profiles(*)')
      .eq('mentor_id', mentorId)
      .in('status', ['confirmed', 'completed']);

    if (!bookings) { setLoading(false); return; }

    const map = new Map<string, MenteeWithNote>();
    bookings.forEach((b: Booking & { profiles?: Profile }) => {
      if (!b.profiles) return;
      const existing = map.get(b.mentee_id);
      if (existing) {
        existing.bookingCount++;
        if (!existing.lastSession || b.scheduled_at > existing.lastSession) {
          existing.lastSession = b.scheduled_at;
        }
        if (b.notes) existing.goals.push(b.notes);
      } else {
        map.set(b.mentee_id, {
          profile: b.profiles as Profile,
          notes: [],
          bookingCount: 1,
          lastSession: b.scheduled_at,
          goals: b.notes ? [b.notes] : [],
        });
      }
    });

    const menteeIds = Array.from(map.keys());
    if (menteeIds.length > 0) {
      const { data: notesData } = await supabase
        .from('mentee_notes')
        .select('*')
        .eq('mentor_id', mentorId)
        .in('mentee_id', menteeIds)
        .order('created_at', { ascending: false });

      if (notesData) {
        notesData.forEach((n: MenteeNote) => {
          const m = map.get(n.mentee_id);
          if (m) m.notes.push(n);
        });
      }
    }

    setMentees(Array.from(map.values()));
    setLoading(false);
  }

  async function addNote() {
    if (!selected || !newNote.trim()) return;
    setSavingNote(true);
    const { data } = await supabase.from('mentee_notes').insert({
      mentor_id: mentorId,
      mentee_id: selected.profile.id,
      content: newNote.trim(),
    }).select().single();
    if (data) {
      const updated = { ...selected, notes: [data as MenteeNote, ...selected.notes] };
      setSelected(updated);
      setMentees(prev => prev.map(m => m.profile.id === selected.profile.id ? updated : m));
    }
    setNewNote('');
    setSavingNote(false);
  }

  async function deleteNote(noteId: string) {
    if (!selected) return;
    await supabase.from('mentee_notes').delete().eq('id', noteId);
    const updated = { ...selected, notes: selected.notes.filter(n => n.id !== noteId) };
    setSelected(updated);
    setMentees(prev => prev.map(m => m.profile.id === selected.profile.id ? updated : m));
  }

  if (selected) {
    return (
      <div className="pb-8 animate-fade-in">
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden mb-4">
          <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-5 py-4 flex items-center gap-4">
            <button
              onClick={() => setSelected(null)}
              className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
            >
              <X size={16} className="text-white" />
            </button>
            <Avatar name={selected.profile.full_name} imageUrl={selected.profile.avatar_url} size="md" />
            <div>
              <h3 className="text-white font-bold">{selected.profile.full_name}</h3>
              <p className="text-slate-400 text-xs">
                {selected.bookingCount} session{selected.bookingCount !== 1 ? 's' : ''} total
                {selected.lastSession && ` · Last: ${new Date(selected.lastSession).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
              </p>
            </div>
          </div>

          <div className="p-5 space-y-4">
            {selected.profile.location && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <MapPin size={14} className="text-slate-400" />
                {selected.profile.location}
              </div>
            )}
            {selected.profile.bio && (
              <p className="text-sm text-slate-600 leading-relaxed">{selected.profile.bio}</p>
            )}
            {selected.goals.length > 0 && (
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Target size={12} /> Goals from Sessions
                </p>
                <div className="space-y-1.5">
                  {[...new Set(selected.goals)].slice(0, 3).map((g, i) => (
                    <div key={i} className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 text-xs text-blue-700">
                      {g}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-50 flex items-center gap-2">
            <StickyNote size={15} className="text-amber-500" />
            <h3 className="font-bold text-slate-800">Session Notes</h3>
          </div>

          <div className="p-5 space-y-3">
            <div className="flex gap-2">
              <textarea
                value={newNote}
                onChange={e => setNewNote(e.target.value)}
                placeholder="Add a note from this session..."
                rows={3}
                className="input-field text-sm resize-none flex-1"
              />
            </div>
            <button
              onClick={addNote}
              disabled={!newNote.trim() || savingNote}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white text-sm font-semibold rounded-xl hover:bg-slate-700 transition-colors disabled:opacity-40"
            >
              <Plus size={14} />
              {savingNote ? 'Saving...' : 'Add Note'}
            </button>
          </div>

          <div className="divide-y divide-slate-50">
            {selected.notes.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-slate-400 text-sm">No notes yet. Start documenting your sessions.</p>
              </div>
            ) : (
              selected.notes.map(note => (
                <div key={note.id} className="px-5 py-4 flex items-start gap-3">
                  <div className="flex-1">
                    <p className="text-sm text-slate-700 leading-relaxed">{note.content}</p>
                    <p className="text-[11px] text-slate-400 mt-1.5">
                      {new Date(note.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                  <button
                    onClick={() => deleteNote(note.id)}
                    className="text-slate-300 hover:text-red-400 transition-colors mt-0.5 flex-shrink-0"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-8">
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-2xl border border-slate-100 p-4 animate-pulse">
              <div className="flex gap-3">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-100 rounded w-1/2" />
                  <div className="h-3 bg-slate-100 rounded w-1/3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : mentees.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 px-5 py-12 text-center">
          <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Target size={20} className="text-slate-300" />
          </div>
          <p className="text-slate-500 font-medium text-sm">No active mentees yet</p>
          <p className="text-slate-400 text-xs mt-1">Mentees will appear here once sessions are confirmed.</p>
        </div>
      ) : (
        mentees.map(m => (
          <button
            key={m.profile.id}
            onClick={() => setSelected(m)}
            className="w-full bg-white rounded-2xl border border-slate-100 p-4 flex items-center gap-3 hover:border-slate-300 hover:shadow-sm transition-all text-left"
          >
            <Avatar name={m.profile.full_name} imageUrl={m.profile.avatar_url} size="md" className="flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-slate-800 text-sm">{m.profile.full_name}</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {m.bookingCount} session{m.bookingCount !== 1 ? 's' : ''}
                {m.lastSession && ` · ${new Date(m.lastSession).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
              </p>
              {m.notes.length > 0 && (
                <div className="flex items-center gap-1 mt-1">
                  <StickyNote size={10} className="text-amber-400" />
                  <span className="text-[11px] text-amber-600">{m.notes.length} note{m.notes.length > 1 ? 's' : ''}</span>
                </div>
              )}
            </div>
            <ChevronRight size={16} className="text-slate-300 flex-shrink-0" />
          </button>
        ))
      )}
    </div>
  );
}
