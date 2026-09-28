# Lead CRM — Backend API

REST API for a lead-management CRM built for loan and finance calling teams. Node 20 · Express · TypeScript · MongoDB · S3.

**Docs:** [Architecture & diagrams](docs/ARCHITECTURE.md) · [AWS deployment (beginner guide)](docs/DEPLOYMENT.md) · [Codebase skill for AI assistants](docs/CLAUDE_SKILL.md)

## Features

- **Auth & accounts** — login by email / username / phone; JWT access + rotating refresh tokens with server-side revocation; forced password change; account deactivation with lead hand-over.
- **Roles & permissions** — Admin, Branch Manager, Team Lead, Calling Agent. 52 granular permissions grouped into admin-editable **permission templates** (per-role defaults + custom variants). Admin can always do everything.
- **Data visibility** — derived from the team hierarchy: agents see their leads, team leads their team, managers their teams, admins everything.
- **Leads** — list tabs (Contacted / Assigned / Created / Follow-ups today, Overdue, Unassigned, Today list, All), filters incl. custom-field filters, sortable columns, CSV export, duplicate-phone detection, soft delete + restore, quality score.
- **Pipeline** — configurable stages (won/lost flags), statuses (optionally per stage), sources, and **stage directives** (mandatory fields / remark / follow-up / allowed roles when entering a stage).
- **Custom fields** — admin-defined fields grouped into tabs & sections (seeded with loan, credit-card, disbursement and product fields); validated server-side.
- **Assignment** — manual, bulk (with *erase history*), and rules (round-robin, least-loaded, specific user) applied on create and import.
- **Activity** — immutable timeline + audit trail, notes, tasks, call logs (outcome updates lead status), documents via presigned S3 upload (local-disk driver for dev).
- **Communication** — message templates with `{{placeholders}}` rendered into WhatsApp / mailto / tel deep links; every touch logged. Adapter seam for real providers.
- **Bulk import** — CSV preview → column mapping → async job with per-row error report (downloadable), create or upsert mode, auto-created sources, assignment rules.
- **Reports** — dashboard KPIs + funnel, daily trend, per-agent performance, team comparison, activity feed.
- **Ops** — `/health`, structured logs (pino) with request IDs, rate limiting, helmet, graceful shutdown, multi-stage Dockerfile, GitHub Actions CI.

## Quick start

```bash
cp .env.example .env            # set MONGODB_URI, JWT secrets
npm install
npm run seed -- --demo          # org + admin + pipeline + fields + demo teams/users/60 leads
npm run dev                     # http://localhost:4000
```

Default login (from `.env`): `admin@example.com` / `Admin@12345`. Demo users share the password `Demo@12345` (`meera.manager`, `ravi.tl`, `anita.agent`, `karan.agent`, `priya.agent` — use the `@demo.local` email or the username).

Requires MongoDB locally (`docker run -d -p 27017:27017 mongo:7`).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start with hot reload (tsx) |
| `npm run typecheck` | `tsc --noEmit` (strict, no unused locals) |
| `npm test` | Unit + integration tests (Jest + Supertest + mongodb-memory-server) |
| `npm run test:unit` | Pure-logic tests only (no database) |
| `npm run seed [-- --demo]` | Idempotent seed; `--demo` adds sample data |
| `npm run build && npm start` | Compile to `dist/` and run |
| `docker build -t lead-crm-backend .` | Production image (non-root, healthcheck) |

## Environment

See [`.env.example`](.env.example). Key settings: `MONGODB_URI`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `CORS_ORIGINS`, `PUBLIC_API_URL`, `STORAGE_DRIVER` (`local` | `s3`), `S3_BUCKET`, `AWS_REGION`, `SEED_*`.

## Testing

```bash
npm run test:unit      # fast, no DB
npm test               # full suite; first run downloads a MongoDB binary (~100 MB) for the in-memory server
```

Integration suites cover: authentication & token rotation, role-based visibility and permission templates, lead lifecycle (create, custom-field validation, stage directives, status, follow-up permissions, bulk assign with erase history, delete/restore, export, assignment rules, deep-link communication) and CSV import (preview, create/upsert, error CSV).

## Project layout

```
src/
  config/       env · logger · db
  common/       errors · http · pagination · dates · permissions catalogue · crudRouter
  middleware/   auth · validate · errorHandler
  services/     scope · permission · assignment · storage · template · activity
  models/       Mongoose schemas (all org-scoped)
  modules/      auth · users · config · leads · files · imports · reports · bootstrap
  scripts/      seed.ts
tests/          unit/ · integration/ · helpers/
docs/           ARCHITECTURE.md · DEPLOYMENT.md · CLAUDE_SKILL.md
```

## API overview

Base URL `/api/v1`, JSON, bearer auth. Full route list in [docs/CLAUDE_SKILL.md §4](docs/CLAUDE_SKILL.md). Responses are `{ success, data, meta? }` or `{ success: false, error: { code, message, details? } }`.

## License

Private — © your company.
