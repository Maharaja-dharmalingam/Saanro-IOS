import { useState, useEffect } from 'react';
import { Plus, Trash2, ExternalLink, Tag, Link as LinkIcon, Search, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Resource } from '../../lib/types';

interface ResourceLibraryProps {
  mentorId: string;
}

const CATEGORIES = ['General', 'Career', 'Technical', 'Interviews', 'Culture', 'Finance', 'Networking', 'Other'];

const EMPTY_FORM = { title: '', description: '', url: '', category: 'General', resource_type: 'link' as const };

export default function ResourceLibrary({ mentorId }: ResourceLibraryProps) {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('All');

  useEffect(() => { loadResources(); }, [mentorId]);

  async function loadResources() {
    setLoading(true);
    const { data } = await supabase
      .from('resources')
      .select('*')
      .eq('mentor_id', mentorId)
      .order('created_at', { ascending: false });
    if (data) setResources(data as Resource[]);
    setLoading(false);
  }

  async function saveResource() {
    if (!form.title.trim()) { setFormError('Title is required'); return; }
    if (!form.url.trim()) { setFormError('URL or link is required'); return; }
    setFormError('');
    setSaving(true);
    await supabase.from('resources').insert({ mentor_id: mentorId, ...form });
    setForm({ ...EMPTY_FORM });
    setShowAdd(false);
    setSaving(false);
    loadResources();
  }

  async function deleteResource(id: string) {
    await supabase.from('resources').delete().eq('id', id);
    setResources(prev => prev.filter(r => r.id !== id));
  }

  const filtered = resources.filter(r => {
    const matchCat = filterCat === 'All' || r.category === filterCat;
    const matchSearch = !search || r.title.toLowerCase().includes(search.toLowerCase()) || r.description.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const usedCategories = ['All', ...Array.from(new Set(resources.map(r => r.category)))];

  return (
    <div className="space-y-4 pb-8">
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search resources..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input-field text-sm pl-9 py-2.5"
          />
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-800 text-white text-sm font-semibold rounded-xl hover:bg-slate-700 transition-colors"
        >
          <Plus size={15} /> Add
        </button>
      </div>

      {showAdd && (
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-4">Add Resource</p>
          <div className="space-y-3">
            <input
              type="text"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              placeholder="Resource title"
              className="input-field text-sm"
            />
            <textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Brief description (optional)"
              rows={2}
              className="input-field text-sm resize-none"
            />
            <div className="relative">
              <LinkIcon size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="url"
                value={form.url}
                onChange={e => setForm({ ...form, url: e.target.value })}
                placeholder="https://..."
                className="input-field text-sm pl-8"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Category</label>
                <select
                  value={form.category}
                  onChange={e => setForm({ ...form, category: e.target.value })}
                  className="input-field text-sm"
                >
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Type</label>
                <select
                  value={form.resource_type}
                  onChange={e => setForm({ ...form, resource_type: e.target.value as 'link' | 'file' })}
                  className="input-field text-sm"
                >
                  <option value="link">Link</option>
                  <option value="file">File</option>
                </select>
              </div>
            </div>
            {formError && <p className="text-red-500 text-xs">{formError}</p>}
            <div className="flex gap-2">
              <button
                onClick={saveResource}
                disabled={saving}
                className="flex-1 py-2.5 bg-slate-800 text-white text-sm font-semibold rounded-xl hover:bg-slate-700 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Resource'}
              </button>
              <button
                onClick={() => { setShowAdd(false); setForm({ ...EMPTY_FORM }); setFormError(''); }}
                className="px-4 py-2.5 border border-slate-200 text-slate-600 text-sm font-semibold rounded-xl hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {usedCategories.map(cat => (
          <button
            key={cat}
            onClick={() => setFilterCat(cat)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              filterCat === cat
                ? 'bg-slate-800 text-white'
                : 'bg-white border border-slate-200 text-slate-500 hover:border-slate-400'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="bg-white rounded-2xl border border-slate-100 p-4 h-20 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 px-5 py-12 text-center">
          <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <LinkIcon size={20} className="text-slate-300" />
          </div>
          <p className="text-slate-500 font-medium text-sm">
            {search || filterCat !== 'All' ? 'No matching resources' : 'No resources yet'}
          </p>
          <p className="text-slate-400 text-xs mt-1">
            {search || filterCat !== 'All' ? 'Try adjusting your search or filter.' : 'Add links and files to share with mentees.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(r => (
            <div
              key={r.id}
              className="bg-white rounded-2xl border border-slate-100 px-5 py-4 flex items-start gap-3 hover:border-slate-200 transition-colors"
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
                r.resource_type === 'link' ? 'bg-blue-50' : 'bg-amber-50'
              }`}>
                <LinkIcon size={15} className={r.resource_type === 'link' ? 'text-blue-500' : 'text-amber-500'} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-800 text-sm truncate">{r.title}</p>
                {r.description && <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{r.description}</p>}
                <div className="flex items-center gap-2 mt-1.5">
                  <div className="flex items-center gap-1">
                    <Tag size={10} className="text-slate-300" />
                    <span className="text-[11px] text-slate-400">{r.category}</span>
                  </div>
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-0.5 text-[11px] text-blue-500 hover:text-blue-600 font-medium"
                  >
                    Open <ExternalLink size={10} />
                  </a>
                </div>
              </div>
              <button
                onClick={() => deleteResource(r.id)}
                className="text-slate-300 hover:text-red-400 transition-colors mt-0.5 flex-shrink-0"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
