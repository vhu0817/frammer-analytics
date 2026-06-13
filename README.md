# Frammer Analytics OS

A full-stack B2B analytics dashboard for **Frammer AI** — a platform that converts long-form videos into shorts, reels, chapters, and summaries. This dashboard tracks video processing pipelines across clients, channels, users, and content types, with role-based access control and an AI-powered natural language query agent.

> This project is based on a problem statement from the **Interhall Technology General Championship Data Analytics 2026** at **Indian Institute of Technology Kharagpur**.

## What this does

Frammer processes thousands of videos daily for multiple enterprise clients. This analytics OS gives operations teams a way to:

- **Monitor KPIs** — uploads, processing rates, publishing throughput, total hours processed
- **Spot trends** — daily/weekly/monthly time series with period-over-period comparison
- **Analyze breakdowns** — pivot tables across any two dimensions (client × channel, user × type, etc.)
- **Track the funnel** — uploaded → processed → published conversion with drop-off analysis
- **Explore raw data** — searchable, filterable, exportable video-level records
- **Ask questions in plain English** — ATLAS agent converts natural language to SQL and charts

## Tech stack

| Layer | Tech |
|-------|------|
| **Backend** | FastAPI, SQLAlchemy, Alembic, bcrypt, PyJWT |
| **Database** | PostgreSQL 16 (star schema — 5 dimension tables + 1 fact table) |
| **Frontend** | React 19, Vite, Tailwind CSS v4, shadcn/ui, Recharts, Zustand, Framer Motion |
| **AI Agent** | Google Gemini 2.5 Flash, custom ReAct loop |
| **Infra** | Docker Compose (3 services: db, api, web) |

## Current progress

Building this step-by-step across 8 phases (47 total steps).

### ✅ Phase 1 — Scaffolding & Infrastructure (Steps 1.1–1.10)
- Monorepo folder structure (`api/`, `web/`, `docs/`)
- Docker Compose with 3 services (PostgreSQL, FastAPI, Vite)
- FastAPI app with CORS, lifespan hooks, health check
- 8 stubbed route modules
- Environment config with pydantic-settings

### ✅ Phase 2 — Data Model & Simulator (Steps 2.1–2.6)
- Star schema ORM models (5 dimension tables + fact table)
- Alembic migration setup with initial schema
- Data simulator generating realistic synthetic data:
  - 8 clients, 28 channels, 44 users, 31 content types, 5 platforms
  - ~14,000 fact records over 180 days
  - Weekday volume bias, enterprise scaling, log-normal durations
  - 85% processing rate, 55% publish rate, 5% intentional data quality issues

### ✅ Phase 3 — Auth & RBAC (Steps 3.1–3.6)
- Pydantic auth schemas (register, login, token, user response)
- Auth service (bcrypt hashing, JWT generation/validation)
- Auth routes (POST /register, POST /login, GET /me)
- RBAC middleware (JWT extraction, role-based dependencies)
- Query builder with role-based scoping (tenant isolation)
- 3 test users seeded + full auth flow verified

### ✅ Phase 4 — Dashboard API Endpoints (Steps 4.1–4.6)
- Filter options endpoint (role-scoped dropdowns for all dimensions)
- Executive summary KPIs, sparklines, z-score anomaly alerts
- Usage & trends time series with day/week/month granularity + period comparison
- Analysis pivot tables, top-N leaderboards, dimension drilldowns
- Publishing funnel stages, conversion breakdowns, type mix distributions
- Video explorer with pagination, search, sorting, and CSV export

### ✅ Phase 5 — Frontend Foundation (Steps 5.1–5.6)
- Vite + React 19 with Tailwind CSS v4 + shadcn/ui (Radix + Nova preset)
- Dark theme design system with oklch tokens, glassmorphism card utilities
- Collapsible sidebar, frosted-glass header, responsive dashboard layout
- 3 Zustand stores (auth with JWT persistence, global filters, ATLAS chat)
- Axios API client with JWT interceptor (auto-attach + 401 redirect)
- Login page with Framer Motion animation, password toggle, protected routing

### ✅ Phase 6 — Dashboard Pages & Global Filters (Steps 6.1–6.6)

All 5 dashboard tabs are fully implemented with live API data:

