# Meetings App

Monorepo with a FastAPI backend (`back/`), a React + shadcn/ui frontend (`front/`) and PostgreSQL,
all started with Docker Compose. List meetings, add them (title, description, participants,
call link, place) and remove them.

## Run everything

```bash
make up          # = cp .env.example .env (first time) + docker compose up --build --wait
make help        # all targets: logs, test, lint, format, clean, aws-*
```

- App: http://localhost:3000
- API docs: http://localhost:3000/api/docs (or http://localhost:8000/api/docs directly)

If a host port is already taken, change `DB_PORT`, `BACKEND_PORT` or `FRONTEND_PORT` in `.env`.
`SEED=true` inserts 5 sample participants on first start. `docker compose down -v` wipes the database.

## Layout

```
compose.yaml      # db, backend, frontend
back/             # FastAPI + SQLAlchemy 2 + Alembic
  app/
    main.py       # app, CORS, error handlers
    models.py     # Meeting, Participant, meeting_participants (many-to-many)
    schemas.py    # Pydantic request/response models
    services/     # business logic
    routers/      # /api/meetings, /api/participants, /api/health
  alembic/        # migrations (run on container start)
  tests/
front/            # Vite + React + TypeScript + Tailwind + shadcn/ui
  src/
    components/   # MeetingsTable, MeetingFormDialog, DeleteMeetingDialog, ParticipantsMultiSelect
    components/ui # generated shadcn components
    hooks/        # TanStack Query hooks
    lib/api.ts    # typed fetch wrapper
  nginx.conf      # serves the SPA, proxies /api to backend
```

## API

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/health` | Liveness + DB check |
| GET | `/api/meetings` | List meetings with participants, newest first |
| GET | `/api/meetings/{id}` | One meeting |
| POST | `/api/meetings` | Create a meeting |
| DELETE | `/api/meetings/{id}` | Delete a meeting |
| GET | `/api/participants?q=` | List/search participants |
| POST | `/api/participants` | Create a participant (409 on duplicate email) |
| DELETE | `/api/participants/{id}` | Delete a participant |

All IDs are UUIDs. A meeting needs a title and at least one of `call_link` or `place`.

## Local development

Backend (needs a Postgres, e.g. `docker compose up -d db`):

```bash
cd back
uv sync
DATABASE_URL=postgresql+psycopg://meetings:meetings@localhost:5432/meetings uv run alembic upgrade head
DATABASE_URL=postgresql+psycopg://meetings:meetings@localhost:5432/meetings uv run uvicorn app.main:app --reload
```

Frontend (Vite proxies `/api` to `http://localhost:8000`, override with `VITE_API_PROXY`):

```bash
cd front
npm install
npm run dev        # http://localhost:5173
```

## Tests

```bash
# backend: uses a separate database (created once)
docker compose exec db psql -U meetings -c "CREATE DATABASE meetings_test"
cd back && TEST_DATABASE_URL=postgresql+psycopg://meetings:meetings@localhost:5432/meetings_test uv run pytest

# frontend
cd front && npm test
```

## Code style

CI (`.github/workflows/code-style.yml`) runs on every push to `main` and on pull requests:

| Part | Tools | Run locally | Auto-fix |
| --- | --- | --- | --- |
| `back/` | Ruff (lint + format) | `uv run ruff check . && uv run ruff format --check .` | `uv run ruff check --fix . && uv run ruff format .` |
| `front/` | ESLint, Prettier, `tsc` | `npm run lint && npm run format:check && npm run typecheck` | `npm run format` |

Config lives in `back/pyproject.toml` (`[tool.ruff]`), `front/eslint.config.js` and `front/.prettierrc.json`.

## Deploy to AWS (backend on ECS Fargate, database on RDS)

Infrastructure is CloudFormation in `infra/`:

- `infra/backend-ecr.yaml`: ECR repository for the backend image.
- `infra/backend.yaml`: VPC, RDS PostgreSQL, Application Load Balancer, ECS cluster and Fargate service.

```mermaid
flowchart LR
    U[Internet] -->|HTTP :80| ALB[Application Load Balancer<br/>public subnets]
    ALB -->|:8000| T[Fargate task<br/>public subnets, SG: ALB only]
    T -->|:5432| DB[(RDS PostgreSQL<br/>private subnets)]
    T -. image .-> ECR[ECR]
    T -. DB password .-> SSM[SSM Parameter Store]
```

1. Put credentials into `.env` (an IAM user or role allowed to use CloudFormation, EC2/VPC, ECS, ECR, RDS, ELB, IAM, SSM and CloudWatch Logs):

   ```
   AWS_ACCESS_KEY_ID=...
   AWS_SECRET_ACCESS_KEY=...
   AWS_REGION=eu-central-1
   ```

2. Optionally copy `infra/backend.params.example.env` to `infra/backend.params.env` to override stack parameters (desired count, Spot, CORS origins, HTTPS certificate, …).
3. Deploy. The first run takes about 10–15 minutes, mostly waiting for RDS:

   ```bash
   make aws-backend-deploy   # ECR stack -> DB password in SSM -> build & push image -> backend stack
   ```

   It prints the API URL. Later deploys push a new image tagged with the git revision and roll the service; a failing deployment rolls back automatically (circuit breaker).

Other targets: `make aws-backend-outputs`, `aws-backend-status`, `aws-backend-logs`, `aws-backend-redeploy`, `aws-backend-destroy` (`aws-deploy` / `aws-destroy` run every part). Use `ARCH=amd64` to build x86 images instead of Graviton (`arm64`, the default).

**Cost.** The template sticks to free-tier-eligible choices where they exist: `db.t4g.micro`, 20 GB gp2, single AZ, 1-day backups, no NAT gateway, SSM instead of Secrets Manager, and ECR limited to the last 5 images. Some parts are *not* free: Fargate (about $3/month on Spot with 0.25 vCPU / 0.5 GB ARM64, around 3× that on demand), public IPv4 addresses, and the ALB once the 12-month free tier ends. Run `make aws-backend-destroy` when you are done. It keeps a final RDS snapshot.

On AWS the backend reads `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` and `DB_PASSWORD` (the password is injected from SSM) instead of `DATABASE_URL`. Migrations run on container start under a Postgres advisory lock, so several tasks can start at once safely.
