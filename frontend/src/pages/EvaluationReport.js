import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../lib/api';
import { toast } from 'sonner';
import { AlertTriangle, Quote, ChevronLeft, RefreshCw, CheckCircle } from 'lucide-react';

function ScoreBar({ label, score, max = 5 }) {
  const pct = (score / max) * 100;
  const color = score >= 4 ? 'var(--color-success)' : score >= 3 ? 'var(--color-warning)' : 'var(--color-danger)';
  return (
    <div data-testid={`score-bar-${label.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="flex justify-between text-sm mb-1.5">
        <span>{label}</span>
        <span className="font-mono font-bold" style={{ color }}>{score}/5</span>
      </div>
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function HireBadge({ band }) {
  const colors = {
    'Strong Yes': 'var(--color-success)',
    'Yes': 'var(--color-success)',
    'Maybe': 'var(--color-warning)',
    'No': 'var(--color-danger)',
    'Strong No': 'var(--color-danger)',
  };
  const color = colors[band] || 'var(--color-text-secondary)';
  return (
    <span className="px-4 py-1.5 rounded-full font-bold text-sm" style={{
      background: `color-mix(in srgb, ${color} 15%, transparent)`,
      color,
    }}>
      {band}
    </span>
  );
}

export default function EvaluationReport() {
  const { sessionId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showTranscript, setShowTranscript] = useState(false);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/evaluations/${sessionId}`);
      setData(res.data);
    } catch (err) {
      toast.error('Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReport(); }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRerun = async () => {
    try {
      await api.post(`/api/evaluations/${sessionId}/run`);
      toast.success('Evaluation restarted');
      setTimeout(fetchReport, 3000);
    } catch (err) {
      toast.error('Failed to rerun evaluation');
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex gap-2">
        {[0,1,2].map(i => (
          <div key={i} className="w-2 h-2 rounded-full bg-accent animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />
        ))}
      </div>
    </div>
  );

  const eval_ = data?.evaluation;

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in" data-testid="evaluation-report-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to={`/dashboard/interviews/${sessionId}`} className="btn-ghost p-2">
            <ChevronLeft size={18} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: 'Plus Jakarta Sans' }}>Evaluation Report</h1>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Session: {sessionId.slice(0, 8)}...</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchReport} className="btn-secondary" data-testid="refresh-report-btn">
            <RefreshCw size={15} />
          </button>
          {data?.status === 'completed' && (
            <button onClick={handleRerun} className="btn-secondary" data-testid="rerun-eval-btn">
              Re-run
            </button>
          )}
        </div>
      </div>

      {!eval_ || eval_.status === 'pending' ? (
        <div className="phonic-card text-center py-16">
          <div className="flex gap-2 justify-center mb-4">
            {[0,1,2].map(i => (
              <div key={i} className="w-2 h-2 rounded-full bg-accent animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />
            ))}
          </div>
          <p className="font-medium mb-2">Evaluation {eval_?.status || 'pending'}</p>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            {eval_?.status === 'processing' ? 'AI is analyzing the interview...' : 'Run evaluation from the interview detail page'}
          </p>
          <button onClick={fetchReport} className="btn-secondary mt-4">Refresh</button>
        </div>
      ) : (
        <>
          {/* Hero Score */}
          <div className="phonic-card text-center py-8" data-testid="overall-score-card">
            <div className="text-6xl font-bold mb-2" style={{ fontFamily: 'Plus Jakarta Sans', color: 'var(--color-accent-primary)' }}>
              {eval_.overall_score}
            </div>
            <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>Overall Score / 5.0</p>
            <HireBadge band={eval_.hire_band} />
            {eval_.summary && (
              <p className="text-sm mt-6 max-w-xl mx-auto leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                {eval_.summary}
              </p>
            )}
          </div>

          {/* Domain Scores */}
          {eval_.domain_scores && Object.keys(eval_.domain_scores).length > 0 && (
            <div className="phonic-card" data-testid="domain-scores">
              <h2 className="font-semibold mb-5" style={{ fontFamily: 'Plus Jakarta Sans' }}>Domain Scores</h2>
              <div className="space-y-4">
                {Object.entries(eval_.domain_scores).map(([domain, score]) => (
                  <ScoreBar key={domain} label={domain} score={score} />
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Strengths */}
            {eval_.strengths?.length > 0 && (
              <div className="phonic-card" data-testid="strengths-card">
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle size={18} style={{ color: 'var(--color-success)' }} />
                  <h2 className="font-semibold" style={{ fontFamily: 'Plus Jakarta Sans' }}>Strengths</h2>
                </div>
                <ul className="space-y-2">
                  {eval_.strengths.map((s, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <span style={{ color: 'var(--color-success)' }}>•</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Red Flags */}
            {eval_.red_flags?.length > 0 && (
              <div className="phonic-card" data-testid="red-flags-card">
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle size={18} style={{ color: 'var(--color-warning)' }} />
                  <h2 className="font-semibold" style={{ fontFamily: 'Plus Jakarta Sans' }}>Red Flags</h2>
                </div>
                <ul className="space-y-2">
                  {eval_.red_flags.map((f, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <span style={{ color: 'var(--color-warning)' }}>•</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Notable Quotes */}
          {eval_.notable_quotes?.length > 0 && (
            <div className="phonic-card" data-testid="notable-quotes">
              <div className="flex items-center gap-2 mb-4">
                <Quote size={18} style={{ color: 'var(--color-accent-secondary)' }} />
                <h2 className="font-semibold" style={{ fontFamily: 'Plus Jakarta Sans' }}>Notable Quotes</h2>
              </div>
              <div className="space-y-3">
                {eval_.notable_quotes.map((q, i) => (
                  <blockquote key={i} className="pl-4 text-sm italic leading-relaxed"
                    style={{ borderLeft: '3px solid var(--color-accent-secondary)', color: 'var(--color-text-secondary)' }}>
                    "{q}"
                  </blockquote>
                ))}
              </div>
            </div>
          )}

          {/* Full Transcript Toggle */}
          {data?.transcript?.length > 0 && (
            <div className="phonic-card">
              <button
                onClick={() => setShowTranscript(!showTranscript)}
                className="w-full flex items-center justify-between font-semibold"
                style={{ fontFamily: 'Plus Jakarta Sans' }}
                data-testid="toggle-transcript-btn"
              >
                <span>Full Transcript ({data.transcript.length} turns)</span>
                <ChevronLeft size={18} className={`transition-transform ${showTranscript ? 'rotate-90' : '-rotate-90'}`} />
              </button>

              {showTranscript && (
                <div className="space-y-3 mt-4" data-testid="full-transcript">
                  {data.transcript.map((t, i) => (
                    <div key={i} className={t.speaker === 'agent' ? 'transcript-agent' : 'transcript-candidate'}>
                      <div className="text-xs font-bold uppercase mb-1" style={{
                        color: t.speaker === 'agent' ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)'
                      }}>
                        {t.speaker === 'agent' ? 'Agent' : 'Candidate'}
                      </div>
                      <p className="text-sm">{t.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
