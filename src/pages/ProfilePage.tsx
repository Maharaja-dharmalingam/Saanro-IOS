import { useState, useEffect, useRef, useMemo } from 'react';
import { LogOut, CreditCard as Edit3, Save, X, MapPin, Globe, Linkedin, Star, Calendar, ChevronRight, Camera, DollarSign, Clock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { User } from '@supabase/supabase-js';
import { REGIONS, DIALECTS, CURRENCIES, Mentor } from '../lib/types';
import Avatar from '../components/common/Avatar';
import LocationAutocomplete from '../components/common/LocationAutocomplete';
import { resolveLocaleFromLocation, getTimezoneLabel } from '../lib/localization';
import { getUserTimezone } from '../lib/utils';
import NotificationsScreen from '../components/settings/NotificationsScreen';
import PrivacyScreen from '../components/settings/PrivacyScreen';
import HelpSupportScreen from '../components/settings/HelpSupportScreen';
import TermsScreen from '../components/settings/TermsScreen';
import PrivacyPolicyScreen from '../components/settings/PrivacyPolicyScreen';
import { useApp } from '../contexts/AppContext';

type SettingsView = null | 'notifications' | 'privacy' | 'help' | 'terms' | 'privacypolicy';

function initForm(profile: NonNullable<ReturnType<typeof useAuth>['profile']>, authUser: User | null, mentorProfile: Mentor | null) {
  const resolved = profile.location ? resolveLocaleFromLocation(profile.location) : null;

  // Logic to resolve the best possible name for the edit form
  const nameFromAuth = authUser?.user_metadata?.full_name || '';
  const nameFromEmail = authUser?.email?.split('@')[0] || '';

  let initialName = profile.full_name || '';
  if (!initialName || initialName.toLowerCase() === 'there') {
    initialName = nameFromAuth || nameFromEmail || 'User';
  }

  return {
    full_name: initialName,
    role: profile.role || 'mentee' as const,
    bio: profile.bio || '',
    location: profile.location || '',
    native_region: profile.native_region || '',
    primary_dialect: profile.primary_dialect || 'Casual',
    linkedin_url: profile.linkedin_url || '',
    preferred_currency: resolved?.currency ?? profile.preferred_currency ?? 'USD',
    timezone: resolved?.timezone ?? getUserTimezone(),
    pricingMode: mentorProfile ? (mentorProfile.session_price_30min > 0 || mentorProfile.session_price_60min > 0 ? 'paid' : 'free') : 'paid',
    price30: mentorProfile ? String(mentorProfile.session_price_30min ?? '') : '',
    price60: mentorProfile ? String(mentorProfile.session_price_60min ?? '') : '',
  };
}

export default function ProfilePage() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const { setOpenMentorDashboard } = useApp();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [settingsView, setSettingsView] = useState<SettingsView>(null);
  const [mentor, setMentor] = useState<Mentor | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState(() => profile ? initForm(profile, user, mentor) : {
    full_name: '', role: 'mentee' as const, bio: '', location: '',
    native_region: '', primary_dialect: 'Casual', linkedin_url: '',
    preferred_currency: 'USD', timezone: getUserTimezone(),
    pricingMode: 'paid' as const, price30: '', price60: '',
  });

  const [currencyAutoSet, setCurrencyAutoSet] = useState(false);

  // DEEP NAME RESOLUTION:
  // 1. Database name (if valid)
  // 2. Auth Metadata name
  // 3. Email prefix
  const displayName = useMemo(() => {
    const dbName = profile?.full_name?.trim();
    if (dbName && dbName.toLowerCase() !== 'there') return dbName;

    const metaName = user?.user_metadata?.full_name;
    if (metaName && metaName.toLowerCase() !== 'there') return metaName;

    const emailName = user?.email?.split('@')[0];
    return emailName || 'User';
  }, [profile, user]);

  function handleLocationChange(newLocation: string) {
    const resolved = resolveLocaleFromLocation(newLocation);
    if (resolved) {
      setForm(prev => ({ ...prev, location: newLocation, preferred_currency: resolved.currency, timezone: resolved.timezone }));
      setCurrencyAutoSet(true);
    } else {
      setForm(prev => ({ ...prev, location: newLocation }));
    }
  }

  useEffect(() => {
    setCurrencyAutoSet(false);
    if (!editing && profile) setForm(initForm(profile, user, mentor));
  }, [editing, profile, user, mentor]);

  useEffect(() => {
    if (!profile || !user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from('mentors').select('*').eq('profile_id', profile.id).maybeSingle();
      if (!cancelled) setMentor((data as Mentor | null) ?? null);
    })();
    return () => { cancelled = true; };
  }, [profile, user]);

  const timezoneLabel = (() => {
    const loc = editing ? form.location : (profile?.location ?? '');
    const resolved = loc ? resolveLocaleFromLocation(loc) : null;
    return resolved?.label ?? getTimezoneLabel(getUserTimezone());
  })();

  const viewCurrency = (() => {
    if (!profile) return CURRENCIES[0];
    const resolved = profile.location ? resolveLocaleFromLocation(profile.location) : null;
    const code = resolved?.currency ?? profile.preferred_currency ?? 'USD';
    return CURRENCIES.find(c => c.code === code) ?? CURRENCIES[0];
  })();

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    setUploadingPhoto(true);
    setError('');
    try {
      const ext = file.name.split('.').pop();
      const path = `${profile.id}/avatar.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;

      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      const avatarUrl = `${data.publicUrl}?t=${Date.now()}`;

      const { error: updateErr } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
        .eq('id', profile.id);
      if (updateErr) throw updateErr;

      await refreshProfile();
    } catch (e: unknown) {
      setError((e as Error).message || 'Failed to upload photo');
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleSave() {
    if (!profile) return;
    setSaving(true);
    setError('');
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { timezone: _tz, pricingMode: _pricing, price30: _p30, price60: _p60, ...profileDb } = form;
      const { error: profileErr } = await supabase
        .from('profiles')
        .update({ ...profileDb, updated_at: new Date().toISOString() })
        .eq('id', profile.id);
      if (profileErr) throw profileErr;

      if (profile.role === 'mentor') {
        const mentorPayload = {
          profile_id: profile.id,
          industry: mentor?.industry || '',
          expertise: mentor?.expertise || [],
          tamil_proficiency: profile.primary_dialect as 'Formal' | 'Casual' | 'Both',
          years_experience: mentor?.years_experience ?? 0,
          headline: mentor?.headline || `${profile.role === 'mentor' ? 'Mentor' : 'Mentee'} Profile`,
          session_price_30min: form.pricingMode === 'free' ? 0 : Number(form.price30 || form.price60 || 0),
          session_price_60min: form.pricingMode === 'free' ? 0 : Number(form.price60 || form.price30 || 0),
        };
        if (mentor?.id) {
          const { error: mentorErr } = await supabase.from('mentors').update(mentorPayload).eq('id', mentor.id);
          if (mentorErr) throw mentorErr;
        } else {
          const { error: mentorErr } = await supabase.from('mentors').insert(mentorPayload);
          if (mentorErr) throw mentorErr;
        }
      }

      await refreshProfile();
      setEditing(false);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function cancelEdit() {
    setEditing(false);
    setError('');
  }

  if (!profile) return null;

  if (settingsView === 'notifications') return <NotificationsScreen onBack={() => setSettingsView(null)} />;
  if (settingsView === 'privacy') return <PrivacyScreen onBack={() => setSettingsView(null)} />;
  if (settingsView === 'help') return <HelpSupportScreen onBack={() => setSettingsView(null)} />;
  if (settingsView === 'terms') return <TermsScreen onBack={() => setSettingsView(null)} />;
  if (settingsView === 'privacypolicy') return <PrivacyPolicyScreen onBack={() => setSettingsView(null)} />;

  return (
    <div className="pb-24 animate-fade-in">
      <div className="gradient-hero px-4 pt-8 pb-16">
        <div className="max-w-md mx-auto flex flex-col items-center text-center">
          <div className="relative">
            <Avatar name={displayName} imageUrl={profile.avatar_url} size="xl" />
            <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center border-2 border-white ${
              profile.role === 'mentor' ? 'bg-saffron-500' : 'bg-blue-500'
            }`}>
              <span className="text-white text-[8px] font-bold uppercase">
                {profile.role === 'mentor' ? 'M' : 'U'}
              </span>
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingPhoto}
              className="absolute -top-1 -right-1 w-7 h-7 bg-white rounded-full flex items-center justify-center shadow-md border border-stone-100 hover:bg-stone-50 active:scale-95 transition-all"
              title="Change photo"
            >
              {uploadingPhoto ? (
                <span className="w-3 h-3 border-2 border-stone-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Camera size={13} className="text-stone-600" />
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handlePhotoChange}
            />
          </div>
          <h2 className="text-white text-xl font-bold mt-3">{displayName}</h2>
          <p className="text-white/60 text-sm capitalize mt-0.5">{profile.role}</p>
          {profile.location && (
            <div className="flex items-center gap-1 mt-2">
              <MapPin size={12} className="text-white/50" />
              <span className="text-white/50 text-xs">{profile.location}</span>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 -mt-8 max-w-md mx-auto space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-100 rounded-xl p-3">
            <p className="text-red-600 text-xs">{error}</p>
          </div>
        )}

        <div className="card p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-stone-800">Profile Info</h3>
            {!editing ? (
              profile.role === 'mentor' ? (
                <button
                  onClick={() => setOpenMentorDashboard(true)}
                  className="flex items-center gap-1.5 text-saffron-500 text-sm font-semibold hover:text-saffron-600 active:scale-95 transition-all"
                >
                  <Edit3 size={14} />
                  Edit
                </button>
              ) : (
                <button
                  onClick={() => setEditing(true)}
                  className="flex items-center gap-1.5 text-saffron-500 text-sm font-semibold hover:text-saffron-600 active:scale-95 transition-all"
                >
                  <Edit3 size={14} />
                  Edit
                </button>
              )
            ) : (
              <div className="flex items-center gap-2">
                <button onClick={cancelEdit} className="p-1.5 rounded-xl hover:bg-stone-50 text-stone-500">
                  <X size={16} />
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-saffron-500 text-white text-xs font-semibold rounded-xl active:scale-95 transition-all"
                >
                  <Save size={13} />
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            )}
          </div>

          {editing && profile.role !== 'mentor' ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-stone-500 mb-1">Full Name</label>
                <input
                  type="text"
                  value={form.full_name}
                  onChange={e => setForm({ ...form, full_name: e.target.value })}
                  className="input-field text-sm py-2.5"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-500 mb-2">Role</label>
                <div className="flex gap-2">
                  {(['mentee', 'mentor'] as const).map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setForm({ ...form, role: r })}
                      className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all capitalize ${
                        form.role === r
                          ? 'bg-saffron-500 text-white border-saffron-500'
                          : 'bg-white text-stone-600 border-stone-200'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-500 mb-1">Bio</label>
                <textarea
                  value={form.bio}
                  onChange={e => setForm({ ...form, bio: e.target.value })}
                  rows={3}
                  className="input-field text-sm resize-none"
                  maxLength={500}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-500 mb-1">Current Location</label>
                <LocationAutocomplete
                  value={form.location}
                  onChange={handleLocationChange}
                  placeholder="e.g., Toronto, Canada"
                />
                {form.location.trim().length >= 2 && (
                  <div className="flex items-center gap-1.5 mt-1.5 px-1">
                    <Clock size={11} className="text-stone-400" />
                    <span className="text-xs text-stone-400">{timezoneLabel}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-500 mb-2">Native Region</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {REGIONS.slice(0, 8).map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setForm({ ...form, native_region: r })}
                      className={`px-2.5 py-1 rounded-xl text-xs font-medium border transition-all ${
                        form.native_region === r
                          ? 'bg-saffron-500 text-white border-saffron-500'
                          : 'bg-white text-stone-600 border-stone-200'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={form.native_region}
                  onChange={e => setForm({ ...form, native_region: e.target.value })}
                  placeholder="Or type your region..."
                  className="input-field text-sm py-2.5"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-500 mb-2">Tamil Proficiency</label>
                <div className="flex gap-2">
                  {DIALECTS.map(d => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setForm({ ...form, primary_dialect: d })}
                      className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all ${
                        form.primary_dialect === d
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
                <label className="block text-xs font-semibold text-stone-500 mb-1">
                  Currency
                  {currencyAutoSet && (
                    <span className="ml-2 text-saffron-500 font-normal">auto-detected</span>
                  )}
                </label>
                <select
                  value={form.preferred_currency}
                  onChange={e => {
                    setCurrencyAutoSet(false);
                    setForm({ ...form, preferred_currency: e.target.value });
                  }}
                  className="input-field text-sm py-2.5 appearance-none"
                >
                  {CURRENCIES.map(c => (
                    <option key={c.code} value={c.code}>
                      {c.symbol} {c.code} — {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-500 mb-1">LinkedIn URL</label>
                <input
                  type="url"
                  value={form.linkedin_url}
                  onChange={e => setForm({ ...form, linkedin_url: e.target.value })}
                  placeholder="https://linkedin.com/in/..."
                  className="input-field text-sm py-2.5"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {profile.bio ? (
                <p className="text-stone-600 text-sm leading-relaxed">{profile.bio}</p>
              ) : (
                <p className="text-stone-400 text-sm italic">No bio added yet</p>
              )}

              <div className="space-y-2 pt-1">
                {profile.native_region && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin size={14} className="text-stone-400" />
                    <span className="text-stone-600">
                      Native Region: <span className="font-medium">{profile.native_region}</span>
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm">
                  <Globe size={14} className="text-stone-400" />
                  <span className="text-stone-600">
                    Tamil: <span className="font-medium">{profile.primary_dialect}</span>
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar size={14} className="text-stone-400" />
                  <span className="text-stone-600">
                    Timezone: <span className="font-medium">{timezoneLabel}</span>
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <DollarSign size={14} className="text-stone-400" />
                  <span className="text-stone-600">
                    Currency: <span className="font-medium">{viewCurrency.symbol} {viewCurrency.code}</span>
                    <span className="text-stone-400 ml-1">· {viewCurrency.name}</span>
                  </span>
                </div>
                {profile.linkedin_url && (
                  <div className="flex items-center gap-2 text-sm">
                    <Linkedin size={14} className="text-stone-400" />
                    <a href={profile.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 font-medium">
                      LinkedIn
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="card overflow-hidden">
          {[
            { label: 'Role', value: profile.role === 'mentor' ? 'Mentor' : 'Mentee', suffix: <Star size={14} className="text-saffron-500" /> },
            { label: 'Member Since', value: new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }), suffix: null },
            { label: 'Email', value: profile.email || 'Not set', suffix: null },
          ].map(({ label, value, suffix }) => (
            <div key={label} className="flex items-center justify-between px-4 py-3 border-b border-stone-50 last:border-0">
              <span className="text-sm text-stone-500">{label}</span>
              <div className="flex items-center gap-1.5">
                {suffix}
                <span className="text-sm font-semibold text-stone-700">{value}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-stone-50">
            <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Settings</p>
          </div>
          {([
            { key: 'notifications' as SettingsView, label: 'Notifications', desc: 'Session reminders and updates' },
            { key: 'privacy' as SettingsView, label: 'Privacy', desc: 'Control your profile visibility' },
            { key: 'terms' as SettingsView, label: 'Terms of Service', desc: 'Read our terms of use' },
            { key: 'privacypolicy' as SettingsView, label: 'Privacy Policy', desc: 'How we handle your data' },
            { key: 'help' as SettingsView, label: 'Help & Support', desc: 'Get assistance or report an issue' },
          ]).map(item => (
            <button
              key={item.label}
              onClick={() => setSettingsView(item.key)}
              className="w-full flex items-center justify-between px-4 py-3 border-b border-stone-50 last:border-0 hover:bg-stone-50 active:bg-stone-100 transition-colors text-left"
            >
              <div>
                <p className="text-sm font-medium text-stone-700">{item.label}</p>
                <p className="text-xs text-stone-400">{item.desc}</p>
              </div>
              <ChevronRight size={16} className="text-stone-300" />
            </button>
          ))}
        </div>

        <button
          onClick={signOut}
          className="w-full flex items-center justify-center gap-2 py-4 text-red-500 font-semibold text-sm border border-red-100 rounded-2xl hover:bg-red-50 active:scale-[0.98] transition-all"
        >
          <LogOut size={16} />
          Sign Out
        </button>

        <div className="text-center pb-4">
          <p className="text-xs text-stone-300">Saanro · v1.0.0</p>
          <p className="text-tamil text-xs text-stone-200 mt-0.5">சாண்றோ</p>
        </div>
      </div>
    </div>
  );
}
