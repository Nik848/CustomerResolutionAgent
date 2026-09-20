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

## Required Environment Variables

### Python AI Service (`ai-service/.env`)
```bash
GROQ_API_KEY=your-groq-api-key
BACKEND_API_URL=http://localhost:5000
INTERNAL_API_KEY=airline-internal-secret-key-2026
```

### Node.js Backend (`backend/.env`)
```bash
PORT=5000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
SUPABASE_ANON_KEY=your-supabase-anon-key
DATABASE_URL=postgresql://postgres:password@db.example.com:6543/postgres
AI_SERVICE_URL=http://localhost:8000
INTERNAL_API_KEY=airline-internal-secret-key-2026
FRONTEND_URL=http://localhost:5173
```

### React Frontend (`frontend/.env.local`)
```bash
VITE_API_URL=http://localhost:5000
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

---

## Authentication & Authorization

- **Customer Authentication**: Customer logs in via Supabase Auth (Email + Password). The frontend sends requests with `Authorization: Bearer <token>`.
- **Identity Resolution**: Node backend verifies the token with Supabase Auth, determines the linked `customer_id` from `public.customers`, and scopes all operations to that customer.
- **Admin Authorization**: Users with `role = 'admin'` in `public.profiles` can access supervisor endpoints (`/api/admin/approvals`). Customers are strictly rejected with 403 Forbidden.
- **Internal Service Security**: Node backend and Python AI service communicate via HTTP protected with a shared `X-Internal-API-Key` header.

---

## HITL (Human-in-the-Loop) Workflow

1. Customer submits a request requiring supervisor approval (e.g. fare difference waiver > ₹1,500).
2. AI service evaluates policy rules, sets `requires_human_approval = true`, and pauses the LangGraph execution using `interrupt()`.
3. Node backend persists a pending record in `approval_requests` table.
4. Supervisor views pending requests in the Admin Dashboard (`/admin`).
5. Supervisor clicks **Approve** or **Reject** with an optional resolution note.
6. Node backend resolves the record, resumes the paused LangGraph workflow via `POST /api/agent/resume`, executes resulting actions, and logs the audit event.
7. Duplicate-processing protection ensures a request cannot be resolved twice.

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