import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { toast } from 'sonner';
import { Upload, ChevronDown, Mic, Phone, Globe, User, Briefcase, Clock, Bot } from 'lucide-react';

const ACCENTS = [
  { value: 'us', label: 'US English', flag: '🇺🇸' },
  { value: 'uk', label: 'UK English (RP)', flag: '🇬🇧' },
  { value: 'au', label: 'Australian English', flag: '🇦🇺' },
  { value: 'in', label: 'Indian English', flag: '🇮🇳' },
  { value: 'custom', label: 'Custom Voice Clone', flag: '🎙' },
];

const LLM_OPTIONS = [
  { value: 'ollama', label: 'Ollama (Local — Free)', desc: 'Privacy-preserving, no API cost' },
  { value: 'claude', label: 'Claude (Anthropic)', desc: 'Best reasoning, adaptive questions' },
  { value: 'openai', label: 'OpenAI GPT-4o', desc: 'Strong alternative, lower cost' },
];

const DURATION_OPTIONS = [15, 30, 45, 60];

export default function NewInterview() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [jdTemplates, setJdTemplates] = useState([]);
  const [parsingJD, setParsingJD] = useState(false);
  const [parsedJD, setParsedJD] = useState(null);
  const [resumeFile, setResumeFile] = useState(null);

  const [form, setForm] = useState({
    candidate_name: '',
    candidate_email: '',
    candidate_phone: '',
    candidate_country: '',
    job_title: '',
    company: '',
    jd_raw: '',
    jd_template_id: '',
    mode: 'browser',
    accent: 'us',
    interviewer_name: 'Priya',
    total_duration_minutes: 30,
    llm_provider: 'ollama',
    scheduled_at: '',
  });

  useEffect(() => {
    api.get('/api/jd').then(res => setJdTemplates(res.data || [])).catch(() => {});
  }, []);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleParseJD = async () => {
    if (!form.jd_raw.trim()) return;
    setParsingJD(true);
    try {
      const res = await api.post('/api/jd/parse', { text: form.jd_raw });
      setParsedJD(res.data);
      toast.success('JD parsed successfully');
    } catch {
      toast.error('JD parsing failed');
    } finally {
      setParsingJD(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { ...form };
      if (!payload.scheduled_at) delete payload.scheduled_at;

      const res = await api.post('/api/interviews', payload);
      const sessionId = res.data.session_id;

      // Upload resume if provided
      if (resumeFile) {
        const formData = new FormData();
        formData.append('file', resumeFile);
        try {
          await api.post('/api/resume/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
        } catch {
          toast.warning('Resume upload failed, continuing...');
        }
      }

      toast.success('Interview scheduled!');
      navigate(`/dashboard/interviews/${sessionId}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to schedule interview');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-fade-in" data-testid="new-interview-page">
      <div>
        <h1 className="text-3xl font-bold" style={{ fontFamily: 'Plus Jakarta Sans' }}>Schedule Interview</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
          Set up an AI-powered voice interview for your candidate
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Candidate Info */}
        <div className="phonic-card space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <User size={16} style={{ color: 'var(--color-accent-primary)' }} />
            <h3 className="font-semibold" style={{ fontFamily: 'Plus Jakarta Sans' }}>Candidate</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                Full Name *
              </label>
              <input type="text" value={form.candidate_name} onChange={e => set('candidate_name', e.target.value)}
                placeholder="Jane Smith" className="phonic-input" required data-testid="candidate-name-input" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                Email *
              </label>
              <input type="email" value={form.candidate_email} onChange={e => set('candidate_email', e.target.value)}
                placeholder="jane@example.com" className="phonic-input" required data-testid="candidate-email-input" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                Phone (E.164) *
              </label>
              <input type="text" value={form.candidate_phone} onChange={e => set('candidate_phone', e.target.value)}
                placeholder="+14155552671" className="phonic-input" required data-testid="candidate-phone-input" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                Country
              </label>
              <input type="text" value={form.candidate_country} onChange={e => set('candidate_country', e.target.value)}
                placeholder="US / IN / UK" className="phonic-input" data-testid="candidate-country-input" />
            </div>
          </div>

          {/* Resume Upload */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
              Resume (PDF / DOCX)
            </label>
            <label
              className="flex items-center gap-3 p-3 border-2 border-dashed rounded-lg cursor-pointer transition-colors"
              style={{ borderColor: resumeFile ? 'var(--color-success)' : 'var(--color-border)', background: 'var(--color-surface-highlight)' }}
              data-testid="resume-upload-label"
            >
              <Upload size={16} style={{ color: resumeFile ? 'var(--color-success)' : 'var(--color-text-secondary)' }} />
              <span className="text-sm" style={{ color: resumeFile ? 'var(--color-success)' : 'var(--color-text-secondary)' }}>
                {resumeFile ? resumeFile.name : 'Click to upload resume'}
              </span>
              <input type="file" accept=".pdf,.docx,.doc,.txt" className="hidden"
                onChange={e => setResumeFile(e.target.files[0])}
                data-testid="resume-file-input" />
            </label>
          </div>
        </div>

        {/* Job Description */}
        <div className="phonic-card space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Briefcase size={16} style={{ color: 'var(--color-accent-secondary)' }} />
            <h3 className="font-semibold" style={{ fontFamily: 'Plus Jakarta Sans' }}>Job Description</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Job Title *</label>
              <input type="text" value={form.job_title} onChange={e => set('job_title', e.target.value)}
                placeholder="Senior Backend Engineer" className="phonic-input" required data-testid="job-title-input" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Company</label>
              <input type="text" value={form.company} onChange={e => set('company', e.target.value)}
                placeholder="Acme Corp" className="phonic-input" data-testid="company-input" />
            </div>
          </div>

          {jdTemplates.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                Use Saved JD Template
              </label>
              <select value={form.jd_template_id} onChange={e => set('jd_template_id', e.target.value)}
                className="phonic-input" data-testid="jd-template-select">
                <option value="">— Select template —</option>
                {jdTemplates.map(t => (
                  <option key={t.id} value={t.id}>{t.title} {t.company ? `@ ${t.company}` : ''}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
              Paste JD Text (optional — used for adaptive questioning)
            </label>
            <textarea
              value={form.jd_raw}
              onChange={e => set('jd_raw', e.target.value)}
              placeholder="Paste the full job description here..."
              className="phonic-input"
              rows={5}
              data-testid="jd-text-input"
            />
            {form.jd_raw.trim() && (
              <button type="button" onClick={handleParseJD} disabled={parsingJD}
                className="btn-secondary mt-2 text-sm" data-testid="parse-jd-btn">
                {parsingJD ? 'Parsing...' : 'Parse JD with AI'}
              </button>
            )}
            {parsedJD && (
              <div className="mt-3 p-3 rounded-lg text-sm" style={{ background: 'var(--color-surface-highlight)' }}>
                <span className="font-semibold" style={{ color: 'var(--color-success)' }}>Parsed: </span>
                {parsedJD.role} ({parsedJD.seniority}) · {parsedJD.question_domains?.length} domains ·&nbsp;
                {parsedJD.required_skills?.slice(0,4).join(', ')}
              </div>
            )}
          </div>
        </div>

        {/* Interview Config */}
        <div className="phonic-card space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Mic size={16} style={{ color: 'var(--color-warning)' }} />
            <h3 className="font-semibold" style={{ fontFamily: 'Plus Jakarta Sans' }}>Interview Config</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Mode</label>
              <div className="flex gap-2">
                {['browser', 'phone'].map(m => (
                  <button key={m} type="button"
                    onClick={() => set('mode', m)}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold border transition-colors ${form.mode === m ? 'border-transparent' : ''}`}
                    style={{
                      background: form.mode === m ? 'var(--color-accent-primary)' : 'var(--color-surface-highlight)',
                      color: form.mode === m ? 'white' : 'var(--color-text-secondary)',
                      border: form.mode === m ? 'none' : '1px solid var(--color-border)',
                    }}
                    data-testid={`mode-${m}-btn`}
                  >
                    {m === 'browser' ? <><Globe size={14} className="inline mr-1" />Browser</> : <><Phone size={14} className="inline mr-1" />Phone</>}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Duration</label>
              <div className="flex gap-2">
                {DURATION_OPTIONS.map(d => (
                  <button key={d} type="button" onClick={() => set('total_duration_minutes', d)}
                    className="flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors"
                    style={{
                      background: form.total_duration_minutes === d ? 'var(--color-accent-primary)' : 'var(--color-surface-highlight)',
                      color: form.total_duration_minutes === d ? 'white' : 'var(--color-text-secondary)',
                      border: form.total_duration_minutes === d ? 'none' : '1px solid var(--color-border)',
                    }}
                    data-testid={`duration-${d}-btn`}
                  >{d}m</button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Accent / Voice</label>
              <select value={form.accent} onChange={e => set('accent', e.target.value)}
                className="phonic-input" data-testid="accent-select">
                {ACCENTS.map(a => (
                  <option key={a.value} value={a.value}>{a.flag} {a.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Interviewer Name</label>
              <input type="text" value={form.interviewer_name} onChange={e => set('interviewer_name', e.target.value)}
                placeholder="Priya" className="phonic-input" data-testid="interviewer-name-input" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>LLM Provider</label>
            <div className="space-y-2">
              {LLM_OPTIONS.map(opt => (
                <label key={opt.value}
                  className="flex items-center gap-3 p-3 rounded-lg cursor-pointer border transition-colors"
                  style={{
                    borderColor: form.llm_provider === opt.value ? 'var(--color-accent-primary)' : 'var(--color-border)',
                    background: form.llm_provider === opt.value ? 'color-mix(in srgb, var(--color-accent-primary) 8%, transparent)' : 'var(--color-surface-highlight)',
                  }}
                  data-testid={`llm-option-${opt.value}`}
                >
                  <input type="radio" name="llm_provider" value={opt.value}
                    checked={form.llm_provider === opt.value}
                    onChange={() => set('llm_provider', opt.value)}
                    className="accent-blue-500" />
                  <div>
                    <div className="font-semibold text-sm">{opt.label}</div>
                    <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
              <Clock size={14} className="inline mr-1" />
              Scheduled Time (optional)
            </label>
            <input type="datetime-local" value={form.scheduled_at} onChange={e => set('scheduled_at', e.target.value)}
              className="phonic-input" data-testid="scheduled-at-input" />
          </div>
        </div>

        <button type="submit" className="btn-primary w-full justify-center py-3 text-base"
          disabled={loading} data-testid="submit-interview-btn">
          {loading ? 'Scheduling...' : 'Schedule Interview'}
        </button>
      </form>
    </div>
  );
}
