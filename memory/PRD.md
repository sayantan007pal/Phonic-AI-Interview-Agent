# Phonic AI Interview Agent — PRD

## Problem Statement
Build a full-stack AI phone interview agent platform that automatically calls candidates on their real phone numbers using local numbers per geography, conducts structured voice interviews using JD + resume context, adapts questions in real-time, uses configurable TTS accents, and produces full transcript + per-answer evaluation reports.

**User Choices:**
- Default LLM: Ollama (local, free)
- Theme: Dark/light toggle
- API keys: Placeholder support first (UI inputs on Settings page)
- Phase: Phase 1 (voice pipeline core + full dashboard)

## Architecture

### Tech Stack
- **Frontend**: React 18 (CRA) + Tailwind CSS + React Router v6
- **Backend**: FastAPI (Python 3.11) + Motor (async MongoDB)
- **Database**: MongoDB (local)
- **Voice Pipeline**: Pipecat 0.0.105 + Deepgram STT + Cartesia TTS + Silero VAD
- **LLM**: Ollama (default) / Claude / OpenAI — switchable via env var
- **Auth**: JWT with passlib/bcrypt

### Key Design Decisions
- All backend routes prefixed with `/api` per Emergent environment requirements
- Public endpoint `/api/public/interview/:id` for candidate room (no auth required)
- Voice pipeline has text-mode fallback when Deepgram/Cartesia keys not configured
- Settings stored in MongoDB `app_settings` collection (not env files)

## What's Been Implemented (Phase 1 — March 2025)

### Backend
- ✅ FastAPI server with all routers
- ✅ JWT auth (register/login/me)
- ✅ Interview session CRUD (create, list, get, cancel, trigger call)
- ✅ Interview stats endpoint
- ✅ JD management (parse via LLM, save templates, list, delete)
- ✅ Resume upload & parsing (PDF/DOCX via unstructured/pdfplumber)
- ✅ Evaluation pipeline (async, triggered manually)
- ✅ Settings management (read/update API keys, masked display)
- ✅ LLM provider abstraction (Ollama/Claude/OpenAI — swappable via env)
- ✅ Telephony router (Telnyx geo-routing + Exotel/Ozonetel India)
- ✅ Webhook handlers (Telnyx, Exotel, Ozonetel)
- ✅ Voice pipeline WebSocket (`/api/ws/voice/:sessionId`)
  - Pipecat pipeline when Deepgram+Cartesia configured
  - Text-only fallback when keys not available
- ✅ Monitor WebSocket (`/api/ws/monitor/:sessionId`) for recruiter
- ✅ Public session endpoint for candidate room
- ✅ Prompt builder (dynamic system prompt from JD + Resume)
- ✅ Conversation state tracker (domain rotation, follow-up logic)
- ✅ Adaptive scoring system
- ✅ Post-interview LLM evaluation

### Frontend
- ✅ Dark/light theme toggle (CSS custom properties)
- ✅ Login/Register page
- ✅ Dashboard overview (stat cards, recent interviews, quick actions)
- ✅ Interview list page (filters, pagination, search)
- ✅ New Interview form (candidate info, JD, resume upload, accent, LLM, duration)
- ✅ Interview detail page (live transcript, WebSocket monitor, progress, session info)
- ✅ Evaluation report page (scores, hire band, strengths, red flags, quotes, transcript)
- ✅ JD Library (add, parse, list, delete)
- ✅ Settings page (all API keys with masked inputs, expandable sections, test buttons)
- ✅ Interview Room (candidate-facing browser interview with text mode)
- ✅ Live waveform visualizer (CSS animated bars)

### Fonts & Design
- Plus Jakarta Sans (headings), Public Sans (body), JetBrains Mono (API keys)
- Dark: #0B0C15 bg / #3B82F6 accent
- Light: #FAFAFA bg / #2563EB accent

## Test Results (Iteration 1)
- Backend: 100% (13/13 tests passing)
- Frontend: 90% (all major flows working)
- Demo credentials: admin@phonic.ai / phonic123

## Prioritized Backlog

### P0 — Critical for voice functionality
- [ ] Obtain and configure: DEEPGRAM_API_KEY, CARTESIA_API_KEY
- [ ] Pull Ollama model: `ollama pull llama3`
- [ ] Test real voice interview in browser (text→voice path)

### P1 — Phase 2 improvements
- [ ] Phone call integration testing (Telnyx/Exotel with real keys)
- [ ] Call recording → S3 upload
- [ ] PDF export of evaluation reports
- [ ] Candidate email notification on interview scheduled
- [ ] WebRTC browser audio (MediaRecorder → WebSocket → Deepgram)
- [ ] Real-time transcript streaming to recruiter monitor via WebSocket broadcast

### P2 — Future
- [ ] Multi-recruiter team support
- [ ] Interview templates / question bank
- [ ] Candidate self-scheduling portal
- [ ] Integration with ATS (Greenhouse, Lever, Workday)
- [ ] Analytics dashboard (hire rate by domain, avg scores by role)
- [ ] Voice cloning upload for custom brand voice (Cartesia)
- [ ] TRAI DLT registration workflow for India

## Next Tasks
1. Configure API keys in Settings page (Deepgram, Cartesia, Ollama URL)
2. Pull Ollama model: `docker run ollama/ollama` or local install
3. Test voice interview in browser
4. Add Telnyx phone call trigger with real keys
5. Implement WebSocket broadcast from voice pipeline to monitor dashboard
