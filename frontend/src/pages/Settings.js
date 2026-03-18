import React, { useEffect, useState } from 'react';
import api from '../lib/api';
import { toast } from 'sonner';
import { Eye, EyeOff, Save, CheckCircle, XCircle, Loader, ChevronDown, ChevronUp } from 'lucide-react';

function MaskedInput({ label, value, onChange, placeholder, hint, testId, type = 'password' }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
        {label}
        {hint && <span className="text-xs ml-2 font-mono" style={{ color: 'var(--color-text-secondary)', opacity: 0.7 }}>{hint}</span>}
      </label>
      <div className="relative">
        <input
          type={show ? 'text' : type === 'password' ? 'password' : 'text'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder || (type === 'password' ? '••••••••••••••••' : 'Enter value')}
          className="phonic-input phonic-input-api pr-10"
          data-testid={testId}
        />
        {type === 'password' && (
          <button
            type="button"
            onClick={() => setShow(!show)}
            className="absolute right-3 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {show ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        )}
      </div>
    </div>
  );
}

function Section({ title, icon, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="phonic-card">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between"
        data-testid={`settings-section-${title.toLowerCase().replace(/\s+/g, '-')}`}
      >
        <div className="flex items-center gap-2">
          <span className="text-base">{icon}</span>
          <h3 className="font-semibold" style={{ fontFamily: 'Plus Jakarta Sans' }}>{title}</h3>
        </div>
        {open ? <ChevronUp size={16} style={{ color: 'var(--color-text-secondary)' }} /> : <ChevronDown size={16} style={{ color: 'var(--color-text-secondary)' }} />}
      </button>
      {open && <div className="mt-5 space-y-4">{children}</div>}
    </div>
  );
}

export default function Settings() {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState({});

  useEffect(() => {
    api.get('/api/settings')
      .then(res => setSettings(res.data || {}))
      .catch(() => toast.error('Failed to load settings'))
      .finally(() => setLoading(false));
  }, []);

  const set = (key, val) => setSettings(s => ({ ...s, [key]: val }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch('/api/settings', settings);
      toast.success('Settings saved!');
    } catch (err) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (type) => {
    setTesting(t => ({ ...t, [type]: 'loading' }));
    try {
      const res = await api.post(`/api/settings/test-${type}`);
      setTesting(t => ({ ...t, [type]: res.data.status === 'ok' ? 'ok' : 'error' }));
      if (res.data.status === 'ok') toast.success(`${type} connection OK: ${res.data.response || ''}`);
      else toast.error(`${type} test failed: ${res.data.error}`);
    } catch (err) {
      setTesting(t => ({ ...t, [type]: 'error' }));
      toast.error(`${type} test failed`);
    }
  };

  const TestBtn = ({ type }) => {
    const state = testing[type];
    return (
      <button type="button" onClick={() => handleTest(type)} className="btn-secondary text-sm py-1.5" data-testid={`test-${type}-btn`}>
        {state === 'loading' ? <Loader size={14} className="animate-spin" /> :
          state === 'ok' ? <CheckCircle size={14} style={{ color: 'var(--color-success)' }} /> :
            state === 'error' ? <XCircle size={14} style={{ color: 'var(--color-danger)' }} /> :
              null}
        Test
      </button>
    );
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

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in" data-testid="settings-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" style={{ fontFamily: 'Plus Jakarta Sans' }}>Settings</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            Configure API keys and integrations
          </p>
        </div>
        <button onClick={handleSave} disabled={saving} className="btn-primary" data-testid="save-settings-btn">
          <Save size={16} />
          {saving ? 'Saving...' : 'Save All'}
        </button>
      </div>

      {/* LLM */}
      <Section title="LLM Provider" icon="🤖" defaultOpen>
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>Provider</label>
          <div className="flex gap-2">
            {['ollama', 'claude', 'openai'].map(p => (
              <button key={p} type="button" onClick={() => set('llm_provider', p)}
                className="flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors"
                style={{
                  background: settings.llm_provider === p ? 'var(--color-accent-primary)' : 'var(--color-surface-highlight)',
                  color: settings.llm_provider === p ? 'white' : 'var(--color-text-secondary)',
                  border: settings.llm_provider === p ? 'none' : '1px solid var(--color-border)',
                }}
                data-testid={`llm-provider-${p}`}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {settings.llm_provider === 'claude' && (
          <MaskedInput label="Anthropic API Key" value={settings.anthropic_api_key || ''} onChange={v => set('anthropic_api_key', v)}
            hint="console.anthropic.com" testId="anthropic-api-key-input" />
        )}
        {settings.llm_provider === 'openai' && (
          <>
            <MaskedInput label="OpenAI API Key" value={settings.openai_api_key || ''} onChange={v => set('openai_api_key', v)}
              hint="platform.openai.com" testId="openai-api-key-input" />
            <MaskedInput label="Model" value={settings.openai_model || 'gpt-4o'} onChange={v => set('openai_model', v)}
              type="text" placeholder="gpt-4o" testId="openai-model-input" />
          </>
        )}
        {settings.llm_provider === 'ollama' && (
          <>
            <MaskedInput label="Ollama Base URL" value={settings.ollama_base_url || 'http://localhost:11434'} onChange={v => set('ollama_base_url', v)}
              type="text" placeholder="http://localhost:11434" testId="ollama-url-input" />
            <MaskedInput label="Ollama Model" value={settings.ollama_model || 'llama3'} onChange={v => set('ollama_model', v)}
              type="text" placeholder="llama3" testId="ollama-model-input" />
          </>
        )}
        <div className="flex justify-end">
          <TestBtn type="llm" />
        </div>
      </Section>

      {/* STT */}
      <Section title="Speech-to-Text (Deepgram)" icon="🎙">
        <MaskedInput label="Deepgram API Key" value={settings.deepgram_api_key || ''} onChange={v => set('deepgram_api_key', v)}
          hint="console.deepgram.com" testId="deepgram-api-key-input" />
        <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          Uses Nova-2 model. Powers real-time voice transcription during interviews.
        </p>
      </Section>

      {/* TTS */}
      <Section title="Text-to-Speech (Cartesia)" icon="🔊">
        <MaskedInput label="Cartesia API Key" value={settings.cartesia_api_key || ''} onChange={v => set('cartesia_api_key', v)}
          hint="play.cartesia.ai" testId="cartesia-api-key-input" />
        <MaskedInput label="Custom Voice Clone ID (optional)" value={settings.cartesia_custom_voice_id || ''} onChange={v => set('cartesia_custom_voice_id', v)}
          type="text" placeholder="your-cloned-voice-id" testId="cartesia-voice-id-input" />
        <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          Sonic-English model. Supports US, UK, AU, IN accents.
        </p>
      </Section>

      {/* Telnyx */}
      <Section title="Telephony — Global (Telnyx)" icon="📞">
        <div className="p-3 rounded-lg text-sm" style={{ background: 'color-mix(in srgb, var(--color-warning) 10%, transparent)', color: 'var(--color-warning)' }}>
          Required for outbound phone calls outside India. Get keys at portal.telnyx.com
        </div>
        <MaskedInput label="Telnyx API Key" value={settings.telnyx_api_key || ''} onChange={v => set('telnyx_api_key', v)}
          testId="telnyx-api-key-input" />
        <MaskedInput label="Telnyx Public Key" value={settings.telnyx_public_key || ''} onChange={v => set('telnyx_public_key', v)}
          testId="telnyx-public-key-input" />
        <div className="grid grid-cols-2 gap-3">
          {[['US', 'telnyx_did_us'], ['UK', 'telnyx_did_uk'], ['AU', 'telnyx_did_au'], ['CA', 'telnyx_did_ca'],
            ['UAE', 'telnyx_did_uae'], ['EU', 'telnyx_did_eu'], ['SG', 'telnyx_did_sg']].map(([label, key]) => (
            <MaskedInput key={key} label={`DID Number (${label})`} value={settings[key] || ''} onChange={v => set(key, v)}
              type="text" placeholder={`+1...`} testId={`${key}-input`} />
          ))}
        </div>
      </Section>

      {/* India Telephony */}
      <Section title="Telephony — India (Exotel / Ozonetel)" icon="🇮🇳">
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>Provider</label>
          <div className="flex gap-2">
            {['exotel', 'ozonetel'].map(p => (
              <button key={p} type="button" onClick={() => set('india_telephony_provider', p)}
                className="flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors"
                style={{
                  background: settings.india_telephony_provider === p ? 'var(--color-accent-primary)' : 'var(--color-surface-highlight)',
                  color: settings.india_telephony_provider === p ? 'white' : 'var(--color-text-secondary)',
                  border: settings.india_telephony_provider === p ? 'none' : '1px solid var(--color-border)',
                }}
                data-testid={`india-provider-${p}`}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>
        {settings.india_telephony_provider !== 'ozonetel' ? (
          <>
            <MaskedInput label="Exotel API Key" value={settings.exotel_api_key || ''} onChange={v => set('exotel_api_key', v)} testId="exotel-api-key-input" />
            <MaskedInput label="Exotel API Token" value={settings.exotel_api_token || ''} onChange={v => set('exotel_api_token', v)} testId="exotel-api-token-input" />
            <MaskedInput label="Exotel SID" value={settings.exotel_sid || ''} onChange={v => set('exotel_sid', v)} type="text" testId="exotel-sid-input" />
            <MaskedInput label="Exotel Virtual Number" value={settings.exotel_virtual_number || ''} onChange={v => set('exotel_virtual_number', v)} type="text" placeholder="+91..." testId="exotel-number-input" />
          </>
        ) : (
          <>
            <MaskedInput label="Ozonetel API Key" value={settings.ozonetel_api_key || ''} onChange={v => set('ozonetel_api_key', v)} testId="ozonetel-api-key-input" />
            <MaskedInput label="Ozonetel DID" value={settings.ozonetel_did || ''} onChange={v => set('ozonetel_did', v)} type="text" placeholder="+91..." testId="ozonetel-did-input" />
          </>
        )}
      </Section>

      {/* LiveKit */}
      <Section title="LiveKit (WebRTC)" icon="🔴">
        <MaskedInput label="LiveKit URL" value={settings.livekit_url || 'ws://localhost:7880'} onChange={v => set('livekit_url', v)} type="text" testId="livekit-url-input" />
        <MaskedInput label="LiveKit API Key" value={settings.livekit_api_key || ''} onChange={v => set('livekit_api_key', v)} testId="livekit-api-key-input" />
        <MaskedInput label="LiveKit API Secret" value={settings.livekit_api_secret || ''} onChange={v => set('livekit_api_secret', v)} testId="livekit-api-secret-input" />
      </Section>

      {/* AWS */}
      <Section title="AWS (S3 + SQS)" icon="☁️">
        <MaskedInput label="AWS Access Key ID" value={settings.aws_access_key_id || ''} onChange={v => set('aws_access_key_id', v)} testId="aws-access-key-input" />
        <MaskedInput label="AWS Secret Access Key" value={settings.aws_secret_access_key || ''} onChange={v => set('aws_secret_access_key', v)} testId="aws-secret-key-input" />
        <MaskedInput label="AWS Region" value={settings.aws_region || 'ap-south-1'} onChange={v => set('aws_region', v)} type="text" placeholder="ap-south-1" testId="aws-region-input" />
        <MaskedInput label="S3 Bucket Name" value={settings.s3_bucket_name || ''} onChange={v => set('s3_bucket_name', v)} type="text" placeholder="phonic-recordings" testId="s3-bucket-input" />
      </Section>

      <div className="flex justify-end pb-8">
        <button onClick={handleSave} disabled={saving} className="btn-primary px-8" data-testid="save-settings-bottom-btn">
          <Save size={16} />
          {saving ? 'Saving...' : 'Save All Settings'}
        </button>
      </div>
    </div>
  );
}
