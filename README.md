<![CDATA[<div align="center">

# 🎙️ Phonic AI Interview Agent

**Automated AI-Powered Phone Interview Platform**

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?logo=python&logoColor=white)](https://python.org)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://reactjs.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.135+-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![MongoDB](https://img.shields.io/badge/MongoDB-47A248?logo=mongodb&logoColor=white)](https://mongodb.com)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

*Conduct structured AI voice interviews at scale with adaptive questioning, real-time evaluation, and multi-provider telephony support.*

[Features](#-features) •
[Quick Start](#-quick-start) •
[Installation](#-installation) •
[Documentation](#-documentation) •
[API Reference](#-api-reference)

---

</div>

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Architecture](#-architecture)
- [Quick Start](#-quick-start)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Usage](#-usage)
- [Project Structure](#-project-structure)
- [API Reference](#-api-reference)
- [Development](#-development)
- [Roadmap](#-roadmap)
- [Contributing](#-contributing)
- [License](#-license)
- [Acknowledgments](#-acknowledgments)

## 🎯 Overview

**Phonic AI Interview Agent** is a full-stack platform that automates technical interviews by:

- 📞 **Calling candidates** on their real phone numbers using local numbers per geography
- 🎤 **Conducting structured voice interviews** using job description + resume context
- 🧠 **Adapting questions in real-time** based on candidate responses
- 🗣️ **Using configurable TTS accents** for natural conversation
- 📊 **Producing comprehensive evaluation reports** with per-answer scoring

### Why Phonic?

| Traditional Interviews | With Phonic |
|----------------------|-------------|
| Manual scheduling overhead | Automated call scheduling |
| Inconsistent questioning | Structured, adaptive interviews |
| Subjective evaluation | Data-driven scoring |
| Limited scalability | Interview hundreds simultaneously |
| No real-time insights | Live transcript monitoring |

## ✨ Features

### Core Capabilities

| Feature | Description |
|---------|-------------|
| 🤖 **Multi-LLM Support** | Switch between Ollama (local/free), Claude, or OpenAI |
| 🎙️ **Voice Pipeline** | Deepgram STT + Cartesia TTS with Silero VAD |
| 📱 **Global Telephony** | Telnyx (international) + Ozonetel (India) support |
| 📄 **Smart Parsing** | AI-powered JD and resume extraction |
| 🔄 **Adaptive Questions** | Real-time question adaptation based on responses |
| 📊 **Evaluation Reports** | Detailed scoring with strengths, red flags, and quotes |
| 🌓 **Dark/Light Theme** | Modern UI with theme toggle |
| 🔐 **JWT Authentication** | Secure API with role-based access |

### Interview Flow

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌──────────────┐
│  Schedule   │ ──▶ │ Trigger Call │ ──▶ │  Interview  │ ──▶ │  Evaluation  │
│  Interview  │     │  (Telephony) │     │   (Voice)   │     │   Report     │
└─────────────┘     └──────────────┘     └─────────────┘     └──────────────┘
       │                   │                    │                    │
       ▼                   ▼                    ▼                    ▼
   JD + Resume        Ozonetel/Telnyx      LLM + TTS/STT       Scores + Insights
```

## 🏗️ Architecture

### Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, Tailwind CSS, Radix UI, React Router v6 |
| **Backend** | FastAPI, Motor (async MongoDB), Python 3.11+ |
| **Voice** | Pipecat 0.0.105, Deepgram STT, Cartesia TTS, Silero VAD |
| **LLM** | Ollama (default), Claude (Anthropic), OpenAI GPT-4o |
| **Database** | MongoDB |
| **Telephony** | Telnyx (global), Ozonetel (India) |
| **Auth** | JWT with bcrypt |

### System Overview

```
                                    ┌─────────────────────────────────┐
                                    │         React Frontend          │
                                    │   (Dashboard, Interview Room)   │
                                    └──────────────┬──────────────────┘
                                                   │
                                                   ▼
┌─────────────┐    ┌──────────────────────────────────────────────────────────┐
│  Telephony  │◀──▶│                    FastAPI Backend                       │
│  Providers  │    │  ┌──────────┬───────────┬──────────┬──────────────────┐  │
│             │    │  │   Auth   │ Interviews│   JD/    │   Evaluation     │  │
│  • Telnyx   │    │  │  Router  │   Router  │  Resume  │     Router       │  │
│  • Ozonetel │    │  └──────────┴───────────┴──────────┴──────────────────┘  │
└─────────────┘    │                         │                                │
                   │  ┌──────────────────────┴────────────────────────────┐   │
                   │  │              Voice Pipeline (Pipecat)              │   │
                   │  │   Deepgram STT ◀──▶ LLM ◀──▶ Cartesia TTS          │   │
                   │  └────────────────────────────────────────────────────┘   │
                   └──────────────────────────┬───────────────────────────────┘
                                              │
                                              ▼
                              ┌───────────────────────────────┐
                              │           MongoDB             │
                              │  (Sessions, Users, Settings)  │
                              └───────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- **Python** 3.11+
- **Node.js** 18+
- **MongoDB** (local or Atlas)
- **uv** (Python package manager) - [Install uv](https://docs.astral.sh/uv/getting-started/installation/)

### 30-Second Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/Phonic-AI-Interview-Agent.git
cd Phonic-AI-Interview-Agent

# Start MongoDB (if local)
mongod --dbpath /path/to/data

# Backend
cd backend
cp .env.example .env  # Configure your environment
uv sync
uv run uvicorn server:app --reload --port 8000

# Frontend (new terminal)
cd frontend
npm install
npm start
```

**Demo Credentials:** `admin@phonic.ai` / `phonic123`

## 📦 Installation

### Backend Setup

```bash
cd backend

# Create environment file
cp .env.example .env

# Install dependencies with uv
uv sync

# Start the server
uv run uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Create environment file
echo "REACT_APP_BACKEND_URL=http://localhost:8000" > .env

# Start development server
npm start
```

The frontend will be available at `http://localhost:3000`

### Docker Setup (Coming Soon)

```bash
docker-compose up -d
```

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in the `backend` directory:

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `MONGO_URL` | MongoDB connection string | Yes | `mongodb://localhost:27017` |
| `DB_NAME` | Database name | Yes | `phonic_interviews` |
| `SECRET_KEY` | JWT secret key | Yes | - |
| `LLM_PROVIDER` | LLM provider (`ollama`, `claude`, `openai`) | No | `ollama` |
| `OLLAMA_BASE_URL` | Ollama server URL | No | `http://localhost:11434` |
| `OLLAMA_MODEL` | Ollama model name | No | `llama3` |
| `ANTHROPIC_API_KEY` | Anthropic API key | No | - |
| `OPENAI_API_KEY` | OpenAI API key | No | - |
| `DEEPGRAM_API_KEY` | Deepgram STT API key | No | - |
| `CARTESIA_API_KEY` | Cartesia TTS API key | No | - |
| `OZONETEL_API_KEY` | Ozonetel telephony API key | No | - |
| `OZONETEL_USERNAME` | Ozonetel username | No | - |
| `OZONETEL_CAMPAIGN_NAME` | Ozonetel campaign name | No | - |

### LLM Configuration

#### Option 1: Ollama (Local, Free)

```bash
# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Pull a model
ollama pull llama3

# Set in .env
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3
```

#### Option 2: Claude (Anthropic)

```bash
# Set in .env
LLM_PROVIDER=claude
ANTHROPIC_API_KEY=your-api-key
```

#### Option 3: OpenAI

```bash
# Set in .env
LLM_PROVIDER=openai
OPENAI_API_KEY=your-api-key
OPENAI_MODEL=gpt-4o
```

## 📖 Usage

### Creating an Interview

1. **Login** with demo credentials or create an account
2. Navigate to **"New Interview"**
3. Fill in candidate details (name, email, phone)
4. Add job description (paste or select from library)
5. Upload resume (PDF/DOCX) - optional
6. Configure interview settings:
   - **Duration**: 15-60 minutes
   - **Accent**: US, UK, Australian, Indian
   - **LLM Provider**: Ollama, Claude, or OpenAI
7. Click **"Schedule Interview"**

### Triggering a Call

```bash
# Via API
curl -X POST http://localhost:8000/api/interviews/{session_id}/call \
  -H "Authorization: Bearer <token>"
```

Or click **"Trigger Call"** in the Interview Detail page.

### Monitoring Live Interviews

The Interview Detail page shows:
- Real-time transcript via WebSocket
- Call status and duration
- Domain progress indicators

### Viewing Evaluation Reports

After an interview completes:
1. Navigate to the Interview Detail page
2. Click **"View Evaluation"**
3. See scores, hire recommendation, strengths, red flags, and notable quotes

## 📁 Project Structure

```
Phonic-AI-Interview-Agent/
├── backend/
│   ├── db/
│   │   └── mongo.py           # MongoDB connection
│   ├── models/
│   │   └── interview_session.py # Pydantic models
│   ├── pipeline/
│   │   └── interview_pipeline.py # Voice pipeline
│   ├── routers/
│   │   ├── auth.py            # Authentication
│   │   ├── interviews.py      # Interview CRUD
│   │   ├── jd.py              # Job descriptions
│   │   ├── resume.py          # Resume parsing
│   │   ├── evaluations.py     # Evaluation reports
│   │   ├── settings.py        # App settings
│   │   └── webhooks.py        # Telephony callbacks
│   ├── services/
│   │   ├── llm_provider.py    # LLM abstraction
│   │   ├── prompt_builder.py  # Dynamic prompts
│   │   ├── conversation_state.py # State tracking
│   │   └── evaluation.py      # Scoring logic
│   ├── server.py              # FastAPI app
│   ├── pyproject.toml         # Python dependencies
│   └── .env                   # Environment config
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   └── Layout.js      # App layout
│   │   ├── contexts/
│   │   │   ├── AuthContext.js # Auth state
│   │   │   └── ThemeContext.js # Theme state
│   │   ├── lib/
│   │   │   ├── api.js         # Axios client
│   │   │   └── ws.js          # WebSocket client
│   │   ├── pages/
│   │   │   ├── Dashboard.js
│   │   │   ├── InterviewsList.js
│   │   │   ├── InterviewDetail.js
│   │   │   ├── InterviewRoom.js
│   │   │   ├── NewInterview.js
│   │   │   ├── EvaluationReport.js
│   │   │   ├── JDLibrary.js
│   │   │   └── Settings.js
│   │   ├── App.js
│   │   └── index.js
│   ├── package.json
│   └── tailwind.config.js
├── memory/
│   └── PRD.md                 # Product requirements
├── design_guidelines.json     # UI/UX specs
├── LICENSE                    # Apache 2.0
└── README.md                  # This file
```

## 🔌 API Reference

### Authentication

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/register` | POST | Create new user |
| `/api/auth/login` | POST | Get JWT token |
| `/api/auth/me` | GET | Get current user |

### Interviews

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/interviews` | GET | List interviews |
| `/api/interviews` | POST | Create interview |
| `/api/interviews/{id}` | GET | Get interview details |
| `/api/interviews/{id}/call` | POST | Trigger phone call |
| `/api/interviews/{id}/cancel` | POST | Cancel interview |
| `/api/interviews/stats` | GET | Get statistics |

### Job Descriptions

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/jd` | GET | List JD templates |
| `/api/jd` | POST | Create/parse JD |
| `/api/jd/{id}` | DELETE | Delete JD |

### Evaluations

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/evaluations/{session_id}` | GET | Get evaluation report |
| `/api/evaluations/{session_id}/run` | POST | Trigger evaluation |

### Webhooks

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/webhooks/ozonetel` | POST | Ozonetel CDR callback |
| `/api/webhooks/telnyx` | POST | Telnyx event callback |

### WebSocket Endpoints

| Endpoint | Description |
|----------|-------------|
| `/api/ws/voice/{session_id}` | Voice pipeline (candidate) |
| `/api/ws/monitor/{session_id}` | Live transcript (recruiter) |

## 🛠️ Development

### Running Tests

```bash
cd backend

# Run all tests
uv run pytest

# Run with coverage
uv run pytest --cov=. --cov-report=html
```

### Code Style

```bash
# Format code
uv run black .
uv run isort .

# Lint
uv run flake8
```

### Database Seeding

The demo user is automatically seeded on startup:
- **Email:** admin@phonic.ai
- **Password:** phonic123

## 🗺️ Roadmap

### Phase 1 (Current) ✅
- [x] Voice pipeline with text fallback
- [x] Multi-LLM support (Ollama/Claude/OpenAI)
- [x] Interview CRUD and scheduling
- [x] JD/Resume parsing
- [x] Evaluation reports
- [x] Ozonetel telephony integration

### Phase 2 (In Progress)
- [ ] WebRTC browser audio support
- [ ] Call recording to S3
- [ ] PDF export of reports
- [ ] Email notifications
- [ ] Telnyx phone integration testing

### Phase 3 (Planned)
- [ ] Multi-recruiter team support
- [ ] Interview templates/question bank
- [ ] Candidate self-scheduling portal
- [ ] ATS integrations (Greenhouse, Lever)
- [ ] Analytics dashboard
- [ ] Voice cloning upload

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

1. **Fork** the repository
2. **Create** your feature branch (`git checkout -b feature/AmazingFeature`)
3. **Commit** your changes (`git commit -m 'Add some AmazingFeature'`)
4. **Push** to the branch (`git push origin feature/AmazingFeature`)
5. **Open** a Pull Request

### Development Setup

```bash
# Clone your fork
git clone https://github.com/yourusername/Phonic-AI-Interview-Agent.git

# Add upstream
git remote add upstream https://github.com/original/Phonic-AI-Interview-Agent.git

# Keep your fork synced
git fetch upstream
git merge upstream/main
```

## 📄 License

This project is licensed under the **Apache License 2.0** - see the [LICENSE](LICENSE) file for details.

```
Copyright 2024 Phonic AI

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0
```

## 🙏 Acknowledgments

- [Pipecat](https://github.com/pipecat-ai/pipecat) - Voice pipeline framework
- [Deepgram](https://deepgram.com/) - Speech-to-text
- [Cartesia](https://cartesia.ai/) - Text-to-speech
- [Ollama](https://ollama.ai/) - Local LLM inference
- [FastAPI](https://fastapi.tiangolo.com/) - Backend framework
- [Radix UI](https://radix-ui.com/) - React components
- [Tailwind CSS](https://tailwindcss.com/) - Styling

---

<div align="center">

**Built with ❤️ by the Phonic Team**

[⬆ Back to Top](#-phonic-ai-interview-agent)

</div>
]]>