- **Executive Summary** — 4 KPI cards with mini sparklines (uploads, processing rate, publish rate, duration), 30-day trend area chart, output type donut chart, z-score anomaly alerts
- **Usage & Trends** — time series area chart with day/week/month granularity toggle, metric selector (uploaded/processed/published/duration), period-over-period comparison overlay with change %, uploads-by-client horizontal bar chart
- **Analysis** — dimension selector (client/channel/user/output type), ranked leaderboard with gold/silver/bronze badges, click-to-drilldown panel with 6 KPIs + radar chart, scrollable client × channel pivot table
- **Publishing Funnel** — 3-stage funnel cards (Uploaded → Processed → Published) with rate badges and drop-off indicators, grouped bar chart (processing % vs publish % per client), input type donut chart, output type horizontal bar chart
- **Video Explorer** — 10-column data table (7,800+ rows), debounced search, column sorting with chevron indicators, pagination (first/prev/page numbers/next/last), page size selector (25/50/100), status badges (Published/Processed/Pending), CSV export

**Global filter bar** — collapsible filter strip in the header with Client/Channel/Platform dropdowns, active filter badge count, smart channel scoping (channels filter to selected client), reset button. All 5 pages reactively re-fetch data when any filter changes via Zustand subscriptions.

### ⏳ Phase 7 — ATLAS AI Agent
- Gemini client with schema-aware system prompt
- Intent classifier (conversational vs analytics)
- 5 tools: execute_query, build_chart, get_schema, get_metric_definitions, answer
- ReAct reasoning loop (think → act → observe → repeat)
- Chat UI with dynamic chart rendering

### ⏳ Phase 8 — Polish & Documentation
- Error boundaries, skeleton screens, toast notifications
- Responsive design (768px → 1440px)
- Data quality monitoring
- Metric dictionary, dimension dictionary, ER diagram docs

## Getting started

### Prerequisites
- Docker Desktop
- Git

### Setup

```bash
git clone https://github.com/vhu0817/frammer-analytics.git
cd frammer-analytics
cp .env.example .env
docker-compose up --build -d
```

### Verify everything is running

```bash
# api health check
curl http://localhost:8000/health

# check database tables
docker-compose exec db psql -U frammer -d frammer_analytics -c "\dt"
```

### Seed the database

```bash
docker-compose exec api python -m scripts.simulate_data
```

### Default login

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@frammer.com` | `test1234` |
| Client Admin | `client@techvista.com` | `test1234` |
| Editor | `editor@mediaflow.com` | `test1234` |

### API docs

Once the API is running, Swagger UI is at [http://localhost:8000/docs](http://localhost:8000/docs).

### Frontend

The dashboard is at [http://localhost:5173](http://localhost:5173) (Vite dev server).

## Project structure

```
frammer-analytics/
├── api/
│   ├── app/
│   │   ├── models/          # SQLAlchemy ORM (star schema)
│   │   ├── routes/          # FastAPI route modules
│   │   ├── schemas/         # Pydantic request/response models
│   │   ├── services/        # business logic (auth, queries)
│   │   ├── middleware/       # RBAC, JWT extraction
│   │   ├── agent/           # ATLAS AI agent (phase 7)
│   │   ├── config.py        # pydantic-settings
│   │   ├── database.py      # SQLAlchemy engine + session
│   │   └── main.py          # FastAPI app entry point
│   ├── alembic/             # database migrations
│   ├── scripts/             # data simulator
│   └── requirements.txt
├── web/
│   └── src/
│       ├── components/
│       │   ├── layout/      # DashboardLayout, Header, Sidebar
│       │   └── ui/          # shadcn/ui primitives (button, etc.)
│       ├── pages/
│       │   ├── Login.jsx
│       │   ├── ExecutiveSummary.jsx
│       │   ├── UsageTrends.jsx
│       │   ├── Analysis.jsx
│       │   ├── PublishingFunnel.jsx
│       │   └── VideoExplorer.jsx
│       ├── stores/          # Zustand (auth, filters, atlas)
│       ├── lib/             # Axios client, utils
│       └── App.jsx          # routing + tab switch
├── docs/                    # documentation (phase 8)
├── docker-compose.yml
└── .env.example
```

## Data model

Star schema with 5 dimension tables and 1 fact table:

```
dim_client ──┐
dim_channel ─┤
dim_user ────┼──▶ fact_videos (14K+ records, 180 days)
dim_type ────┤
dim_platform ┘
```

Each video record tracks: upload → processing → publishing pipeline with timestamps, duration, status flags, and foreign keys to all dimensions.
