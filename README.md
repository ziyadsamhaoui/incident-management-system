<div align="center">

# ICGLMA Incident Management

Report shop-floor incidents in seconds, track them through to resolution.

![CI](https://img.shields.io/badge/CI-GitHub_Actions-2088FF)
![Java](https://img.shields.io/badge/Java-17-orange)
![Spring Boot](https://img.shields.io/badge/Spring_Boot-4.1.0-brightgreen)
![Next.js](https://img.shields.io/badge/Next.js-14-black)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-336791)
![Redis](https://img.shields.io/badge/Redis-7-dc382d)
![License](https://img.shields.io/badge/license-proprietary-lightgrey)

[Features](#features) · [Project structure](#project-structure) · [Tech stack](#tech-stack) · [Getting started](#getting-started) · [Contributing](#contributing)

</div>

---

## Why this exists

On the production site, incidents used to be reported by word of mouth. Whoever spotted the problem had to wait for a supervisor to walk by, nothing was written down, and nobody could say how long fixes actually took. ICGLMA replaces that with a simple flow: an operator declares the incident from a shared terminal, the right people get notified, and an admin tracks it through to resolution.

---

## Features

- Fast incident declaration from shared terminals, with photo, video, and voice note attachments
- Structured lifecycle from declaration to resolution, with a complete audit trail of every transition
- Automatic notifications to the relevant supervisors and administrators on every status change
- Search and filtering across active and archived incidents
- Dashboards covering resolution times, workload, and recurring problems, exportable as PDF, Excel, or CSV
- Administration of users, roles, departments, and reference data

### Who uses it

- **Operators** declare incidents from shared terminals and follow their own declarations.
- **Supervisors (chefs d'atelier)** watch the active list, the resolved archive, and their department's notifications.
- **Admins** claim, progress, and evaluate incidents, and manage users, reference data, media, and analytics.

One rule ties it all together: the person who declares an incident can never be the one who closes it.

---

## Project structure

```text
.
├── .github/workflows/   # CI pipeline (build, tests, static analysis)
├── backend/             # Spring Boot REST API (Java 17)
│   └── src/             # Controllers, services, security, database migrations
├── frontend/            # Next.js web app (TypeScript, Tailwind CSS)
│   └── app/             # Screens per role: operator, supervisor, admin
├── compose.yaml         # Local stack: PostgreSQL, Redis, backend, frontend
└── .env.example         # Template for the configuration values
```

---

## Tech stack

| Layer | Technology |
|---|---|
| Web app | Next.js, React, TypeScript, Tailwind CSS |
| API | Java 17, Spring Boot |
| Database | PostgreSQL |
| Cache and sessions | Redis |
| Authentication | JWT tokens |
| API docs | Swagger UI (OpenAPI) |
| Containers | Docker, Docker Compose |
| CI | GitHub Actions |

---

## How it fits together

The web app is a thin client: it renders screens per role and talks to the REST API over HTTP. The Spring Boot backend owns every business rule, from who can close an incident to how long media files are kept. PostgreSQL stores incidents, users, and the full audit trail. Redis handles short-lived state such as login tokens, rate limits, and dashboard caches. Photos and videos live on the server's disk, with only their metadata in the database. Full API documentation is generated at [http://localhost:8080/swagger-ui/index.html](http://localhost:8080/swagger-ui/index.html) once the backend is running.

---

## Getting started

### Prerequisites

- Docker with Docker Compose (recommended)
- For the manual path: JDK 17 and Node.js 20 (Maven comes through the wrapper, nothing to install)

### Clone

```bash
git clone <repo-url> incident-management
cd incident-management
```

### Run with Docker

```bash
cp .env.example .env   # then fill in the database, JWT secret, and mail values
docker compose up -d --build
```

- App: http://localhost:3000
- API: http://localhost:8080
- Swagger UI: http://localhost:8080/swagger-ui/index.html

The compose file reads `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB` from `.env` to initialize the database container, so make sure those three are set. Database migrations run automatically at startup, there is no manual setup.

### Run manually

```bash
# 1. Data layer (PostgreSQL 17 + Redis 7)
docker compose up -d postgres redis

# 2. Backend. Set the variables from .env.example first
#    (DB_PASSWORD, JWT_SECRET, MEDIA_SIGNING_SECRET, ...)
cd backend
./mvnw spring-boot:run

# 3. Frontend
cd frontend
npm install
npm run dev
```

The frontend defaults to `http://localhost:8080` for the API, so no extra configuration is needed locally. In dev, the backend seeds a ready-to-use admin account: `admin@dev.local` / `admin123`.

### Run the checks

```bash
# Backend: unit + integration tests and static analysis (needs Docker)
cd backend && ./mvnw clean verify

# Frontend: typecheck and lint
cd frontend && npx tsc --noEmit && npm run lint
```

---

## Contributing

1. Fork the repository
2. Create your branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m "Add my feature"`
4. Push the branch: `git push origin feature/my-feature`
5. Open a pull request

---

## License

This project is proprietary. All rights reserved by ICGL-Maroc / FORMENS. Contact the IT department for usage terms.
