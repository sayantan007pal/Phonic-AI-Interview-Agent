const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

function getWsUrl(path) {
  // Convert https:// to wss:// or http:// to ws://
  const wsBase = BACKEND_URL.replace(/^https:\/\//, 'wss://').replace(/^http:\/\//, 'ws://');
  return `${wsBase}${path}`;
}

export class VoiceWebSocket {
  constructor(sessionId, { onMessage, onOpen, onClose, onError } = {}) {
    this.sessionId = sessionId;
    this.ws = null;
    this.onMessage = onMessage;
    this.onOpen = onOpen;
    this.onClose = onClose;
    this.onError = onError;
  }

  connect() {
    const url = getWsUrl(`/api/ws/voice/${this.sessionId}`);
    this.ws = new WebSocket(url);

    this.ws.onopen = () => this.onOpen?.();
    this.ws.onclose = (e) => this.onClose?.(e);
    this.ws.onerror = (e) => this.onError?.(e);
    this.ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        this.onMessage?.(data);
      } catch {
        this.onMessage?.({ type: 'raw', data: e.data });
      }
    };
  }

  sendText(text) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'candidate_message', text }));
    }
  }

  sendAudio(audioData) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(audioData);
    }
  }

  endInterview() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'end_interview' }));
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export class MonitorWebSocket {
  constructor(sessionId, { onMessage, onOpen, onClose } = {}) {
    this.sessionId = sessionId;
    this.ws = null;
    this.onMessage = onMessage;
    this.onOpen = onOpen;
    this.onClose = onClose;
  }

  connect() {
    const url = getWsUrl(`/api/ws/monitor/${this.sessionId}`);
    this.ws = new WebSocket(url);
    this.ws.onopen = () => this.onOpen?.();
    this.ws.onclose = (e) => this.onClose?.(e);
    this.ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        this.onMessage?.(data);
      } catch {}
    };
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
