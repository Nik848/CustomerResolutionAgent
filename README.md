# Airline Customer Resolution Agent (SkyResolve AI)

An enterprise-grade, agentic AI platform for airline customer disruption resolution built strictly upon a clean **Three-Layer Architecture**.

The system automates policy evaluation, disruption compensation (cancellations, delays, rebookings, meal vouchers, lounge passes, hotel accommodations), and Human-in-the-Loop (HITL) supervisor approvals while maintaining strict separation of concerns, multi-tenant security, and comprehensive audit trails.

---

## 🏛️ System Architecture

```
React Frontend (5173) ──HTTP (Bearer JWT)──► Node.js / Express Backend (5000) ──HTTP (X-Internal-API-Key)──► Python / FastAPI AI Service (8000)
                                                    │                                                                  │
                                                    ▼                                                                  ▼
                                          Hosted Supabase (DB & Auth)                                            Groq LLM API
```

### Architectural Ownership:
1. **React Frontend (`frontend/`)**:
   - Built with React + Vite.
   - User authentication (Email/Password) via Supabase Auth client.
   - Modern customer portal: Live flight disruptions, quick prompt chips, real-time message streaming, structured resolution cards (vouchers, refunds, rebookings), and supervisor pending approval notices.
   - Dedicated Supervisor/Admin dashboard: Real-time review, approval, or rejection of escalated customer requests with supervisor resolution notes.

2. **Node.js / Express Backend (`backend/`)**:
   - **Database & Data Authority**: Sole owner of all PostgreSQL/Supabase access, database mutations, and application state.
   - **Authentication & Security**: Validates JWTs, resolves authenticated customer identity (`auth_user_id` ➔ `customer_id`), and enforces role-based access control (`customer` vs `admin`).
   - **Action Execution Engine**: Directly performs database mutations for full refunds, flight rebooking, meal vouchers, lounge access, and hotel accommodations.
   - **HITL Management**: Persists approval requests and orchestrates workflow resumption.
   - **Audit Persistence**: Writes all action and approval events to the tamper-evident backend audit log.

3. **Python / FastAPI AI Service (`ai-service/`)**:
   - **Intelligence & Orchestration**: Powered by LangGraph state machines and Groq LLMs (`openai/gpt-oss-20b`).
   - **Zero Direct Database Access**: Strictly decoupled from PostgreSQL/Supabase. All customer and booking context is injected or retrieved via authenticated backend HTTP requests.
   - **Policy Engine**: Enforces exact airline rules (delays <3h, 3–5h, >5h; cancellations; fare difference thresholds).
   - **Human-in-the-Loop (HITL)**: Uses LangGraph's native `interrupt()` and `Command(resume=...)` to pause execution when authority limits are exceeded and resume after supervisor sign-off.

---

## 📋 Assignment Rules & Disruption Policies

The agent strictly adheres to the official assignment data pack:

| Disruption Type | Rule & Criteria | Permitted Actions |
| :--- | :--- | :--- |
| **Flight Cancellation** | Airline-caused cancellation | Free rebooking on next available flight within 24 hours **OR** full refund to original payment method. Unaffected flights are left untouched. |
| **Delay < 3 Hours** | Operational / Airline delay | ₹500 meal voucher. |
| **Delay 3 to 5 Hours** | Operational / Airline delay | Meal voucher + lounge access pass. Hotel is strictly **denied**. |
| **Delay > 5 Hours** | Major delay | Meal voucher + lounge access + hotel accommodation covering **only the delayed hours** (not full night). |
| **Fare Difference** | Voluntary rebooking to higher-fare flight | Customer must pay difference. Agents can waive up to ₹1,500. Any waiver **> ₹1,500 requires supervisor approval (HITL)**. |
| **Loyalty Tiers** | Gold & Platinum members | Priority access for next-available seats, but **no unauthorized compensatory upgrades** (e.g. free business class upgrade rejected). |

---

## 🚀 How to Run Locally

You can run the system either via **Docker Compose (Recommended)** or **Direct Process Mode**.

### Option A: Running with Docker Compose (Recommended)

Docker Compose starts both the backend and AI service in their isolated Linux containers with internal networking configured.

#### 1. Setup Environment Variables
Copy `.env.example` at the repository root to `.env`:
```bash
cp .env.example .env
```
Populate `.env` with your credentials:
- `GROQ_API_KEY`: Your Groq API Key
- `SUPABASE_URL`: Your Supabase Project URL (`https://xyz.supabase.co`)
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase Service Role Secret Key
- `SUPABASE_ANON_KEY`: Your Supabase Anon Key
- `DATABASE_URL`: PostgreSQL connection string (pooler or direct)
- `INTERNAL_API_KEY`: Shared secret key (e.g. `airline-internal-secret-key-2026`)

#### 2. Build and Start Backend & AI Service
```bash
docker compose build
docker compose up -d
```
Verify running containers:
```bash
docker compose ps
# airline-backend    Up   0.0.0.0:5000->5000/tcp
# airline-ai-service Up   0.0.0.0:8000->8000/tcp
```

