# WellTrack — MTSS Wellbeing Platform

A multi-tenant school wellbeing platform built on the **Multi-Tiered System of Supports (MTSS)** framework. Schools use WellTrack to screen students (SAEBRS), track interventions, monitor attendance, and identify at-risk students early.

## Tech Stack

- **Frontend**: React (CRA + Craco), Tailwind CSS, Shadcn/UI, Recharts
- **Backend**: FastAPI (Python 3.12), Motor (async MongoDB driver)
- **Database**: MongoDB (multi-tenant — one database per school)
- **AI**: Ollama (local LLM for intervention suggestions)

## Architecture

```
welltrack.com.au          → Landing page (school finder)
admin.welltrack.com.au    → Super Admin portal
{slug}.welltrack.com.au   → School portal (isolated DB)
```

Each school gets its own MongoDB database (`welltrack_{slug}`). A control database (`welltrack_control`) stores school registry, super admin accounts, platform config, and audit logs.

## Running Locally

### Prerequisites

- Python 3.12+
- Node.js 18+ / Yarn
- MongoDB 6+
- Ollama (optional, for AI suggestions)

### Backend

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # edit with your MongoDB URL, secrets, etc.
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

### Frontend

```bash
cd frontend
yarn install
cp .env.example .env   # set REACT_APP_BACKEND_URL, REACT_APP_BASE_DOMAIN
yarn start
```

### Required Environment Variables

**Backend (`backend/.env`)**:
| Variable | Description |
|---|---|
| `MONGO_URL` | MongoDB connection string |
| `DB_NAME` | Control database name (default: `welltrack_control`) |
| `JWT_SECRET` | Secret for session tokens |
| `BASE_DOMAIN` | Root domain (e.g., `welltrack.com.au`) |
| `DEFAULT_TENANT_SLUG` | Fallback tenant for dev (e.g., `demo`) |
| `APP_ENV` | `development` or `production` |
| `FRONTEND_URL` | Frontend origin for redirects |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID (optional) |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret (optional) |
| `GOOGLE_REDIRECT_URI` | OAuth callback URL (optional) |

**Frontend (`frontend/.env`)**:
| Variable | Description |
|---|---|
| `REACT_APP_BACKEND_URL` | Backend API base URL |
| `REACT_APP_BASE_DOMAIN` | Root domain for subdomain detection |

## Documentation

- [Product Requirements](memory/PRD.md)
- [Test Credentials](memory/test_credentials.md)
- [Multi-Tenant Blueprint](memory/MULTI_TENANT_FORK_PROMPT.md)

## License

Proprietary — all rights reserved.
