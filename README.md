# Airline Customer Resolution Agent

An agentic AI application for airline customer disruption resolution built with a clean **Three-Layer Architecture**.

```
React Frontend (5173) ──HTTP (Bearer JWT)──► Node.js Backend (5000) ──HTTP (Internal Key)──► Python AI Service (8000)
                                                    │
                                                    ▼
                                            Supabase Database
```

---

## Architecture Overview

1. **Frontend (`frontend/`)**: React + Vite single-page application. Handles user authentication with Supabase Auth (Email + Password) and provides responsive customer chat and supervisor HITL dashboards.
2. **Backend API (`backend/`)**: Node.js + Express server. Handles authentication validation, customer and booking queries, database mutations for resolution actions, supervisor approval workflows, and audit logging.
3. **AI Service (`ai-service/`)**: Python + FastAPI service. Powers the customer resolution agent using LangGraph, Groq LLM reasoning, policy evaluation, and Human-in-the-Loop (HITL) interrupt/resume workflows.

---

## Getting Started

### Prerequisites
- Node.js (v18+)
- Python (v3.10+)
- Supabase project with database configured

### 1. Python AI Service
```bash
cd ai-service
# Activate virtual environment
./venv/Scripts/activate  # On Windows
# Run service
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 2. Node.js Backend
```bash
cd backend
npm install
npm run dev
```
Runs on `http://localhost:5000`.

### 3. React Frontend
```bash
cd frontend
npm install
npm run dev
```
Runs on `http://localhost:5173`.

---

## Running Tests

### Backend Tests (Jest)
```bash
cd backend
npm test
```

### AI Service Tests (Pytest)
```bash
cd ai-service
./venv/Scripts/python -m pytest tests/ -v
```

### Frontend Build
```bash
cd frontend
npm run build
```