import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../lib/api';
import { toast } from 'sonner';
import { MonitorWebSocket } from '../lib/ws';
import { Phone, Play, FileText, Activity, RefreshCw, Star } from 'lucide-react';

function StatusBadge({ status }) {
  return <span className={`badge badge-${status?.replace(/_/g, '-')}`}>{status?.replace(/_/g, ' ')}</span>;
}

function WaveformBars({ active }) {
  if (!active) return null;
  return (
    <div className="flex items-end gap-1 h-8">
      {Array(8).fill(0).map((_, i) => (
        <div key={i} className="waveform-bar" style={{ animationDelay: `${i * 0.12}s` }} />
      ))}
    </div>
  );
}

export default function InterviewDetail() {
  const { sessionId } = useParams();
  const [session, setSession] = useState(null);
  const [transcript, setTranscript] = useState([]);
  const [loading, setLoading] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const wsRef = useRef(null);
  const transcriptEndRef = useRef(null);
  const timerRef = useRef(null);

  const fetchSession = async () => {
    try {
      const res = await api.get(`/api/interviews/${sessionId}`);
      setSession(res.data);
      setTranscript(res.data.transcript || []);
    } catch (err) {
      toast.error('Failed to load session');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSession();

    // Connect monitor WebSocket
    const ws = new MonitorWebSocket(sessionId, { // eslint-disable-line react-hooks/exhaustive-deps
      onMessage: (data) => {
        if (data.event === 'session.connected') {
          setTranscript(data.data?.transcript || []);
        } else if (data.event === 'transcript.turn' || data.type === 'transcript_turn' || data.type === 'agent_message') {
          const turn = data.data || data;
          setTranscript(prev => {
            const exists = prev.find(t => t.turn === turn.turn);
            if (exists) return prev;
            return [...prev, {
              turn: turn.turn || prev.length + 1,
              speaker: turn.speaker || (data.type === 'agent_message' ? 'agent' : 'candidate'),
              text: turn.text,
              domain: turn.domain,
              timestamp: turn.timestamp || new Date().toISOString(),
            }];
          });
        } else if (data.event === 'interview.state' || data.type === 'interview.state') {
          fetchSession();
        }
      },
    });
    ws.connect();
    wsRef.current = ws;

    return () => {
      ws.disconnect();
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Timer
  useEffect(() => {
    if (session?.status === 'in_progress' && session?.call_started_at) {
      timerRef.current = setInterval(() => {
        const start = new Date(session.call_started_at).getTime();
        setElapsed(Math.floor((Date.now() - start) / 1000));
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [session?.status, session?.call_started_at]);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  const handleTriggerCall = async () => {
    try {
      await api.post(`/api/interviews/${sessionId}/call`);
      toast.success('Call initiated');
      fetchSession();
    } catch (err) {
      toast.error('Failed to trigger call');
    }
  };

  const handleRunEval = async () => {
    try {
      await api.post(`/api/evaluations/${sessionId}/run`);
      toast.success('Evaluation started — check back in a moment');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to run evaluation');
    }
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
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

  if (!session) return <div>Session not found</div>;

  const isActive = session.status === 'in_progress';
  const isCompleted = session.status === 'completed';
  const totalDuration = (session.config?.total_duration_minutes || 30) * 60;
  const domainProgress = session.state?.current_domain_index || 0;
  const totalDomains = session.job?.jd_parsed?.question_domains?.length || 3;

  return (
    <div className="space-y-6 animate-fade-in" data-testid="interview-detail-page">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold" style={{ fontFamily: 'Plus Jakarta Sans' }}>
              {session.candidate?.name}
            </h1>
            <StatusBadge status={session.status} />
            {isActive && <WaveformBars active />}
          </div>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            {session.job?.title} {session.job?.company && `· ${session.job.company}`} · {session.mode} mode
          </p>
        </div>

        <div className="flex gap-3 flex-wrap">
          <button onClick={fetchSession} className="btn-secondary" data-testid="refresh-detail-btn">
            <RefreshCw size={15} />
          </button>
          {session.mode === 'phone' && session.status === 'scheduled' && (
            <button onClick={handleTriggerCall} className="btn-primary" data-testid="trigger-call-btn">
              <Phone size={15} />
              Trigger Call
            </button>
          )}
          {session.mode === 'browser' && session.status === 'scheduled' && (
            <Link
              to={`/interview/${sessionId}`}
              target="_blank"
              className="btn-primary"
              data-testid="join-browser-btn"
            >
              <Play size={15} />
              Join Browser Interview
            </Link>
          )}
          {isCompleted && !session.evaluation?.overall_score && (
            <button onClick={handleRunEval} className="btn-secondary" data-testid="run-eval-btn">
              <Star size={15} />
              Run Evaluation
            </button>
          )}
          {isCompleted && session.evaluation?.overall_score && (
            <Link to={`/dashboard/interviews/${sessionId}/report`} className="btn-primary" data-testid="view-report-btn">
              <FileText size={15} />
              View Report
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main: Transcript */}
        <div className="lg:col-span-2 phonic-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold" style={{ fontFamily: 'Plus Jakarta Sans' }}>
              Live Transcript
            </h2>
            {isActive && (
              <div className="flex items-center gap-2">
                <div className="live-dot" />
                <span className="text-xs font-semibold" style={{ color: 'var(--color-success)' }}>LIVE</span>
                <span className="font-mono text-sm ml-2" style={{ color: 'var(--color-text-secondary)' }}>
                  {formatTime(elapsed)}
                </span>
              </div>
            )}
          </div>

          <div className="space-y-3 max-h-[480px] overflow-y-auto pr-2" data-testid="transcript-feed">
            {transcript.length === 0 ? (
              <div className="text-center py-16" style={{ color: 'var(--color-text-secondary)' }}>
                <Activity size={24} className="mx-auto mb-3" />
                <p className="text-sm">Transcript will appear here once the interview starts</p>
              </div>
            ) : transcript.map((t, i) => (
              <div key={i} className={t.speaker === 'agent' ? 'transcript-agent' : 'transcript-candidate'} data-testid={`transcript-turn-${i}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold uppercase tracking-wide" style={{
                    color: t.speaker === 'agent' ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)'
                  }}>
                    {t.speaker === 'agent' ? (session.config?.interviewer_name || 'Agent') : session.candidate?.name}
                  </span>
                  {t.domain && (
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{
                      background: 'var(--color-surface-highlight)',
                      color: 'var(--color-text-secondary)'
                    }}>
                      {t.domain}
                    </span>
                  )}
                  <span className="text-xs ml-auto font-mono" style={{ color: 'var(--color-text-secondary)' }}>
                    {t.timestamp ? new Date(t.timestamp).toLocaleTimeString() : ''}
                  </span>
                </div>
                <p className="text-sm leading-relaxed">{t.text}</p>
              </div>
            ))}
            <div ref={transcriptEndRef} />
          </div>
        </div>

        {/* Sidebar: Session Info */}
        <div className="space-y-4">
          {/* Progress */}
          {isActive && (
            <div className="phonic-card" data-testid="interview-progress">
              <h3 className="font-semibold mb-4" style={{ fontFamily: 'Plus Jakarta Sans' }}>Progress</h3>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span style={{ color: 'var(--color-text-secondary)' }}>Time</span>
                    <span className="font-mono">{formatTime(elapsed)} / {formatTime(totalDuration)}</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${Math.min(100, (elapsed / totalDuration) * 100)}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span style={{ color: 'var(--color-text-secondary)' }}>Domains</span>
                    <span>{domainProgress}/{totalDomains}</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${(domainProgress / totalDomains) * 100}%` }} />
                  </div>
                </div>
                <div className="text-sm">
                  <span style={{ color: 'var(--color-text-secondary)' }}>Current: </span>
                  <span className="font-semibold">{session.state?.current_domain_name || '—'}</span>
                </div>
                <div className="text-sm">
                  <span style={{ color: 'var(--color-text-secondary)' }}>Questions: </span>
                  <span className="font-semibold">{session.state?.questions_asked || 0}</span>
                </div>
              </div>
            </div>
          )}

          {/* Session Details */}
          <div className="phonic-card" data-testid="session-details">
            <h3 className="font-semibold mb-4" style={{ fontFamily: 'Plus Jakarta Sans' }}>Session Details</h3>
            <div className="space-y-3 text-sm">
              {[
                ['Candidate', session.candidate?.name],
                ['Email', session.candidate?.email],
                ['Phone', session.candidate?.phone],
                ['Role', session.job?.title],
                ['Company', session.job?.company],
                ['Mode', session.mode],
                ['Accent', session.config?.accent],
                ['LLM', session.config?.llm_provider],
                ['Duration', `${session.config?.total_duration_minutes}m`],
                ['Interviewer', session.config?.interviewer_name],
              ].map(([k, v]) => v ? (
                <div key={k} className="flex justify-between">
                  <span style={{ color: 'var(--color-text-secondary)' }}>{k}</span>
                  <span className="font-medium text-right max-w-[60%] truncate">{v}</span>
                </div>
              ) : null)}
            </div>
          </div>

          {/* Evaluation Preview */}
          {session.evaluation?.overall_score && (
            <div className="phonic-card" data-testid="eval-preview">
              <h3 className="font-semibold mb-3" style={{ fontFamily: 'Plus Jakarta Sans' }}>Evaluation</h3>
              <div className="text-center py-2">
                <div className="text-4xl font-bold mb-1" style={{ fontFamily: 'Plus Jakarta Sans', color: 'var(--color-accent-primary)' }}>
                  {session.evaluation.overall_score}
                </div>
                <div className="text-sm mb-3" style={{ color: 'var(--color-text-secondary)' }}>out of 5</div>
                <span className="badge badge-completed text-sm px-4 py-1">
                  {session.evaluation.hire_band}
                </span>
              </div>
              <Link to={`/dashboard/interviews/${sessionId}/report`} className="btn-primary w-full justify-center mt-4">
                <FileText size={14} />
                Full Report
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