#### 3. Start React Frontend
In a separate terminal:
```bash
cd frontend
npm install
npm run dev
```
Open your browser at `http://localhost:5173`.

---

### Option B: Running Without Docker (Direct Process Mode)

#### 1. Start Python AI Service
```bash
cd ai-service
# Create and activate virtual environment
python -m venv venv
./venv/Scripts/activate       # Windows PowerShell: .\venv\Scripts\Activate.ps1
pip install -r requirements.txt

# Start FastAPI server on port 8000
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

#### 2. Start Node.js Backend
```bash
cd backend
npm install
npm run dev
```
Runs on `http://localhost:5000`.

#### 3. Start React Frontend
```bash
cd frontend
npm install
npm run dev
```
Runs on `http://localhost:5173`.

---

## 🔍 How Everything Works (Under the Hood)

### 1. Customer Resolution Request Flow
```
[User Browser]
      │  Types: "My flight SK-204 was cancelled, I want a refund."
      ▼
[React Frontend]
      │  POST /api/chat with Bearer JWT
      ▼
[Node.js Backend]
      │  1. Authenticates JWT with Supabase Auth
      │  2. Resolves customer record (Priya Nair, CUST001)
      │  3. Fetches customer's active bookings from Supabase
      │  4. Forwards request, customer profile & bookings to AI Service
      ▼
[Python AI Service]
      │  1. Verifies X-Internal-API-Key header
      │  2. LangGraph node: Understands intent (cancellation + refund)
      │  3. Selects disrupted booking (SK-204) while preserving unaffected return flight
      │  4. Evaluates policy: evaluate_cancellation() ➔ Allowed: ["full_refund"]
      │  5. Returns structured command: { status: "completed", actions: ["full_refund"] }
      ▼
[Node.js Backend]
      │  1. Receives command from AI
      │  2. Executes initiate_refund on Supabase (marks refund_status = "processed")
      │  3. Appends audit event: action_executed
      │  4. Returns final completion payload to Frontend
      ▼
[React Frontend]
      Displays natural language confirmation + interactive Refund Action Card.
```

### 2. Human-in-the-Loop (HITL) Supervisor Workflow
```
[Customer]
      │  Requests: "Waive the ₹2,000 fare difference for my new flight."
      ▼
[AI Policy Engine]
      │  Compares: ₹2,000 > ₹1,500 agent threshold
      │  Graph execution is PAUSED using LangGraph interrupt()
      │  Returns: status: "human_approval_required"
      ▼
[Node.js Backend]
      │  Creates pending record in approval_requests table
      │  Notifies customer: "Supervisor approval required"
      ▼
[Admin Dashboard]
      │  Supervisor logs in at /admin
      │  Views pending request with customer context & fare difference breakdown
      │  Clicks [Approve Waiver] with note: "Approved for Platinum Tier"
      ▼
[Node.js Backend]
      │  1. Updates approval_requests table to status: 'approved'
      │  2. Calls AI Service POST /api/agent/resume with status: "approve"
      ▼
[Python AI Service]
      │  Resumes paused LangGraph thread with Command(resume={"status": "approve"})
      │  Completes rebooking node and returns confirmation
      ▼
[Node.js Backend]
      │  Executes rebooking mutation in database
      │  Logs human_approval_received audit event
```

---

## 🧪 Verification & Automated Test Suites

All components feature comprehensive automated regression tests:

### 1. Backend Acceptance & Unit Tests (Jest)
Tests all 11 acceptance scenarios (A through K), authentication gates, admin approval resolution, and internal security:
```bash
cd backend
npm test
```
*Result: 6 test suites passed, 32 / 32 tests passed.*

### 2. AI Service E2E & Boundary Tests (Pytest)
Validates policy rules, Groq LLM routing, LangGraph state transitions, HITL pause/resume, and architecture boundary isolation:
```bash
cd ai-service
./venv/Scripts/python -m pytest tests/ -v
```
*Result: 27 / 27 tests passed.*

### 3. Frontend Production Build Check
Validates React JSX compilation, Vite bundling, and asset integrity:
```bash
cd frontend
npm run build
```
*Result: Production build completes cleanly in ~4.5 seconds.*

---

## 🔒 Security & Deployment Notes

- **Secrets Handling**: Zero `.env` files are baked into Docker images or committed to Git. All secrets are passed at runtime via container environment variables.
- **Microservice Authentication**: Internal server-to-server calls between the Node.js backend and FastAPI AI service require the `X-Internal-API-Key` header; unauthenticated requests are rejected with `401 Unauthorized`.
- **Render Deployment Ready**:
  - **Backend**: Deploy as Render Web Service using `backend/Dockerfile` (PORT dynamically injected by Render).
  - **AI Service**: Deploy as Render Web Service using `ai-service/Dockerfile` (PORT dynamically injected by Render).
  - **Frontend**: Deploy as Render Static Site (dist directory created via `npm run build`).