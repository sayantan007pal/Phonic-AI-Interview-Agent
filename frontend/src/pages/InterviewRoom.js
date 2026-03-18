import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import api from '../lib/api';
import { VoiceWebSocket } from '../lib/ws';
import { useTheme } from '../contexts/ThemeContext';
import { Mic, MicOff, PhoneOff, Send, Volume2, VolumeX } from 'lucide-react';

function WaveformBars({ active, size = 'md' }) {
  const h = size === 'lg' ? 48 : 32;
  if (!active) return (
    <div className="flex items-center justify-center" style={{ height: h }}>
      <div className="flex items-end gap-1">
        {Array(8).fill(0).map((_, i) => (
          <div key={i} style={{ width: 4, height: 8, borderRadius: 2, background: 'var(--color-border)' }} />
        ))}
      </div>
    </div>
  );
  return (
    <div className="flex items-end gap-1 justify-center" style={{ height: h }}>
      {Array(8).fill(0).map((_, i) => (
        <div key={i} className="waveform-bar" style={{ animationDelay: `${i * 0.12}s` }} />
      ))}
    </div>
  );
}

export default function InterviewRoom() {
  const { token: sessionId } = useParams();
  const { theme } = useTheme();
  const [session, setSession] = useState(null);
  const [transcript, setTranscript] = useState([]);
  const [status, setStatus] = useState('loading');
  const [connected, setConnected] = useState(false);
  const [recording, setRecording] = useState(false);
  const [agentSpeaking, setAgentSpeaking] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [muted, setMuted] = useState(false);
  const [useVoice, setUseVoice] = useState(true);
  const wsRef = useRef(null);
  const transcriptEndRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioCtxRef = useRef(null);
  const audioQueueRef = useRef([]);
  const playingRef = useRef(false);

  useEffect(() => {
    api.get(`/api/interviews/${sessionId}`)
      .then(res => {
        setSession(res.data);
        setStatus('ready');
      })
      .catch(() => setStatus('error'));
  }, [sessionId]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  const connect = () => {
    const ws = new VoiceWebSocket(sessionId, {
      onOpen: () => {
        setConnected(true);
        setStatus('connected');
      },
      onClose: () => {
        setConnected(false);
        setStatus('ended');
      },
      onError: () => setStatus('error'),
      onMessage: handleMessage,
    });
    ws.connect();
    wsRef.current = ws;
  };

  const handleMessage = (data) => {
    if (data.type === 'agent_message') {
      setAgentSpeaking(true);
      setTranscript(prev => [...prev, {
        speaker: 'agent',
        text: data.text,
        turn: data.turn || prev.length + 1,
        domain: data.domain,
        timestamp: new Date().toISOString(),
      }]);
      setTimeout(() => setAgentSpeaking(false), 2000);
    } else if (data.type === 'transcript_turn') {
      setTranscript(prev => {
        const exists = prev.find(t => t.turn === data.turn);
        if (exists) return prev;
        return [...prev, {
          speaker: data.speaker,
          text: data.text,
          turn: data.turn || prev.length + 1,
          domain: data.domain,
          timestamp: data.timestamp || new Date().toISOString(),
        }];
      });
    } else if (data.type === 'interview_ended') {
      setStatus('ended');
      setConnected(false);
    } else if (data.type === 'error') {
      setStatus('error');
    }
  };

  const disconnect = () => {
    wsRef.current?.endInterview();
    wsRef.current?.disconnect();
    stopRecording();
    setConnected(false);
    setStatus('ended');
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        // In real voice mode, audio would be sent to deepgram via pipecat
        // For now, just show visual feedback
      };

      mediaRecorder.start(200);
      setRecording(true);
    } catch (err) {
      console.error('Microphone error:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state !== 'inactive') {
      mediaRecorderRef.current?.stop();
    }
    setRecording(false);
  };

  const handleSendText = () => {
    if (!textInput.trim() || !connected) return;
    wsRef.current?.sendText(textInput);
    setTranscript(prev => [...prev, {
      speaker: 'candidate',
      text: textInput,
      turn: prev.length + 1,
      timestamp: new Date().toISOString(),
    }]);
    setTextInput('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  };

  const agentName = session?.config?.interviewer_name || 'Priya';
  const candidateName = session?.candidate?.name || 'Candidate';
  const accent = session?.config?.accent || 'us';

  const accentFlag = { us: '🇺🇸', uk: '🇬🇧', au: '🇦🇺', in: '🇮🇳', custom: '🎙' }[accent] || '🎙';

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'var(--color-background)' }}
      data-testid="interview-room-page"
    >
      {/* Header */}
      <header style={{ background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}
        className="px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
            <Mic size={16} color="white" />
          </div>
          <div>
            <h1 className="font-bold text-lg" style={{ fontFamily: 'Plus Jakarta Sans' }}>Phonic Interview</h1>
            {session && (
              <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                {session.job?.title} · {accentFlag} {accent.toUpperCase()}
              </p>
            )}
          </div>
        </div>
        {connected && (
          <div className="flex items-center gap-2">
            <div className="live-dot" />
            <span className="text-xs font-semibold" style={{ color: 'var(--color-success)' }}>LIVE</span>
          </div>
        )}
      </header>

      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Center: Voice Interface */}
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          {status === 'loading' && (
            <div className="text-center">
              <div className="flex gap-2 justify-center mb-4">
                {[0,1,2].map(i => (
                  <div key={i} className="w-2 h-2 rounded-full bg-accent animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />
                ))}
              </div>
              <p style={{ color: 'var(--color-text-secondary)' }}>Loading interview...</p>
            </div>
          )}

          {status === 'ready' && (
            <div className="text-center max-w-md">
              <div className="w-20 h-20 rounded-full bg-accent mx-auto mb-6 flex items-center justify-center">
                <Mic size={32} color="white" />
              </div>
              <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                Ready to start?
              </h2>
              <p className="text-sm mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                Hi {candidateName}! You'll be interviewed by {agentName} for the {session?.job?.title} role.
              </p>
              <p className="text-sm mb-8" style={{ color: 'var(--color-text-secondary)' }}>
                Duration: {session?.config?.total_duration_minutes || 30} minutes
              </p>

              <div className="flex flex-col gap-3">
                <button onClick={() => { connect(); setUseVoice(false); }}
                  className="btn-primary justify-center"
                  data-testid="start-text-interview-btn">
                  Start Interview (Text Mode)
                </button>
                <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  Voice mode requires Deepgram & Cartesia API keys configured in Settings
                </p>
              </div>
            </div>
          )}

          {(status === 'connected' || status === 'ended') && (
            <div className="w-full max-w-lg">
              {/* Agent Avatar */}
              <div className="text-center mb-8">
                <div className={`w-24 h-24 rounded-full mx-auto mb-4 flex items-center justify-center transition-all duration-300 ${agentSpeaking ? 'ring-4 ring-offset-2' : ''}`}
                  style={{
                    background: 'var(--color-accent-primary)',
                    ringColor: agentSpeaking ? 'var(--color-accent-primary)' : 'transparent',
                    ringOffsetColor: 'var(--color-background)',
                    boxShadow: agentSpeaking ? `0 0 0 4px color-mix(in srgb, var(--color-accent-primary) 30%, transparent)` : 'none',
                  }}
                >
                  <span className="text-white font-bold text-2xl" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                    {agentName[0]}
                  </span>
                </div>
                <p className="font-semibold">{agentName}</p>
                <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  {agentSpeaking ? 'Speaking...' : 'Listening...'}
                </p>
                <WaveformBars active={agentSpeaking} size="md" />
              </div>

              {/* Controls */}
              {status === 'connected' && (
                <div className="flex items-center justify-center gap-4">
                  <button
                    onClick={recording ? stopRecording : startRecording}
                    className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${recording ? 'scale-110' : ''}`}
                    style={{
                      background: recording ? 'var(--color-danger)' : 'var(--color-surface-highlight)',
                      border: `2px solid ${recording ? 'var(--color-danger)' : 'var(--color-border)'}`,
                    }}
                    data-testid="mic-toggle-btn"
                  >
                    {recording ? <MicOff size={22} style={{ color: 'white' }} /> : <Mic size={22} style={{ color: 'var(--color-text-primary)' }} />}
                  </button>

                  <button
                    onClick={disconnect}
                    className="w-14 h-14 rounded-full flex items-center justify-center"
                    style={{ background: 'var(--color-danger)' }}
                    data-testid="end-call-btn"
                  >
                    <PhoneOff size={22} color="white" />
                  </button>

                  <button
                    onClick={() => setMuted(!muted)}
                    className="w-14 h-14 rounded-full flex items-center justify-center"
                    style={{ background: 'var(--color-surface-highlight)', border: '2px solid var(--color-border)' }}
                    data-testid="mute-toggle-btn"
                  >
                    {muted ? <VolumeX size={22} /> : <Volume2 size={22} />}
                  </button>
                </div>
              )}

              {status === 'ended' && (
                <div className="text-center">
                  <p className="font-semibold mb-2">Interview Complete</p>
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    Thank you for your time. The recruiter will be in touch soon.
                  </p>
                </div>
              )}
            </div>
          )}

          {status === 'error' && (
            <div className="text-center">
              <p className="font-semibold mb-2" style={{ color: 'var(--color-danger)' }}>Connection Error</p>
              <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>Unable to connect to interview server</p>
              <button onClick={() => { connect(); setStatus('connected'); }} className="btn-primary">
                Retry
              </button>
            </div>
          )}
        </div>

        {/* Right: Transcript + Text Input */}
        {(status === 'connected' || status === 'ended') && (
          <div className="w-full lg:w-96 flex flex-col"
            style={{ borderLeft: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
            <div className="p-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
              <h3 className="font-semibold text-sm" style={{ fontFamily: 'Plus Jakarta Sans' }}>Conversation</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3" data-testid="room-transcript">
              {transcript.length === 0 && (
                <p className="text-sm text-center pt-8" style={{ color: 'var(--color-text-secondary)' }}>
                  Conversation will appear here...
                </p>
              )}
              {transcript.map((t, i) => (
                <div key={i} className={t.speaker === 'agent' ? 'transcript-agent' : 'transcript-candidate'}>
                  <div className="text-xs font-bold mb-1" style={{ color: t.speaker === 'agent' ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)' }}>
                    {t.speaker === 'agent' ? agentName : 'You'}
                  </div>
                  <p className="text-sm">{t.text}</p>
                </div>
              ))}
              <div ref={transcriptEndRef} />
            </div>

            {/* Text input */}
            {status === 'connected' && (
              <div className="p-4" style={{ borderTop: '1px solid var(--color-border)' }}>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={textInput}
                    onChange={e => setTextInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type your response..."
                    className="phonic-input flex-1 text-sm"
                    data-testid="text-response-input"
                  />
                  <button
                    onClick={handleSendText}
                    disabled={!textInput.trim()}
                    className="btn-primary px-3"
                    data-testid="send-response-btn"
                  >
                    <Send size={16} />
                  </button>
                </div>
                <p className="text-xs mt-2" style={{ color: 'var(--color-text-secondary)' }}>
                  Press Enter to send · Voice requires configured API keys
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
