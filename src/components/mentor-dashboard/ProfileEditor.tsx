import { useState, useEffect } from 'react';
import { Plus, Trash2, Save, CreditCard as Edit2, X, Clock, DollarSign, Star } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { resolveLocaleFromLocation } from '../../lib/localization';
import { Mentor, MentorshipPackage, Testimonial, INDUSTRIES, DIALECTS } from '../../lib/types';
import Avatar from '../common/Avatar';
import StarRating from '../common/StarRating';

interface ProfileEditorProps {
  mentor: Mentor;
  onUpdated: () => void;
}

const EMPTY_PKG = { title: '', description: '', price_usd: 0, duration_minutes: 60 };

export default function ProfileEditor({ mentor, onUpdated }: ProfileEditorProps) {
  const profile = mentor.profiles!;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    headline: mentor.headline || '',
    industry: mentor.industry || '',
    years_experience: mentor.years_experience || 0,
    session_price_30min: mentor.session_price_30min || 0,
    session_price_60min: mentor.session_price_60min || 0,
    tamil_proficiency: mentor.tamil_proficiency || 'Both',
    expertise: (mentor.expertise || []).join(', '),
    bio: profile.bio || '',
    location: profile.location || '',
    linkedin_url: profile.linkedin_url || '',
  });

  const resolvedCurrency = form.location ? resolveLocaleFromLocation(form.location)?.currency : null;

  const currencySymbol = resolvedCurrency === 'INR' ? '₹'
    : resolvedCurrency === 'EUR' ? '€'
    : resolvedCurrency === 'GBP' ? '£'
    : resolvedCurrency === 'CAD' ? 'C$'
    : resolvedCurrency === 'AUD' ? 'A$'
    : resolvedCurrency === 'SGD' ? 'S$'
    : resolvedCurrency === 'AED' ? 'AED'
    : resolvedCurrency === 'JPY' ? '¥'
    : '$';

  const [packages, setPackages] = useState<MentorshipPackage[]>([]);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [editingPkg, setEditingPkg] = useState<Partial<MentorshipPackage> & typeof EMPTY_PKG | null>(null);
  const [pkgError, setPkgError] = useState('');

  useEffect(() => {
    loadPackages();
    loadTestimonials();
  }, [mentor.id]);

  async function loadPackages() {
    const { data } = await supabase
      .from('mentorship_packages')
      .select('*')
      .eq('mentor_id', mentor.id)
      .order('created_at', { ascending: true });
    if (data) setPackages(data as MentorshipPackage[]);
  }

  async function loadTestimonials() {
    const { data } = await supabase
      .from('testimonials')
      .select('*, profiles(*)')
      .eq('mentor_id', mentor.id)
      .order('created_at', { ascending: false });
    if (data) setTestimonials(data as Testimonial[]);
  }

  async function handleSaveProfile() {
    setSaving(true);
    try {
      const MIN_RATE = 1;
      const saved30 = Math.max(Number(form.session_price_30min) || 0, MIN_RATE);
      const saved60 = Math.max(Number(form.session_price_60min) || 0, MIN_RATE);

      await Promise.all([
        supabase.from('mentors').update({
          headline: form.headline,
          industry: form.industry,
          years_experience: Number(form.years_experience),
          session_price_30min: saved30,
          session_price_60min: saved60,
          tamil_proficiency: form.tamil_proficiency,
          expertise: form.expertise.split(',').map(s => s.trim()).filter(Boolean),
        }).eq('id', mentor.id),
        supabase.from('profiles').update({
          bio: form.bio,
          location: form.location,
          linkedin_url: form.linkedin_url,
          updated_at: new Date().toISOString(),
        }).eq('id', profile.id),
      ]);
      onUpdated();
    } finally {
      setSaving(false);
    }
  }

  async function savePkg() {
    if (!editingPkg) return;
    if (!editingPkg.title.trim()) { setPkgError('Title is required'); return; }
    setPkgError('');
    if (editingPkg.id) {
      await supabase.from('mentorship_packages').update({
        title: editingPkg.title,
        description: editingPkg.description,
        price_usd: Number(editingPkg.price_usd),
        duration_minutes: Number(editingPkg.duration_minutes),
      }).eq('id', editingPkg.id);
    } else {
      await supabase.from('mentorship_packages').insert({
        mentor_id: mentor.id,
        title: editingPkg.title,
        description: editingPkg.description,
        price_usd: Number(editingPkg.price_usd),
        duration_minutes: Number(editingPkg.duration_minutes),
      });
    }
    setEditingPkg(null);
    loadPackages();
  }

  async function deletePkg(id: string) {
    await supabase.from('mentorship_packages').delete().eq('id', id);
    loadPackages();
  }

  async function toggleFeatured(t: Testimonial) {
    await supabase.from('testimonials').update({ is_featured: !t.is_featured }).eq('id', t.id);
    loadTestimonials();
  }

  return (
    <div className="space-y-5 pb-8">
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-5 py-4 flex items-center gap-4">
          <Avatar name={profile.full_name} imageUrl={profile.avatar_url} size="lg" />
          <div>
            <h3 className="text-white font-bold text-lg">{profile.full_name}</h3>
            <p className="text-slate-400 text-sm">{form.headline || 'Add your headline below'}</p>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Professional Headline</label>
            <input
              type="text"
              value={form.headline}
              onChange={e => setForm({ ...form, headline: e.target.value })}
              placeholder="e.g., Senior Engineer at Google · 10 yrs experience"
              className="input-field text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Bio</label>
            <textarea
              value={form.bio}
              onChange={e => setForm({ ...form, bio: e.target.value })}
              rows={4}
              className="input-field text-sm resize-none"
              maxLength={800}
              placeholder="Share your story, expertise, and what you offer mentees..."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Industry</label>
              <select
                value={form.industry}
                onChange={e => setForm({ ...form, industry: e.target.value })}
                className="input-field text-sm"
              >
                {INDUSTRIES.filter(i => i !== 'All').map(i => (
                  <option key={i} value={i}>{i}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Years Experience</label>
              <input
                type="number"
                min={0}
                value={form.years_experience}
                onChange={e => setForm({ ...form, years_experience: Number(e.target.value) })}
                className="input-field text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Areas of Expertise (comma-separated)</label>
            <input
              type="text"
              value={form.expertise}
              onChange={e => setForm({ ...form, expertise: e.target.value })}
              placeholder="e.g., Career Coaching, System Design, Interviews"
              className="input-field text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">30-min Rate</label>
              <p className="text-[10px] text-slate-400 mb-1">{resolvedCurrency ? `In ${resolvedCurrency}` : ''}</p>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none select-none">{currencySymbol}</span>
                <input
                  type="number"
                  min={0}
                  value={form.session_price_30min}
                  onChange={e => setForm({ ...form, session_price_30min: Number(e.target.value) })}
                  className="input-field text-sm pl-8"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">60-min Rate</label>
              <p className="text-[10px] text-slate-400 mb-1">{resolvedCurrency ? `In ${resolvedCurrency}` : ''}</p>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none select-none">{currencySymbol}</span>
                <input
                  type="number"
                  min={0}
                  value={form.session_price_60min}
                  onChange={e => setForm({ ...form, session_price_60min: Number(e.target.value) })}
                  className="input-field text-sm pl-8"
                />
              </div>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-2">Tamil Proficiency</label>
            <div className="flex gap-2">
              {DIALECTS.map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setForm({ ...form, tamil_proficiency: d })}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all ${
                    form.tamil_proficiency === d
                      ? 'bg-slate-700 text-white border-slate-700'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Location</label>
              <input
                type="text"
                value={form.location}
                onChange={e => setForm({ ...form, location: e.target.value })}
                placeholder="City, Country"
                className="input-field text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">LinkedIn URL</label>
              <input
                type="url"
                value={form.linkedin_url}
                onChange={e => setForm({ ...form, linkedin_url: e.target.value })}
                placeholder="linkedin.com/in/..."
                className="input-field text-sm"
              />
            </div>
          </div>
          <button
            onClick={handleSaveProfile}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-3 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl text-sm transition-all active:scale-[0.98] disabled:opacity-50"
          >
            <Save size={15} />
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between border-b border-slate-50">
          <div>
            <h3 className="font-bold text-slate-800">Mentorship Packages</h3>
            <p className="text-xs text-slate-400 mt-0.5">Define your service offerings and pricing</p>
          </div>
          <button
            onClick={() => setEditingPkg({ ...EMPTY_PKG })}
            className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 px-3 py-1.5 rounded-xl transition-colors"
          >
            <Plus size={13} /> Add Package
          </button>
        </div>

        {editingPkg && (
          <div className="p-5 bg-slate-50 border-b border-slate-100">
            <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-3">
              {editingPkg.id ? 'Edit Package' : 'New Package'}
            </p>
            <div className="space-y-3">
              <input
                type="text"
                value={editingPkg.title}
                onChange={e => setEditingPkg({ ...editingPkg, title: e.target.value })}
                placeholder="Package title (e.g., Resume Review)"
                className="input-field text-sm"
              />
              <textarea
                value={editingPkg.description}
                onChange={e => setEditingPkg({ ...editingPkg, description: e.target.value })}
                placeholder="Brief description of what's included..."
                rows={2}
                className="input-field text-sm resize-none"
              />
              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <DollarSign size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="number"
                    min={0}
                    value={editingPkg.price_usd}
                    onChange={e => setEditingPkg({ ...editingPkg, price_usd: Number(e.target.value) })}
                    placeholder="Price USD"
                    className="input-field text-sm pl-7"
                  />
                </div>
                <div className="relative">
                  <Clock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="number"
                    min={15}
                    step={15}
                    value={editingPkg.duration_minutes}
                    onChange={e => setEditingPkg({ ...editingPkg, duration_minutes: Number(e.target.value) })}
                    placeholder="Duration (min)"
                    className="input-field text-sm pl-7"
                  />
                </div>
              </div>
              {pkgError && <p className="text-red-500 text-xs">{pkgError}</p>}
              <div className="flex gap-2">
                <button
                  onClick={savePkg}
                  className="flex-1 py-2 bg-slate-800 text-white text-sm font-semibold rounded-xl hover:bg-slate-700 transition-colors"
                >
                  Save
                </button>
                <button
                  onClick={() => { setEditingPkg(null); setPkgError(''); }}
                  className="px-4 py-2 border border-slate-200 text-slate-600 text-sm font-semibold rounded-xl hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="divide-y divide-slate-50">
          {packages.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <p className="text-slate-400 text-sm">No packages yet. Add your first service offering.</p>
            </div>
          ) : (
            packages.map(pkg => (
              <div key={pkg.id} className="px-5 py-4 flex items-start gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-semibold text-slate-800 text-sm">{pkg.title}</span>
                    <span className="text-xs bg-blue-50 text-blue-600 font-semibold px-2 py-0.5 rounded-full">
                      ${pkg.price_usd}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">{pkg.description}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <Clock size={11} className="text-slate-300" />
                    <span className="text-[11px] text-slate-400">{pkg.duration_minutes} min</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => setEditingPkg(pkg)}
                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    onClick={() => deletePkg(pkg.id)}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-50">
          <h3 className="font-bold text-slate-800">Testimonials</h3>
          <p className="text-xs text-slate-400 mt-0.5">Toggle which reviews appear on your public profile</p>
        </div>
        <div className="divide-y divide-slate-50">
          {testimonials.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <p className="text-slate-400 text-sm">No testimonials yet. They appear after completed sessions.</p>
            </div>
          ) : (
            testimonials.map(t => (
              <div key={t.id} className="px-5 py-4 flex items-start gap-3">
                <Avatar name={t.profiles?.full_name || 'M'} imageUrl={t.profiles?.avatar_url} size="sm" className="flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-slate-700">{t.profiles?.full_name || 'Mentee'}</span>
                    <StarRating rating={t.rating} size={12} />
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">{t.content}</p>
                  <p className="text-[11px] text-slate-300 mt-1">
                    {new Date(t.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <button
                  onClick={() => toggleFeatured(t)}
                  title={t.is_featured ? 'Remove from profile' : 'Feature on profile'}
                  className={`flex-shrink-0 p-1.5 rounded-lg transition-colors ${
                    t.is_featured ? 'bg-yellow-50 text-yellow-500' : 'bg-slate-50 text-slate-300 hover:text-yellow-400'
                  }`}
                >
                  <Star size={14} fill={t.is_featured ? 'currentColor' : 'none'} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
