import React, { useEffect, useState } from 'react';
import api from '../lib/api';
import { toast } from 'sonner';
import { Plus, FileText, Trash2, ChevronDown, ChevronUp } from 'lucide-react';

function JDCard({ jd, onDelete }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="phonic-card" data-testid={`jd-card-${jd.id}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="font-semibold" style={{ fontFamily: 'Plus Jakarta Sans' }}>{jd.title}</h3>
          {jd.company && (
            <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>{jd.company}</p>
          )}
          {jd.parsed && (
            <div className="flex flex-wrap gap-2 mt-3">
              {jd.parsed.seniority && (
                <span className="badge" style={{ background: 'var(--color-surface-highlight)', color: 'var(--color-text-secondary)' }}>
                  {jd.parsed.seniority}
                </span>
              )}
              {jd.parsed.required_skills?.slice(0, 4).map(s => (
                <span key={s} className="badge" style={{ background: 'color-mix(in srgb, var(--color-accent-primary) 10%, transparent)', color: 'var(--color-accent-primary)' }}>
                  {s}
                </span>
              ))}
              {(jd.parsed.required_skills?.length || 0) > 4 && (
                <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  +{jd.parsed.required_skills.length - 4} more
                </span>
              )}
            </div>
          )}
          {jd.parsed?.question_domains && (
            <div className="mt-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              {jd.parsed.question_domains.map(d => d.name).join(' · ')}
            </div>
          )}
        </div>
        <div className="flex gap-2 ml-4">
          <button
            onClick={() => setExpanded(!expanded)}
            className="btn-ghost p-2"
            data-testid={`expand-jd-${jd.id}`}
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          <button
            onClick={() => onDelete(jd.id)}
            className="btn-ghost p-2"
            style={{ color: 'var(--color-danger)' }}
            data-testid={`delete-jd-${jd.id}`}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {expanded && jd.raw_text && (
        <div className="mt-4 p-3 rounded-lg text-sm leading-relaxed max-h-48 overflow-y-auto"
          style={{ background: 'var(--color-surface-highlight)', color: 'var(--color-text-secondary)' }}>
          {jd.raw_text.slice(0, 1000)}{jd.raw_text.length > 1000 ? '...' : ''}
        </div>
      )}

      <p className="text-xs mt-3 font-mono" style={{ color: 'var(--color-text-secondary)' }}>
        Added {new Date(jd.created_at).toLocaleDateString()}
      </p>
    </div>
  );
}

export default function JDLibrary() {
  const [jds, setJds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', company: '', raw_text: '' });
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchJDs = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/jd');
      setJds(res.data || []);
    } catch { toast.error('Failed to load JDs'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchJDs(); }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      let parsed = null;
      if (form.raw_text.trim()) {
        setParsing(true);
        const res = await api.post('/api/jd/parse', { text: form.raw_text });
        parsed = res.data;
        setParsing(false);
      }
      await api.post('/api/jd/save', { ...form, parsed });
      toast.success('JD saved!');
      setShowForm(false);
      setForm({ title: '', company: '', raw_text: '' });
      fetchJDs();
    } catch (err) {
      toast.error('Failed to save JD');
    } finally {
      setSaving(false);
      setParsing(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/api/jd/${id}`);
      toast.success('JD deleted');
      setJds(prev => prev.filter(j => j.id !== id));
    } catch { toast.error('Failed to delete'); }
  };

  return (
    <div className="space-y-6 animate-fade-in" data-testid="jd-library-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" style={{ fontFamily: 'Plus Jakarta Sans' }}>JD Library</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            Save and reuse job descriptions for interviews
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn-primary"
          data-testid="add-jd-btn"
        >
          <Plus size={16} />
          Add JD
        </button>
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="phonic-card animate-slide-up" data-testid="jd-form">
          <h3 className="font-semibold mb-4" style={{ fontFamily: 'Plus Jakarta Sans' }}>New Job Description</h3>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                  Job Title *
                </label>
                <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Senior Backend Engineer" className="phonic-input" required
                  data-testid="jd-title-input" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Company</label>
                <input type="text" value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
                  placeholder="Acme Corp" className="phonic-input" data-testid="jd-company-input" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                JD Text *
              </label>
              <textarea value={form.raw_text} onChange={e => setForm(f => ({ ...f, raw_text: e.target.value }))}
                placeholder="Paste the full job description here..." className="phonic-input" rows={6}
                required data-testid="jd-raw-text-input" />
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={saving} className="btn-primary" data-testid="save-jd-btn">
                {parsing ? 'Parsing with AI...' : saving ? 'Saving...' : 'Parse & Save JD'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* JD List */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="flex gap-2">
            {[0,1,2].map(i => (
              <div key={i} className="w-2 h-2 rounded-full bg-accent animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />
            ))}
          </div>
        </div>
      ) : jds.length === 0 ? (
        <div className="phonic-card text-center py-16">
          <FileText size={32} className="mx-auto mb-4" style={{ color: 'var(--color-text-secondary)' }} />
          <p className="font-medium mb-2">No JDs saved yet</p>
          <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
            Save job descriptions to reuse them across multiple interviews
          </p>
          <button onClick={() => setShowForm(true)} className="btn-primary">
            <Plus size={16} />
            Add Your First JD
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {jds.map(jd => (
            <JDCard key={jd.id} jd={jd} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
